import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { RedisCacheRepository } from './redis-cache.repository';

import { AuthCacheEntity } from '@/redis-entities/AuthCacheEntity';

@Injectable()
export class AuthCacheRepository extends RedisCacheRepository<AuthCacheEntity> {
    protected readonly prefix = 'token';
    protected readonly namespaceKey = 'auth' as const;
    protected readonly ttl = 3600;

    constructor(
        redisService: RedisService,
        configService: ConfigService
    ) {
        super(redisService, configService);
    }

    async setAuthToken(
        userId: string,
        authData: AuthCacheEntity,
        ttl?: number
    ): Promise<AuthCacheEntity> {
        return this.set(userId, authData, ttl);
    }

    async getAuthToken(userId: string): Promise<AuthCacheEntity | null> {
        return this.get(userId);
    }

    async setRefreshToken(
        userId: string,
        refreshToken: string,
        ttl: number = 604800
    ): Promise<void> {
        const namespace = this.getNamespaceValue();
        const refreshKey = `${namespace}:refresh:${userId}`;
        await this.redis.set(refreshKey, refreshToken, 'EX', ttl);
    }

    async getRefreshToken(userId: string): Promise<string | null> {
        const namespace = this.getNamespaceValue();
        const refreshKey = `${namespace}:refresh:${userId}`;
        return this.redis.get(refreshKey);
    }

    async deleteRefreshToken(userId: string): Promise<boolean> {
        const namespace = this.getNamespaceValue();
        const refreshKey = `${namespace}:refresh:${userId}`;
        const result = await this.redis.del(refreshKey);
        return result === 1;
    }

    async invalidateUserSessions(userId: string): Promise<void> {
        await Promise.all([
            this.delete(userId),
            this.deleteRefreshToken(userId)
        ]);
    }

    async setUserSession(
        userId: string,
        sessionId: string,
        authData: AuthCacheEntity,
        ttl?: number
    ): Promise<AuthCacheEntity> {
        const sessionKey = `${userId}:${sessionId}`;
        return this.set(sessionKey, authData, ttl);
    }

    async getUserSession(
        userId: string,
        sessionId: string
    ): Promise<AuthCacheEntity | null> {
        const sessionKey = `${userId}:${sessionId}`;
        return this.get(sessionKey);
    }

    async deleteUserSession(userId: string, sessionId: string): Promise<boolean> {
        const sessionKey = `${userId}:${sessionId}`;
        return this.delete(sessionKey);
    }

    async getUserSessions(userId: string): Promise<AuthCacheEntity[]> {
        const indexKey = this.getIndexKey();
        const allIds = await this.redis.smembers(indexKey);
        const userSessionIds = allIds.filter(id => id.startsWith(`${userId}:`));

        if (userSessionIds.length === 0) {
            return [];
        }

        return this.getMany(userSessionIds);
    }

    async updateLastActivity(userId: string, sessionId?: string): Promise<void> {
        const id = sessionId ? `${userId}:${sessionId}` : userId;
        const existing = await this.get(id);

        if (existing) {
            await this.update(id, {
                ...existing,
                issuedAt: Date.now()
            });
        }
    }

}