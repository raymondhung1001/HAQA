import type { Context, Next } from "hono";
import { errorResponse, ErrorType } from "@/util/apiResponseUtil";
import { ApiException } from '@/exception';
import jwt from "jsonwebtoken"; 
import redisSchema from "@/db/redis/types";

export async function authorizationMiddleware(c: Context, next: Next) {

    try {
        
        const authHeader = c.req.header('Authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return errorResponse(
                c,
                ErrorType.UNAUTHORIZED,
                'Authorization header missing or invalid format'
            );
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        if (!token || token.trim() === '') {
            return errorResponse(
                c,
                ErrorType.UNAUTHORIZED,
                'Empty token provided'
            );
        }

        try {
            
            const decoded = jwt.decode(token) as { sub: string, jti: string } | null;

            if (!decoded || !decoded.sub) {
                return errorResponse(
                    c,
                    ErrorType.UNAUTHORIZED,
                    'Invalid token format'
                );
            }

            const userId = decoded.sub;
            const deviceId = c.req.header('X-Device-ID');

            const redisKey = redisSchema.AUTH.KEYS.JWT(userId, deviceId);  
            const storedToken = await redis.hget(redisKey, redisSchema.AUTH.FIELDS.JWT.TOKEN);


        } catch (err) {
            console.error('Token verification failed', err);
        }

        await next();

    } catch (error) {
        if (error instanceof ApiException) {
            return errorResponse(c, error.type, error.message, error.details);
        }

        return errorResponse(
            c,
            ErrorType.UNAUTHORIZED,
            error instanceof Error ? error.message : 'Authorization failed'
        );
    }
}