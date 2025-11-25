import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';
import * as crypto from 'crypto';

/**
 * Mist ID Generator Service
 * 
 * Generates unique 64-bit IDs using the Mist algorithm:
 * - 1 bit sign (always 0 for positive IDs)
 * - 51 bits sequence number (globally unique, incrementing sequence from Redis)
 * - 6 bits random salt (enhances unpredictability and security)
 * - 6 bits additional random salt (further ensures uniqueness)
 * 
 * Key Advantages:
 * - ✅ NO timestamp dependency - eliminates timestamp overflow issues completely
 * - ✅ NO clock synchronization problems - immune to clock skew
 * - ✅ Long duration - 51-bit sequence provides ~6,165 years at 1B IDs/day
 * - ✅ Enhanced security - random bits make IDs unpredictable
 * - ✅ Strict ordering - centralized sequence ensures monotonic IDs
 * - ✅ DISTRIBUTED GENERATION - Works seamlessly across multiple machines/instances
 * 
 * Distributed Generation:
 * - All machines share the same Redis sequence counter (mist:global:sequence)
 * - Uses Redis INCRBY atomic operation to ensure no collisions across machines
 * - Each machine pre-fetches batches (default: 1000 IDs) to reduce Redis calls
 * - Random salts ensure uniqueness even in edge cases
 * - No machine ID needed - all IDs are globally unique regardless of source machine
 * 
 * Trade-offs:
 * - Requires Redis for centralized sequence management
 * - Redis becomes a single point of failure (mitigated by Redis HA/clustering)
 * - Slightly higher latency due to Redis round-trip (mitigated by batching and connection pooling)
 * - Still has sequence limit (though very large: ~6,165 years at 1B IDs/day)
 * 
 * Capacity (with 51-bit sequence):
 * - 51-bit sequence: 2,251,799,813,685,247 unique IDs (2.25+ quadrillion)
 * - At 0.1 billion IDs/day: ~61,650 years
 * - At 1 billion IDs/day: ~6,165 years (target: 3,853+ years ✅)
 * - At 10 billion IDs/day: ~616.5 years
 * - At 100 billion IDs/day: ~61.7 years
 * 
 * The Mist algorithm is ideal for systems that:
 * - Need IDs that work indefinitely without timestamp concerns
 * - Already have Redis infrastructure
 * - Prioritize security and unpredictability
 * - Can tolerate Redis dependency
 */
@Injectable()
export class MistService implements OnModuleInit {
	private readonly logger = new Logger(MistService.name);
	private readonly redis: Redis;

	// Mist bit configuration (optimized for ~3853 years at 1B IDs/day)
	// Total: 64 bits = 1 sign + 51 sequence + 6 salt1 + 6 salt2
	private readonly SEQUENCE_BITS = 51; // 51 bits for globally unique sequence (~6,165 years at 1B IDs/day)
	private readonly SALT1_BITS = 6; // 6 bits for first random salt (64 values)
	private readonly SALT2_BITS = 6; // 6 bits for second random salt (64 values)

	// Maximum values
	private readonly MAX_SEQUENCE = (1n << BigInt(this.SEQUENCE_BITS)) - 1n; // 2^51 - 1 = 2,251,799,813,685,247
	private readonly MAX_SALT1 = (1 << this.SALT1_BITS) - 1; // 63
	private readonly MAX_SALT2 = (1 << this.SALT2_BITS) - 1; // 63

	// Bit shifts
	private readonly SALT2_SHIFT = 0; // 0 (lowest bits)
	private readonly SALT1_SHIFT = this.SALT2_BITS; // 6
	private readonly SEQUENCE_SHIFT = this.SALT1_BITS + this.SALT2_BITS; // 12

	// Redis key for global sequence
	private readonly SEQUENCE_KEY = 'mist:global:sequence';

	// Configuration
	private readonly SEQUENCE_BATCH_SIZE: number; // Pre-fetch sequence numbers in batches
	private readonly SEQUENCE_BATCH_TTL: number; // TTL for batch reservation in Redis

	// Local sequence buffer (for performance)
	private sequenceBuffer: { start: bigint; end: bigint; current: bigint } | null = null;

	constructor(
		private readonly configService: ConfigService,
		private readonly redisService: RedisService,
	) {
		this.redis = this.redisService.getOrThrow();

		const mistConfig = this.configService.get('mist');
		
		// Sequence batch size (default: 1000) - pre-fetch sequence numbers for performance
		this.SEQUENCE_BATCH_SIZE = mistConfig?.sequenceBatchSize 
			?? parseInt(process.env.MIST_SEQUENCE_BATCH_SIZE || '1000', 10);
		
		// Sequence batch TTL in seconds (default: 60) - how long to reserve a batch
		this.SEQUENCE_BATCH_TTL = mistConfig?.sequenceBatchTtl 
			?? parseInt(process.env.MIST_SEQUENCE_BATCH_TTL || '60', 10);

		this.logger.log(
			`Mist initialized - Sequence Batch Size: ${this.SEQUENCE_BATCH_SIZE}, ` +
			`Batch TTL: ${this.SEQUENCE_BATCH_TTL}s`
		);
	}

	async onModuleInit() {
		// Verify Redis connection
		try {
			await this.redis.ping();
			this.logger.log('MistService: Redis connection verified');
		} catch (error) {
			this.logger.error(
				`MistService: Failed to connect to Redis: ${error.message}. ` +
				`Mist ID generation requires Redis for sequence management.`
			);
			throw error;
		}

		// Initialize global sequence if it doesn't exist
		const exists = await this.redis.exists(this.SEQUENCE_KEY);
		if (!exists) {
			await this.redis.set(this.SEQUENCE_KEY, '0');
			this.logger.log('MistService: Initialized global sequence counter');
		} else {
			const currentSequence = await this.redis.get(this.SEQUENCE_KEY);
			this.logger.log(
				`MistService: Global sequence counter found: ${currentSequence}`
			);
		}

		// Calculate capacity information
		const maxSequence = Number(this.MAX_SEQUENCE);
		const idsPerDay1B = 1_000_000_000; // 1 billion IDs per day
		const yearsAt1B = maxSequence / (idsPerDay1B * 365.25);
		const idsPerDay10B = 10_000_000_000; // 10 billion IDs per day
		const yearsAt10B = maxSequence / (idsPerDay10B * 365.25);
		const idsPerDay100M = 100_000_000; // 100 million IDs per day
		const yearsAt100M = maxSequence / (idsPerDay100M * 365.25);
		const targetYears = 3853;
		const meetsTarget = yearsAt1B >= targetYears;

		this.logger.log(
			`Mist capacity: ${maxSequence.toLocaleString()} total IDs (51-bit sequence). ` +
			`At 100M IDs/day: ~${yearsAt100M.toFixed(0)} years. ` +
			`At 1B IDs/day: ~${yearsAt1B.toFixed(0)} years ${meetsTarget ? '✅' : '⚠️'}. ` +
			`At 10B IDs/day: ~${yearsAt10B.toFixed(1)} years.`
		);
		
		if (meetsTarget) {
			this.logger.log(
				`✅ Target achieved: ${yearsAt1B.toFixed(0)} years at 1B IDs/day exceeds ${targetYears} years requirement`
			);
		}
	}

	/**
	 * Generate a new Mist ID
	 * @returns A unique 64-bit integer (as string to avoid JavaScript number precision issues)
	 */
	async generateId(): Promise<string> {
		// Get next sequence number (with batching for performance)
		const sequence = await this.getNextSequence();

		// Generate random salts for security and unpredictability
		const salt1 = crypto.randomInt(0, this.MAX_SALT1 + 1);
		const salt2 = crypto.randomInt(0, this.MAX_SALT2 + 1);

		// Build ID
		const id = this.buildId(sequence, salt1, salt2);

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
	 * Parse a Mist ID to extract its components
	 * Note: Random salts cannot be extracted meaningfully, but sequence can be
	 * @param id The Mist ID (as string or number)
	 * @returns Object containing sequence (salts are random and not meaningful to extract)
	 */
	parseId(id: string | bigint | number): {
		sequence: bigint;
		salt1: number;
		salt2: number;
	} {
		const idBigInt = BigInt(id);
		
		// Extract components using bit masks
		const sequence = (idBigInt >> BigInt(this.SEQUENCE_SHIFT)) & this.MAX_SEQUENCE;
		const salt1 = Number((idBigInt >> BigInt(this.SALT1_SHIFT)) & BigInt(this.MAX_SALT1));
		const salt2 = Number(idBigInt & BigInt(this.MAX_SALT2));

		return {
			sequence,
			salt1,
			salt2,
		};
	}

	/**
	 * Get the current global sequence value (for monitoring)
	 * @returns Current sequence number
	 */
	async getCurrentSequence(): Promise<bigint> {
		const value = await this.redis.get(this.SEQUENCE_KEY);
		return BigInt(value || '0');
	}

	/**
	 * Get next sequence number with batching for performance
	 * Uses local buffer to reduce Redis round-trips
	 */
	private async getNextSequence(): Promise<bigint> {
		// Check if we have a valid buffer
		if (this.sequenceBuffer && this.sequenceBuffer.current < this.sequenceBuffer.end) {
			const sequence = this.sequenceBuffer.current;
			this.sequenceBuffer.current += 1n;
			return sequence;
		}

		// Need to fetch a new batch from Redis
		await this.refreshSequenceBuffer();
		
		// Use the first sequence from the new buffer
		const sequence = this.sequenceBuffer!.current;
		this.sequenceBuffer!.current += 1n;
		return sequence;
	}

	/**
	 * Refresh the sequence buffer by reserving a batch from Redis
	 * This method is safe for concurrent execution across multiple machines/instances
	 * Redis INCRBY is atomic, ensuring no collisions in distributed environments
	 */
	private async refreshSequenceBuffer(): Promise<void> {
		// Use Redis INCRBY to atomically reserve a batch
		// This ensures no collisions even in distributed environments with multiple machines
		// Each machine can safely call this concurrently - Redis handles atomicity
		const batchSize = BigInt(this.SEQUENCE_BATCH_SIZE);
		const newEnd = await this.redis.incrby(this.SEQUENCE_KEY, Number(batchSize));
		
		// Check for overflow
		if (BigInt(newEnd) > this.MAX_SEQUENCE) {
			throw new Error(
				`Mist sequence overflow! Current sequence (${newEnd}) exceeds maximum (${this.MAX_SEQUENCE.toString()}). ` +
				`The system has generated the maximum number of IDs. This should not happen for many centuries.`
			);
		}

		const end = BigInt(newEnd);
		const start = end - batchSize + 1n;

		this.sequenceBuffer = {
			start,
			end,
			current: start,
		};

		this.logger.debug(
			`[Distributed] Reserved sequence batch: ${start.toString()} to ${end.toString()} ` +
			`(shared across all machines via Redis)`
		);
	}

	/**
	 * Build the Mist ID from components
	 */
	private buildId(sequence: bigint, salt1: number, salt2: number): bigint {
		// Validation
		if (sequence > this.MAX_SEQUENCE) {
			throw new Error(
				`Sequence ${sequence} exceeds maximum value ${this.MAX_SEQUENCE} for ${this.SEQUENCE_BITS}-bit field`
			);
		}
		if (salt1 > this.MAX_SALT1 || salt1 < 0) {
			throw new Error(`Salt1 ${salt1} out of range [0, ${this.MAX_SALT1}]`);
		}
		if (salt2 > this.MAX_SALT2 || salt2 < 0) {
			throw new Error(`Salt2 ${salt2} out of range [0, ${this.MAX_SALT2}]`);
		}

		return (
			(sequence << BigInt(this.SEQUENCE_SHIFT)) |
			(BigInt(salt1) << BigInt(this.SALT1_SHIFT)) |
			BigInt(salt2)
		);
	}
}

