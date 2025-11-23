import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request, Response } from 'express';
import { SKIP_TRANSFORM_KEY } from '@/decorators/skip-transform.decorator';

export interface SuccessResponse<T> {
    success: true;
    statusCode: number;
    data: T;
    timestamp: string;
    path: string;
    method: string;
    requestId?: string;
    message?: string;
}

interface RequestWithId extends Omit<Request, 'id'> {
    id?: string;
}

/**
 * Transform interceptor that wraps successful responses in a standardized format.
 * 
 * Best practices implemented:
 * - Checks for skip transformation decorator
 * - Prevents double-wrapping of already formatted responses
 * - Handles edge cases (null, undefined, streams)
 * - Properly extracts request ID with type safety
 * - Supports pagination responses
 * - Only transforms JSON responses
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, SuccessResponse<T> | T> {
    constructor(private readonly reflector: Reflector) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<SuccessResponse<T> | T> {
        const ctx = context.switchToHttp();
        const request = ctx.getRequest<RequestWithId>();
        const response = ctx.getResponse<Response>();

        // Check if transformation should be skipped
        const skipTransform = this.reflector.getAllAndOverride<boolean>(SKIP_TRANSFORM_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (skipTransform) {
            return next.handle();
        }

        const requestId = this.getRequestId(request);

        return next.handle().pipe(
            map((data) => {
                // Don't transform if response is already in SuccessResponse format
                if (this.isAlreadyFormatted(data)) {
                    return data;
                }

                // Don't transform non-JSON responses (streams, redirects, etc.)
                if (!this.shouldTransform(response)) {
                    return data;
                }

                const statusCode = response.statusCode || 200;

                // Handle pagination responses
                if (this.isPaginationResponse(data)) {
                    return this.transformPaginationResponse(data, statusCode, request, requestId);
                }

                // Extract message if data has a message property and it's a simple response wrapper
                const { data: transformedData, message } = this.extractMessage(data);

                const successResponse: SuccessResponse<T> = {
                    success: true,
                    statusCode,
                    data: transformedData as T,
                    timestamp: new Date().toISOString(),
                    path: request.url,
                    method: request.method,
                    ...(requestId && { requestId }),
                    ...(message && { message }),
                };

                return successResponse;
            }),
        );
    }

    /**
     * Checks if the response is already in SuccessResponse format
     */
    private isAlreadyFormatted(data: any): boolean {
        return (
            data &&
            typeof data === 'object' &&
            'success' in data &&
            'statusCode' in data &&
            'data' in data &&
            'timestamp' in data
        );
    }

    /**
     * Determines if the response should be transformed
     * Skips transformation for non-JSON responses (streams, redirects, etc.)
     */
    private shouldTransform(response: Response): boolean {
        const contentType = response.getHeader('content-type');
        
        // Don't transform if content-type is not JSON or is explicitly set to something else
        if (contentType && typeof contentType === 'string' && !contentType.includes('application/json')) {
            return false;
        }

        // Don't transform redirects or other special status codes
        if (response.statusCode >= 300 && response.statusCode < 400) {
            return false;
        }

        return true;
    }

    /**
     * Checks if the data is a pagination response
     */
    private isPaginationResponse(data: any): boolean {
        return (
            data &&
            typeof data === 'object' &&
            'items' in data &&
            ('total' in data || 'count' in data || 'page' in data || 'limit' in data)
        );
    }

    /**
     * Transforms pagination responses while preserving pagination metadata
     */
    private transformPaginationResponse(
        data: any,
        statusCode: number,
        request: RequestWithId,
        requestId?: string,
    ): SuccessResponse<any> {
        const { items, ...paginationMeta } = data;
        const { data: transformedItems, message } = this.extractMessage(items);

        return {
            success: true,
            statusCode,
            data: {
                items: transformedItems,
                ...paginationMeta,
            },
            timestamp: new Date().toISOString(),
            path: request.url,
            method: request.method,
            ...(requestId && { requestId }),
            ...(message && { message }),
        };
    }

    /**
     * Extracts message from data if it's a simple wrapper object
     * Only extracts if data has a message property and other common wrapper properties
     */
    private extractMessage(data: any): { data: any; message?: string } {
        if (!data || typeof data !== 'object') {
            return { data };
        }

        // Check if this looks like a simple response wrapper (e.g., { message: '...', data: {...} })
        const hasMessage = 'message' in data;
        const hasData = 'data' in data;
        const keys = Object.keys(data);

        // If it's a simple wrapper with message and data, extract both
        if (hasMessage && hasData && keys.length === 2) {
            return {
                data: data.data,
                message: typeof data.message === 'string' ? data.message : undefined,
            };
        }

        // If it only has a message and one other property, don't extract (likely part of the data)
        // Only extract if message is the only additional property in a simple object
        if (hasMessage && keys.length <= 3) {
            // Check if other properties are standard response fields
            const standardFields = ['statusCode', 'success', 'timestamp', 'path', 'method'];
            const hasOnlyStandardFields = keys.every(
                (key) => key === 'message' || standardFields.includes(key),
            );

            if (!hasOnlyStandardFields) {
                // Message is likely part of the data, don't extract
                return { data };
            }
        }

        // Don't extract message if it's clearly part of the data structure
        return { data };
    }

    /**
     * Safely extracts request ID from request object
     */
    private getRequestId(request: RequestWithId): string | undefined {
        return (
            (request.headers['x-request-id'] as string) ||
            (request.headers['x-correlation-id'] as string) ||
            request.id
        );
    }
}

