import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
    use(req: Request, res: Response, next: NextFunction) {
        // Check if request ID already exists in headers
        const existingRequestId =
            (req.headers['x-request-id'] as string) ||
            (req.headers['x-correlation-id'] as string);

        // Generate a new request ID if one doesn't exist
        const requestId = existingRequestId || randomUUID();

        // Attach request ID to request object and headers
        (req as any).id = requestId;
        req.headers['x-request-id'] = requestId;

        // Add request ID to response headers
        res.setHeader('x-request-id', requestId);

        next();
    }
}

