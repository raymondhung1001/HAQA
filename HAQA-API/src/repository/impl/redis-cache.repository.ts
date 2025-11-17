import { RedisService, DEFAULT_REDIS } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ICacheRepository } from '../cache-repository.interface';

export type RedisNamespaceKey = 'auth';

@Injectable()
export abstract class RedisCacheRepository<T> implements ICacheRepository<T> {

    protected readonly redis: Redis;
    protected abstract readonly prefix: string;
    protected abstract readonly namespaceKey: RedisNamespaceKey;
    protected readonly ttl: number = 3600;
    protected namespace: string;

    constructor(
        private readonly redisService: RedisService,
        protected readonly configService: ConfigService
    ) {
        this.redis = this.redisService.getOrThrow();
        // Namespace will be initialized lazily via getter
        this.namespace = '' as string; // Temporary placeholder
    }

    private getNamespace(): string {
        const namespaceKey = this.namespaceKey;
        if (!namespaceKey) {
            throw new Error('namespaceKey must be defined in child class');
        }
        
        const namespaceMap: Record<RedisNamespaceKey, string> = {
            auth: this.configService.get('REDIS_NAMESPACE_AUTH', 'auth'),
        };

        const baseNamespace = namespaceMap[namespaceKey];
        if (!baseNamespace) {
            throw new Error(`Invalid namespaceKey: ${namespaceKey}. Namespace could not be determined.`);
        }
        // const env = this.configService.get('NODE_ENV', 'development');

        // return env === 'production' ? baseNamespace : `${env}:${baseNamespace}`;
        return baseNamespace;
    }

    protected getNamespaceValue(): string {
        if (!this.namespace || this.namespace === '') {
            // Lazy initialization - namespaceKey is now available
            this.namespace = this.getNamespace();
        }
        return this.namespace;
    }

    protected getCacheKey(id: string): string {
        return `${this.getNamespaceValue()}:${this.prefix}:${id}`;
    }

    protected getIndexKey(): string {
        return `${this.getNamespaceValue()}:${this.prefix}:index`;
    }

    async get(id: string): Promise<T | null> {
        const key = this.getCacheKey(id);
        const data = await this.redis.get(key);

        if (!data) {
            return null;
        }

        return JSON.parse(data) as T;
    }

    async getAll(): Promise<T[]> {
        const indexKey = this.getIndexKey();
        const ids = await this.redis.smembers(indexKey);

        if (!ids || ids.length === 0) {
            return [];
        }

        return this.getMany(ids);
    }

    async getMany(ids: string[]): Promise<T[]> {
        if (ids.length === 0) {
            return [];
        }

        const pipeline = this.redis.pipeline();
        ids.forEach(id => pipeline.get(this.getCacheKey(id)));

        const results = await pipeline.exec();

        if (!results) {
            return [];
        }

        return results
            .map(([err, data]) => {
                if (err || !data) return null;
                return JSON.parse(data as string) as T;
            })
            .filter((item): item is T => item !== null);
    }

    async set(id: string, entity: T, ttl?: number): Promise<T> {
        const key = this.getCacheKey(id);
        const data = JSON.stringify(entity);
        const expiry = ttl || this.ttl;

        const pipeline = this.redis.pipeline();
        pipeline.set(key, data, 'EX', expiry);
        pipeline.sadd(this.getIndexKey(), id);

        await pipeline.exec();

        return entity;
    }

    async update(id: string, entity: Partial<T>): Promise<T | null> {
        const key = this.getCacheKey(id);
        const existing = await this.get(id);

        if (!existing) {
            return null;
        }

        const updated = { ...existing, ...entity };
        const ttl = await this.redis.ttl(key);

        if (ttl > 0) {
            await this.redis.set(key, JSON.stringify(updated), 'EX', ttl);
        } else {
            await this.redis.set(key, JSON.stringify(updated), 'EX', this.ttl);
        }

        return updated;
    }

    async delete(id: string): Promise<boolean> {
        const key = this.getCacheKey(id);
        const exists = await this.exists(id);

        if (!exists) {
            return false;
        }

        const pipeline = this.redis.pipeline();
        pipeline.del(key);
        pipeline.srem(this.getIndexKey(), id);

        await pipeline.exec();

        return true;
    }

    async exists(id: string): Promise<boolean> {
        const key = this.getCacheKey(id);
        const result = await this.redis.exists(key);
        return result === 1;
    }

    async invalidate(): Promise<void> {
        const indexKey = this.getIndexKey();
        const ids = await this.redis.smembers(indexKey);

        if (ids.length === 0) {
            return;
        }

        const keys = ids.map(id => this.getCacheKey(id));
        keys.push(indexKey);

        await this.redis.del(...keys);
    }

    async size(): Promise<number> {
        const indexKey = this.getIndexKey();
        return this.redis.scard(indexKey);
    }

    // Helper method to set TTL on existing key
    async setTtl(id: string, ttl: number): Promise<boolean> {
        const key = this.getCacheKey(id);
        const result = await this.redis.expire(key, ttl);
        return result === 1;
    }

    // Helper method to get remaining TTL
    async getTtl(id: string): Promise<number> {
        const key = this.getCacheKey(id);
        return this.redis.ttl(key);
    }
}