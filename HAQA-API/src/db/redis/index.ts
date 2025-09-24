import { createClient } from 'redis';
import type { RedisClientType } from 'redis';

export type RedisClient = RedisClientType;

export async function setup(redisUrl: string): Promise<RedisClient> {

    const redisClient: RedisClient = createClient({
        url: redisUrl,
        socket: {
            reconnectStrategy: (retries) => {
                console.log(`Redis reconnect attempt: ${retries}`);
                return Math.min(retries * 50, 10000);
            },
        },
    });

    redisClient.on('connect', () => {
        console.log('Redis client connected');
    });

    return redisClient;

}
