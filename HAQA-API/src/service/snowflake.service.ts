import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MachineIdCoordinatorService } from './machine-id-coordinator.service';

/**
 * Snowflake ID Generator Service
 * 
 * Generates unique 64-bit IDs using the Snowflake algorithm:
 * - 1 bit sign (always 0 for positive IDs)
 * - 41 bits timestamp (milliseconds since custom epoch)
 * - 10 bits machine ID (datacenter + machine)
 * - 12 bits sequence number (0-4095)
 * 
 * ⚠️  IMPORTANT: The Snowflake epoch is FIXED and immutable.
 * Once IDs are generated with a specific epoch, it CANNOT be changed without
 * breaking all existing IDs and causing data corruption.
 * 
 * Handles clock rollback by waiting for time to catch up with a configurable timeout.
 * Uses MachineIdCoordinatorService for distributed machine ID assignment.
 */
@Injectable()
export class SnowflakeService implements OnModuleInit {
	private readonly logger = new Logger(SnowflakeService.name);

	// Snowflake bit configuration
	private readonly TIMESTAMP_BITS = 41;
	private readonly MACHINE_ID_BITS = 10;
	private readonly SEQUENCE_BITS = 12;

	// Maximum values
	private readonly MAX_MACHINE_ID = (1 << this.MACHINE_ID_BITS) - 1; // 1023
	private readonly MAX_SEQUENCE = (1 << this.SEQUENCE_BITS) - 1; // 4095

	// Bit shifts
	private readonly MACHINE_ID_SHIFT = this.SEQUENCE_BITS; // 12
	private readonly TIMESTAMP_SHIFT = this.SEQUENCE_BITS + this.MACHINE_ID_BITS; // 22

	/**
	 * Snowflake Epoch - FIXED AND IMMUTABLE
	 * 
	 * ⚠️ CRITICAL: This epoch MUST NEVER be changed after the first Snowflake ID is generated.
	 * Changing the epoch will cause:
	 * - All existing IDs to be parsed incorrectly
	 * - Timestamps to be completely wrong
	 * - Potential ID collisions
	 * - Data corruption
	 * 
	 * The epoch is the starting point for timestamp calculation in Snowflake IDs.
	 * Once IDs are generated with this epoch, it must remain the same FOREVER.
	 * 
	 * Default: 2024-01-01 00:00:00 UTC
	 * This gives approximately 69 years of unique IDs (until ~2093).
	 */
	private static readonly SNOWFLAKE_EPOCH = new Date('2024-01-01T00:00:00Z').getTime();
	private readonly EPOCH: number = SnowflakeService.SNOWFLAKE_EPOCH;

	// Machine ID (0-1023) - obtained from coordinator
	private MACHINE_ID: number | null = null;

	// Clock rollback handling
	private readonly ROLLBACK_WAIT_TIMEOUT: number; // milliseconds

	// State
	private sequence = 0;
	private lastTimestamp = -1;

	constructor(
		private readonly configService: ConfigService,
		private readonly machineIdCoordinator: MachineIdCoordinatorService,
	) {
		const snowflakeConfig = this.configService.get('snowflake');

		// Rollback wait timeout (default: 5 seconds)
		this.ROLLBACK_WAIT_TIMEOUT = snowflakeConfig?.rollbackWaitTimeout 
			?? parseInt(process.env.SNOWFLAKE_ROLLBACK_WAIT_TIMEOUT || '5000', 10);

		this.logger.log(
			`Snowflake initialized - Epoch: ${new Date(this.EPOCH).toISOString()} (FIXED), ` +
			`Rollback Timeout: ${this.ROLLBACK_WAIT_TIMEOUT}ms`
		);
	}

	/**
	 * Get the fixed Snowflake epoch (for reference/validation)
	 * @returns The epoch timestamp in milliseconds since Unix epoch
	 */
	static getEpoch(): number {
		return SnowflakeService.SNOWFLAKE_EPOCH;
	}

	/**
	 * Get the fixed Snowflake epoch as a Date object (for reference/validation)
	 * @returns The epoch as a Date object
	 */
	static getEpochDate(): Date {
		return new Date(SnowflakeService.SNOWFLAKE_EPOCH);
	}

	onModuleInit() {
		// Get machine ID from coordinator (it should be ready by now since it's a dependency)
		if (!this.machineIdCoordinator.isCoordinatorReady()) {
			throw new Error(
				'MachineIdCoordinatorService is not ready. ' +
				'This should not happen as it is initialized before SnowflakeService.'
			);
		}

		try {
			this.MACHINE_ID = this.machineIdCoordinator.getMachineId();
			this.logger.log(
				`SnowflakeService initialized with Machine ID: ${this.MACHINE_ID}`
			);
		} catch (error) {
			this.logger.error(
				`Failed to get machine ID from coordinator: ${error.message}. ` +
				`SnowflakeService may not work correctly.`
			);
			throw error;
		}
	}

	/**
	 * Generate a new Snowflake ID
	 * @returns A unique 64-bit integer (as string to avoid JavaScript number precision issues)
	 */
	async generateId(): Promise<string> {
		if (this.MACHINE_ID === null) {
			throw new Error('Machine ID not initialized. Ensure onModuleInit has completed.');
		}

		let timestamp = this.getCurrentTimestamp();

		// Handle clock rollback
		if (timestamp < this.lastTimestamp) {
			const offset = this.lastTimestamp - timestamp;
			this.logger.warn(
				`Clock moved backwards by ${offset}ms. Waiting for time to catch up...`
			);

			// Wait until time catches up to lastTimestamp, with timeout
			await this.waitUntilTimeCatchesUp(this.lastTimestamp);
			timestamp = this.getCurrentTimestamp();

			// If still behind after waiting, throw error
			if (timestamp < this.lastTimestamp) {
				throw new Error(
					`Clock rollback detected: current time ${timestamp} is still behind last timestamp ${this.lastTimestamp} after waiting ${this.ROLLBACK_WAIT_TIMEOUT}ms`
				);
			}
		}

		// Reset sequence if we've moved to a new millisecond
		if (timestamp === this.lastTimestamp) {
			this.sequence = (this.sequence + 1) & this.MAX_SEQUENCE;

			// If sequence overflows in the same millisecond, wait for next millisecond
			if (this.sequence === 0) {
				timestamp = this.waitUntilNextMillis(this.lastTimestamp);
			}
		} else {
			this.sequence = 0;
		}

		this.lastTimestamp = timestamp;

		// Generate ID
		const id = this.buildId(timestamp, this.MACHINE_ID, this.sequence);

		return id.toString();
	}

	/**
	 * Generate multiple IDs in batch
	 * @param count Number of IDs to generate
	 * @returns Array of unique IDs
	 */
	async generateIds(count: number): Promise<string[]> {
		if (count < 1 || count > 1000) {
			throw new Error('Count must be between 1 and 1000');
		}

		const ids: string[] = [];
		for (let i = 0; i < count; i++) {
			ids.push(await this.generateId());
		}

		return ids;
	}

	/**
	 * Parse a Snowflake ID to extract its components
	 * @param id The Snowflake ID (as string or number)
	 * @returns Object containing timestamp, machineId, and sequence
	 */
	parseId(id: string | bigint | number): {
		timestamp: number;
		machineId: number;
		sequence: number;
		date: Date;
	} {
		const idBigInt = BigInt(id);
		
		// Extract components using bit masks
		const timestamp = Number((idBigInt >> BigInt(this.TIMESTAMP_SHIFT)) & BigInt((1 << this.TIMESTAMP_BITS) - 1));
		const machineId = Number((idBigInt >> BigInt(this.MACHINE_ID_SHIFT)) & BigInt(this.MAX_MACHINE_ID));
		const sequence = Number(idBigInt & BigInt(this.MAX_SEQUENCE));

		// Convert timestamp back to actual time
		const actualTimestamp = timestamp + this.EPOCH;

		return {
			timestamp: actualTimestamp,
			machineId,
			sequence,
			date: new Date(actualTimestamp),
		};
	}

	/**
	 * Get current timestamp in milliseconds since epoch
	 */
	private getCurrentTimestamp(): number {
		return Date.now() - this.EPOCH;
	}

	/**
	 * Build the Snowflake ID from components
	 */
	private buildId(timestamp: number, machineId: number, sequence: number): bigint {
		return (
			(BigInt(timestamp) << BigInt(this.TIMESTAMP_SHIFT)) |
			(BigInt(machineId) << BigInt(this.MACHINE_ID_SHIFT)) |
			BigInt(sequence)
		);
	}

	/**
	 * Wait until the next millisecond if sequence overflows
	 */
	private waitUntilNextMillis(lastTimestamp: number): number {
		let timestamp = this.getCurrentTimestamp();
		while (timestamp <= lastTimestamp) {
			timestamp = this.getCurrentTimestamp();
		}
		return timestamp;
	}

	/**
	 * Wait until time catches up after clock rollback
	 */
	private async waitUntilTimeCatchesUp(targetTimestamp: number): Promise<void> {
		const startTime = Date.now();
		
		while (this.getCurrentTimestamp() < targetTimestamp) {
			// Check timeout
			if (Date.now() - startTime > this.ROLLBACK_WAIT_TIMEOUT) {
				return; // Timeout reached, will be checked again in generateId
			}

			// Wait a small amount before checking again
			await new Promise((resolve) => setTimeout(resolve, 1));
		}
	}
}

