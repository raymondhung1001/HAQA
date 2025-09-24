import { setup } from '@/db/redis';
import type { Context, Next } from 'hono';

if (!process.env.REDIS_URL) {
    throw new Error('REDIS_URL environment variable is required');
}

const redisClient = setup(process.env.REDIS_URL);

export async function redisMiddleware(c: Context, next: Next) {
    c.set("redisClient", redisClient);
    await next();
}
