import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LoggerService } from '@/logger';
import { LOG_METADATA_KEY } from '@/decorators/log.decorator';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
    constructor(
        private readonly reflector: Reflector,
        private readonly logger: LoggerService,
    ) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const logMetadata = this.reflector.getAllAndOverride<string | boolean>(
            LOG_METADATA_KEY,
            [context.getHandler(), context.getClass()],
        );

        // If no @Log() decorator is present, skip logging
        if (!logMetadata) {
            return next.handle();
        }

        // Get method name
        const handler = context.getHandler();
        const className = context.getClass().name;
        const methodName =
            typeof logMetadata === 'string'
                ? logMetadata
                : `${className}.${handler.name}`;

        // Get method arguments for logging
        const args = context.getArgs();
        const request = args.find((arg) => arg && typeof arg === 'object' && 'method' in arg);
        const methodArgs = this.sanitizeArgs(args);

        // Log entry
        this.logger.enter(methodName, {
            className,
            ...(methodArgs && Object.keys(methodArgs).length > 0 && { args: methodArgs }),
        });

        const startTime = Date.now();

        // Handle the request and log exit
        return next.handle().pipe(
            tap({
                next: (data) => {
                    const duration = Date.now() - startTime;
                    this.logger.leave(methodName, {
                        className,
                        duration: `${duration}ms`,
                        success: true,
                    });
                },
                error: (error) => {
                    const duration = Date.now() - startTime;
                    this.logger.leave(methodName, {
                        className,
                        duration: `${duration}ms`,
                        success: false,
                        error: error?.message || String(error),
                    });
                },
            }),
        );
    }

    private sanitizeArgs(args: any[]): Record<string, any> | undefined {
        // Filter out common NestJS objects that shouldn't be logged
        const filtered = args.filter(
            (arg) =>
                arg !== null &&
                arg !== undefined &&
                typeof arg === 'object' &&
                !('method' in arg) && // Exclude Request objects
                !('statusCode' in arg) && // Exclude Response objects
                !('getRequest' in arg) && // Exclude ExecutionContext
                !('switchToHttp' in arg),
        );

        if (filtered.length === 0) {
            return undefined;
        }

        // Convert to a simple object representation
        const result: Record<string, any> = {};
        filtered.forEach((arg, index) => {
            try {
                // Try to serialize, but limit depth and size
                const serialized = JSON.parse(JSON.stringify(arg, this.getCircularReplacer(), 2));
                result[`arg${index}`] = serialized;
            } catch {
                // If serialization fails, just use type name
                result[`arg${index}`] = `[${typeof arg}]`;
            }
        });

        return result;
    }

    private getCircularReplacer() {
        const seen = new WeakSet();
        return (key: string, value: any) => {
            if (typeof value === 'object' && value !== null) {
                if (seen.has(value)) {
                    return '[Circular]';
                }
                seen.add(value);
            }
            // Limit string length
            if (typeof value === 'string' && value.length > 200) {
                return value.substring(0, 200) + '...';
            }
            return value;
        };
    }
}

