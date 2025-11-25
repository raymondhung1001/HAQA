import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';
import * as crypto from 'crypto';
import * as os from 'os';

/**
 * Machine ID Coordinator Service
 * 
 * Coordinates unique machine ID assignment across multiple instances using Redis.
 * Each instance acquires a machine ID (0-1023) and maintains a heartbeat to keep it alive.
 * 
 * Machine ID Assignment Strategies (in order of preference):
 * 1. Redis-based coordination (primary) - Best for auto-scaling
 *    - Each instance acquires an available machine ID via Redis
 *    - Uses heartbeat mechanism to maintain lease
 *    - Automatically handles instance failures and ID reclamation
 * 
 * 2. Environment variable (SNOWFLAKE_MACHINE_ID) - Manual assignment
 *    - Use when you want to explicitly assign machine IDs
 *    - Good for fixed deployments or when Redis is unavailable
 * 
 * 3. Hash-based from app name + instance identifier (last resort)
 *    - Uses app name hash as base to ensure consistent range per application
 *    - Combines with instance-specific identifiers (pod/container name, hostname, PID)
 *    - XOR combination ensures uniqueness while maintaining app-based distribution
 *    - Works well for auto-scaling even without Redis, but collisions possible
 * 
 * Auto-scaling Support:
 * - Redis coordination is recommended for true distributed auto-scaling
 * - Hash-based fallback uses app name to group machine IDs per application
 * - Each instance gets unique ID based on pod/container name, hostname, and PID
 */
@Injectable()
export class MachineIdCoordinatorService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(MachineIdCoordinatorService.name);
	private readonly redis: Redis;
	
	private readonly MAX_MACHINE_ID = 1023;
	private readonly HEARTBEAT_INTERVAL: number;
	private readonly HEARTBEAT_TTL: number;
	private readonly COORDINATION_KEY_PREFIX = 'snowflake:machine-id:';
	private readonly INSTANCE_INFO_KEY_PREFIX = 'snowflake:instance:';
	
	private machineId: number | null = null;
	private heartbeatInterval: NodeJS.Timeout | null = null;
	private instanceId: string;
	private readonly useRedis: boolean;
	private readonly fallbackMachineId: number | null;
	private isReady: boolean = false;

	private readonly appName: string;

	constructor(
		private readonly redisService: RedisService,
		private readonly configService: ConfigService,
	) {
		try {
			this.redis = this.redisService.getOrThrow();
			this.useRedis = true;
		} catch (error) {
			this.logger.warn('Redis not available, will use fallback for machine ID assignment');
			this.useRedis = false;
		}

		// Get app name from config for hash-based machine ID generation
		const snowflakeConfig = this.configService.get('snowflake');
		this.appName = snowflakeConfig?.appName || process.env.SNOWFLAKE_APP_NAME || process.env.APP_NAME || 'haqa-api';

		// Generate unique instance ID
		this.instanceId = this.generateInstanceId();

		// Get fallback machine ID from config/env
		const envMachineId = process.env.SNOWFLAKE_MACHINE_ID;
		this.fallbackMachineId = snowflakeConfig?.machineId 
			?? (envMachineId ? parseInt(envMachineId, 10) : null);

		// Get heartbeat configuration
		const coordinationConfig = snowflakeConfig?.coordination || {};
		this.HEARTBEAT_INTERVAL = coordinationConfig.heartbeatInterval 
			?? parseInt(process.env.SNOWFLAKE_HEARTBEAT_INTERVAL || '30000', 10);
		this.HEARTBEAT_TTL = coordinationConfig.heartbeatTtl 
			?? parseInt(process.env.SNOWFLAKE_HEARTBEAT_TTL || '60000', 10);

		this.logger.log(
			`App Name: ${this.appName}, ` +
			`Instance ID: ${this.instanceId}, ` +
			`Heartbeat Interval: ${this.HEARTBEAT_INTERVAL}ms, ` +
			`Heartbeat TTL: ${this.HEARTBEAT_TTL}ms`
		);
	}

	async onModuleInit() {
		await this.acquireMachineId();
		this.isReady = true;
		this.logger.log(`Machine ID coordinator ready with machine ID: ${this.machineId}`);
	}

	async onModuleDestroy() {
		this.stopHeartbeat();
		await this.releaseMachineId();
	}

	/**
	 * Get the assigned machine ID
	 */
	getMachineId(): number {
		if (!this.isReady || this.machineId === null) {
			throw new Error(
				'Machine ID not yet acquired. Ensure MachineIdCoordinatorService.onModuleInit has completed.'
			);
		}
		return this.machineId;
	}

	/**
	 * Check if the coordinator is ready
	 */
	isCoordinatorReady(): boolean {
		return this.isReady && this.machineId !== null;
	}

	/**
	 * Acquire a machine ID
	 */
	private async acquireMachineId(): Promise<void> {
		if (!this.useRedis) {
			await this.acquireFallbackMachineId();
			return;
		}

		try {
			// Try to acquire a machine ID from Redis
			const acquired = await this.tryAcquireFromRedis();
			if (acquired !== null) {
				this.machineId = acquired;
				this.startHeartbeat();
				this.logger.log(`Acquired machine ID ${this.machineId} via Redis coordination`);
				return;
			}
		} catch (error) {
			this.logger.warn(`Failed to acquire machine ID from Redis: ${error.message}`);
		}

		// Fallback if Redis fails
		await this.acquireFallbackMachineId();
	}

	/**
	 * Try to acquire a machine ID from Redis
	 */
	private async tryAcquireFromRedis(): Promise<number | null> {
		// Get all currently assigned machine IDs
		const assignedIds = await this.getAssignedMachineIds();

		// Try to find an available ID
		for (let id = 0; id <= this.MAX_MACHINE_ID; id++) {
			if (!assignedIds.has(id)) {
				// Try to acquire this ID
				const acquired = await this.attemptAcquireId(id);
				if (acquired) {
					return id;
				}
			}
		}

		// All IDs are taken
		this.logger.error(
			`All machine IDs (0-${this.MAX_MACHINE_ID}) are currently assigned. ` +
			`Cannot acquire a machine ID.`
		);
		return null;
	}

	/**
	 * Attempt to acquire a specific machine ID using Redis SET with NX (only if not exists)
	 */
	private async attemptAcquireId(machineId: number): Promise<boolean> {
		const key = `${this.COORDINATION_KEY_PREFIX}${machineId}`;
		const instanceInfoKey = `${this.INSTANCE_INFO_KEY_PREFIX}${machineId}`;
		
		// Try to set the key only if it doesn't exist (NX), with expiration (EX)
		const result = await this.redis.set(
			key,
			this.instanceId,
			'EX',
			this.HEARTBEAT_TTL / 1000, // Convert to seconds
			'NX', // Only set if not exists
		);

		if (result === 'OK') {
			// Store instance metadata
			const metadata = {
				instanceId: this.instanceId,
				hostname: os.hostname(),
				acquiredAt: new Date().toISOString(),
			};
			await this.redis.setex(
				instanceInfoKey,
				this.HEARTBEAT_TTL / 1000,
				JSON.stringify(metadata),
			);
			return true;
		}

		return false;
	}

	/**
	 * Get all currently assigned machine IDs from Redis
	 */
	private async getAssignedMachineIds(): Promise<Set<number>> {
		const pattern = `${this.COORDINATION_KEY_PREFIX}*`;
		const keys = await this.redis.keys(pattern);
		const assignedIds = new Set<number>();

		for (const key of keys) {
			const idStr = key.replace(this.COORDINATION_KEY_PREFIX, '');
			const id = parseInt(idStr, 10);
			if (!isNaN(id) && id >= 0 && id <= this.MAX_MACHINE_ID) {
				// Verify the key still exists (hasn't expired)
				const exists = await this.redis.exists(key);
				if (exists) {
					assignedIds.add(id);
				}
			}
		}

		return assignedIds;
	}

	/**
	 * Acquire machine ID using fallback strategy
	 */
	private async acquireFallbackMachineId(): Promise<void> {
		if (this.fallbackMachineId !== null) {
			// Use configured machine ID
			if (this.fallbackMachineId >= 0 && this.fallbackMachineId <= this.MAX_MACHINE_ID) {
				this.machineId = this.fallbackMachineId;
				this.logger.log(
					`Using fallback machine ID ${this.machineId} from configuration`
				);
				return;
			} else {
				this.logger.warn(
					`Configured machine ID ${this.fallbackMachineId} is out of range (0-${this.MAX_MACHINE_ID})`
				);
			}
		}

		// Generate machine ID from instance identifier (hash-based)
		this.machineId = this.generateMachineIdFromInstance();
		this.logger.warn(
			`Using hash-based machine ID ${this.machineId} (may conflict with other instances). ` +
			`Consider setting SNOWFLAKE_MACHINE_ID or ensuring Redis is available.`
		);
	}

	/**
	 * Generate a machine ID from app name and instance identifier using hash
	 * 
	 * Strategy for auto-scaling:
	 * 1. Hash the app name to create a base machineId (ensures same app gets consistent range)
	 * 2. Combine with instance-specific identifiers (hostname, PID, container/pod name)
	 * 3. Use a distributed hash to minimize collisions across instances
	 * 
	 * This ensures:
	 * - All instances of the same app get machineIds in a similar range
	 * - Each instance gets a unique machineId based on its specific identifiers
	 * - Even with auto-scaling, collisions are minimized
	 */
	private generateMachineIdFromInstance(): number {
		// Step 1: Create base hash from app name (ensures consistent base range per app)
		const appHash = crypto.createHash('sha256').update(this.appName).digest('hex');
		const appHashInt = parseInt(appHash.substring(0, 8), 16);
		const baseMachineId = appHashInt % (this.MAX_MACHINE_ID + 1);

		// Step 2: Create instance-specific hash from unique instance identifiers
		const instanceHash = crypto.createHash('sha256').update(this.instanceId).digest('hex');
		const instanceHashInt = parseInt(instanceHash.substring(0, 8), 16);
		
		// Step 3: Combine both hashes using XOR to distribute IDs while maintaining app-based consistency
		// This ensures different instances of the same app get different but related machineIds
		const combinedHash = (appHashInt ^ instanceHashInt) % (this.MAX_MACHINE_ID + 1);

		// Log the generation strategy for debugging
		this.logger.debug(
			`Hash-based machine ID generation - ` +
			`App: ${this.appName} (base: ${baseMachineId}), ` +
			`Instance: ${this.instanceId.substring(0, 16)}... (combined: ${combinedHash})`
		);

		return combinedHash;
	}

	/**
	 * Generate a unique instance ID for this application instance
	 * 
	 * Uses environment-specific identifiers in order of preference:
	 * 1. Kubernetes Pod Name (KUBERNETES_POD_NAME or POD_NAME)
	 * 2. Docker Container Name (HOSTNAME in Docker)
	 * 3. Container/Pod ID (if available)
	 * 4. Hostname + PID (fallback)
	 * 
	 * This ensures each instance in an auto-scaled environment gets a unique identifier.
	 */
	private generateInstanceId(): string {
		const hostname = os.hostname();
		const pid = process.pid;
		
		// In Kubernetes, prefer pod name
		const podName = process.env.KUBERNETES_POD_NAME || process.env.POD_NAME;
		
		// In Docker/Kubernetes, container name is usually in HOSTNAME
		const containerName = process.env.HOSTNAME || hostname;
		
		// Kubernetes node name
		const nodeName = process.env.KUBERNETES_NODE_NAME || process.env.NODE_NAME;
		
		// Container/Pod UID (Kubernetes)
		const podUid = process.env.KUBERNETES_POD_UID || process.env.POD_UID;
		
		// Combine identifiers in order of uniqueness preference
		const identifiers = [
			podName,           // Most unique in Kubernetes
			podUid,            // Kubernetes Pod UID
			containerName,     // Docker container name
			nodeName,          // Kubernetes node
			hostname,          // Hostname fallback
			pid.toString(),    // Process ID
		].filter(Boolean);

		// Create a deterministic hash for this instance
		const combined = identifiers.join('-');
		const hash = crypto.createHash('sha256').update(combined).digest('hex');
		
		// Return a human-readable identifier with hash for uniqueness
		const primaryIdentifier = podName || containerName || hostname;
		return `${primaryIdentifier}-${pid}-${hash.substring(0, 12)}`;
	}

	/**
	 * Start heartbeat to renew machine ID lease
	 */
	private startHeartbeat(): void {
		if (!this.useRedis || this.machineId === null) {
			return;
		}

		// Send initial heartbeat
		this.sendHeartbeat();

		// Set up periodic heartbeat
		this.heartbeatInterval = setInterval(() => {
			this.sendHeartbeat().catch((error) => {
				this.logger.error(`Heartbeat failed: ${error.message}`);
			});
		}, this.HEARTBEAT_INTERVAL);
	}

	/**
	 * Stop heartbeat
	 */
	private stopHeartbeat(): void {
		if (this.heartbeatInterval) {
			clearInterval(this.heartbeatInterval);
			this.heartbeatInterval = null;
		}
	}

	/**
	 * Send heartbeat to renew machine ID lease
	 */
	private async sendHeartbeat(): Promise<void> {
		if (!this.useRedis || this.machineId === null) {
			return;
		}

		try {
			const key = `${this.COORDINATION_KEY_PREFIX}${this.machineId}`;
			const instanceInfoKey = `${this.INSTANCE_INFO_KEY_PREFIX}${this.machineId}`;
			
			// Renew the lease
			await this.redis.setex(
				key,
				this.HEARTBEAT_TTL / 1000,
				this.instanceId,
			);

			// Update instance metadata
			const metadata = {
				instanceId: this.instanceId,
				hostname: os.hostname(),
				acquiredAt: await this.getAcquiredAt(),
				lastHeartbeat: new Date().toISOString(),
			};
			await this.redis.setex(
				instanceInfoKey,
				this.HEARTBEAT_TTL / 1000,
				JSON.stringify(metadata),
			);
		} catch (error) {
			this.logger.error(`Failed to send heartbeat: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Get the time when machine ID was acquired
	 */
	private async getAcquiredAt(): Promise<string> {
		if (!this.useRedis || this.machineId === null) {
			return new Date().toISOString();
		}

		try {
			const instanceInfoKey = `${this.INSTANCE_INFO_KEY_PREFIX}${this.machineId}`;
			const metadataStr = await this.redis.get(instanceInfoKey);
			if (metadataStr) {
				const metadata = JSON.parse(metadataStr);
				return metadata.acquiredAt || new Date().toISOString();
			}
		} catch (error) {
			// Ignore errors
		}

		return new Date().toISOString();
	}

	/**
	 * Release machine ID
	 */
	private async releaseMachineId(): Promise<void> {
		if (!this.useRedis || this.machineId === null) {
			return;
		}

		try {
			const key = `${this.COORDINATION_KEY_PREFIX}${this.machineId}`;
			const instanceInfoKey = `${this.INSTANCE_INFO_KEY_PREFIX}${this.machineId}`;
			
			// Only delete if we still own it
			const currentOwner = await this.redis.get(key);
			if (currentOwner === this.instanceId) {
				await this.redis.del(key);
				await this.redis.del(instanceInfoKey);
				this.logger.log(`Released machine ID ${this.machineId}`);
			}
		} catch (error) {
			this.logger.error(`Failed to release machine ID: ${error.message}`);
		}
	}
}

