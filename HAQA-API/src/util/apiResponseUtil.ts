import type { Context, Handler } from 'hono';
import type { StatusCode } from 'hono/utils/http-status';
import { ApiException } from '@/exception';

export enum ErrorType {
    BAD_REQUEST = 'BAD_REQUEST',
    UNAUTHORIZED = 'UNAUTHORIZED',
    FORBIDDEN = 'FORBIDDEN',
    NOT_FOUND = 'NOT_FOUND',
    CONFLICT = 'CONFLICT',
    INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
    SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
    GATEWAY_TIMEOUT = 'GATEWAY_TIMEOUT'
}

export interface ApiError {
    type: ErrorType;
    message: string;
    details?: Record<string, any>;
}

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: ApiError;
    statusCode: number;
}

export function successResponse<T>(c: Context, data: T, statusCode: StatusCode = 200): Response {
    const response: ApiResponse<T> = {
        success: true,
        data,
        statusCode
    }
    return c.json(response, statusCode as any)
}

export function errorResponse(
    c: Context,
    errorType: ErrorType,
    message: string,
    details?: Record<string, any>
): Response {
    const errorStatusCodes: Record<ErrorType, StatusCode> = {
        [ErrorType.BAD_REQUEST]: 400,
        [ErrorType.UNAUTHORIZED]: 401,
        [ErrorType.FORBIDDEN]: 403,
        [ErrorType.NOT_FOUND]: 404,
        [ErrorType.CONFLICT]: 409,
        [ErrorType.INTERNAL_SERVER_ERROR]: 500,
        [ErrorType.SERVICE_UNAVAILABLE]: 503,
        [ErrorType.GATEWAY_TIMEOUT]: 504
    }

    const statusCode = errorStatusCodes[errorType] || 500

    const error: ApiError = {
        type: errorType,
        message,
        ...(details && { details })
    }

    const response: ApiResponse<null> = {
        success: false,
        error,
        statusCode
    }

    return c.json(response, statusCode as any)
}

export function withApiResponse<T>(
    handler: (c: Context) => Promise<T> | T,
    statusCode: StatusCode = 200
): Handler {
    return async (c: Context) => {
        try {
            const result = await handler(c);

            if (result === undefined || result === null) {
                return c.json({ success: true, statusCode: 204 });
            }

            return successResponse(c, result, statusCode);

        } catch (error) {
            if (error instanceof ApiException) {
                return errorResponse(c, error.type, error.message, error.details);
            }

            console.error('Unhandled error:', error);
            return errorResponse(
                c,
                ErrorType.INTERNAL_SERVER_ERROR,
                'An unexpected error occurred'
            );
        }
    };
}