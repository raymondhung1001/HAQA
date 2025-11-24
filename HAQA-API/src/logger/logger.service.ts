import { Injectable, Inject } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { RequestContextService } from '@/context/request-context.service';
import { sanitizeObject } from '@/utils/sanitize.util';

/**
 * LoggerService provides enhanced logging with automatic requestId and userId inclusion.
 * 
 * Usage example:
 * ```typescript
 * constructor(private readonly logger: LoggerService) {}
 * 
 * async someMethod() {
 *   this.logger.enter('someMethod');
 *   try {
 *     // your code here
 *     this.logger.info('Processing data', { userId: 123 });
 *   } finally {
 *     this.logger.leave('someMethod');
 *   }
 * }
 * ```
 * 
 * All logger methods (enter, leave, debug, info, warn, error) automatically include:
 * - requestId: Unique ID for the HTTP request
 * - userId: ID of the authenticated user (if available)
 */
@Injectable()
export class LoggerService {
    constructor(
        @Inject(PinoLogger)
        private readonly logger: PinoLogger,
        private readonly requestContextService: RequestContextService,
    ) {}

    private getLogContext(additionalContext?: Record<string, any>): Record<string, any> {
        const context = this.requestContextService.getContext();
        const baseContext: Record<string, any> = {};

        if (context?.requestId) {
            baseContext.requestId = context.requestId;
        }

        if (context?.userId) {
            baseContext.userId = context.userId;
        }

        const mergedContext = { ...baseContext, ...additionalContext };
        // Sanitize sensitive fields in the context
        return sanitizeObject(mergedContext);
    }

    enter(methodName: string, additionalContext?: Record<string, any>): void {
        const context = this.getLogContext({
            method: methodName,
            event: 'enter',
            ...additionalContext,
        });
        this.logger.debug(context, `Entering: ${methodName}`);
    }

    leave(methodName: string, additionalContext?: Record<string, any>): void {
        const context = this.getLogContext({
            method: methodName,
            event: 'leave',
            ...additionalContext,
        });
        this.logger.debug(context, `Leaving: ${methodName}`);
    }

    debug(message: string, additionalContext?: Record<string, any>): void {
        const context = this.getLogContext(additionalContext);
        this.logger.debug(context, message);
    }

    info(message: string, additionalContext?: Record<string, any>): void {
        const context = this.getLogContext(additionalContext);
        this.logger.info(context, message);
    }

    warn(message: string, additionalContext?: Record<string, any>): void {
        const context = this.getLogContext(additionalContext);
        this.logger.warn(context, message);
    }

    error(message: string, error?: Error | any, additionalContext?: Record<string, any>): void {
        const context = this.getLogContext({
            ...additionalContext,
            ...(error instanceof Error
                ? {
                      error: error.message,
                      stack: error.stack,
                  }
                : error
                  ? { error: String(error) }
                  : {}),
        });
        this.logger.error(context, message);
    }
}

