import { Injectable, NestMiddleware, Inject } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
    constructor(
        @Inject(PinoLogger)
        private readonly logger: PinoLogger,
    ) {}

    use(req: Request, res: Response, next: NextFunction) {
        const { method, originalUrl, ip } = req;
        const userAgent = req.get('user-agent') || '';
        const requestId = this.getRequestId(req);
        const startTime = Date.now();

        // Log incoming request
        this.logger.info(
            {
                requestId,
                method,
                url: originalUrl,
                ip,
                userAgent,
            },
            `Incoming request: ${method} ${originalUrl}`,
        );

        // Log response when finished
        res.on('finish', () => {
            const { statusCode } = res;
            const contentLength = res.get('content-length') || 0;
            const duration = Date.now() - startTime;

            const logData = {
                requestId,
                method,
                url: originalUrl,
                statusCode,
                contentLength: parseInt(contentLength as string, 10) || 0,
                duration: `${duration}ms`,
            };

            if (statusCode >= 500) {
                this.logger.error(logData, `Request failed: ${method} ${originalUrl} ${statusCode}`);
            } else if (statusCode >= 400) {
                this.logger.warn(logData, `Request warning: ${method} ${originalUrl} ${statusCode}`);
            } else {
                this.logger.info(logData, `Request completed: ${method} ${originalUrl} ${statusCode}`);
            }
        });

        next();
    }

    private getRequestId(request: Request): string | undefined {
        return (
            (request.headers['x-request-id'] as string) ||
            (request.headers['x-correlation-id'] as string) ||
            (request as any).id
        );
    }
}

