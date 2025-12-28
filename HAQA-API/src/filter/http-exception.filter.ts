import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    BadRequestException,
    Inject,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError, EntityNotFoundError } from 'typeorm';
import { PinoLogger } from 'nestjs-pino';

export interface ErrorResponse {
    success: false;
    statusCode: number;
    message: string | string[];
    error?: string;
    errorCode?: string;
    timestamp: string;
    path: string;
    method: string;
    requestId?: string;
    validationErrors?: ValidationError[];
    details?: any;
}

export interface ValidationError {
    field: string;
    message: string;
    value?: any;
    constraints?: Record<string, string>;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
    constructor(
        @Inject(PinoLogger)
        private readonly logger: PinoLogger,
    ) {}

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        const requestId = this.getRequestId(request);
        const { status, message, error, errorCode, validationErrors, details } =
            this.extractExceptionInfo(exception, request);

        const errorResponse: ErrorResponse = {
            success: false,
            statusCode: status,
            message,
            error,
            errorCode,
            timestamp: new Date().toISOString(),
            path: request.url,
            method: request.method,
            ...(requestId && { requestId }),
            ...(validationErrors && validationErrors.length > 0 && { validationErrors }),
            ...(details && Object.keys(details).length > 0 && { details }),
        };

        this.logError(exception, request, status, message, requestId);

        // Ensure request ID is in response headers for client correlation
        if (requestId) {
            response.setHeader('x-request-id', requestId);
        }

        response.status(status).json(errorResponse);
    }

    private extractExceptionInfo(
        exception: unknown,
        _request: Request,
    ): {
        status: number;
        message: string | string[];
        error?: string;
        errorCode?: string;
        validationErrors?: ValidationError[];
        details?: any;
    } {
        if (exception instanceof HttpException) {
            return this.handleHttpException(exception);
        }

        // if (exception instanceof QueryFailedError) {
        //     return this.handleQueryFailedError(exception);
        // }

        if (exception instanceof EntityNotFoundError) {
            return this.handleEntityNotFoundError(exception);
        }

        if (this.isRedisError(exception)) {
            return this.handleRedisError(exception);
        }

        if (exception instanceof Error) {
            return this.handleGenericError(exception);
        }

        return {
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'An unexpected error occurred',
            error: 'UnknownError',
            errorCode: 'UNKNOWN_ERROR',
        };
    }

    private handleHttpException(exception: HttpException): {
        status: number;
        message: string | string[];
        error?: string;
        errorCode?: string;
        validationErrors?: ValidationError[];
        details?: any;
    } {
        const status = exception.getStatus();
        const exceptionResponse = exception.getResponse();
        let message: string | string[];
        let error: string | undefined;
        let errorCode: string | undefined;
        let validationErrors: ValidationError[] | undefined;
        let details: any | undefined;

        if (typeof exceptionResponse === 'string') {
            message = exceptionResponse;
            error = exception.name;
        } else if (typeof exceptionResponse === 'object') {
            const responseObj = exceptionResponse as any;
            message = responseObj.message || exception.message;
            error = responseObj.error || exception.name;

            // Handle validation errors from class-validator
            if (Array.isArray(message) && exception instanceof BadRequestException) {
                validationErrors = this.formatValidationErrors(message, responseObj);
                errorCode = 'VALIDATION_ERROR';
                // Convert array to a more user-friendly message
                message = 'Validation failed';
            } else if (responseObj.message && Array.isArray(responseObj.message)) {
                validationErrors = this.formatValidationErrors(responseObj.message, responseObj);
                errorCode = 'VALIDATION_ERROR';
                message = 'Validation failed';
            }

            // Extract error code if present
            if (responseObj.errorCode) {
                errorCode = responseObj.errorCode;
            }

            // Extract details if present
            if (responseObj.details) {
                details = responseObj.details;
            }
        } else {
            message = exception.message;
            error = exception.name;
        }

        // Generate error code from exception name if not provided
        if (!errorCode) {
            errorCode = this.generateErrorCode(exception.name);
        }

        return {
            status,
            message,
            error,
            errorCode,
            validationErrors,
            details,
        };
    }

    private handleQueryFailedError(exception: QueryFailedError): {
        status: number;
        message: string | string[];
        error?: string;
        errorCode?: string;
        details?: any;
    } {
        const driverError = (exception as any).driverError;
        const query = (exception as any).query;
        const parameters = (exception as any).parameters;

        let status = HttpStatus.BAD_REQUEST;
        let message = 'Database query failed';
        let error = 'QueryFailedError';
        let errorCode = 'DATABASE_QUERY_ERROR';
        const details: any = {};

        if (driverError) {
            const dbErrorCode = driverError.code;
            const errorDetail = driverError.detail || '';
            const errorTable = driverError.table || this.extractTableFromQuery(query);
            const errorConstraint = this.extractConstraintFromDetail(errorDetail);

            switch (dbErrorCode) {
                case '23505': // Unique constraint violation
                    message = this.formatUniqueConstraintMessage(errorConstraint, errorTable);
                    error = 'UniqueConstraintViolation';
                    errorCode = 'UNIQUE_CONSTRAINT_VIOLATION';
                    status = HttpStatus.CONFLICT;
                    if (errorConstraint) {
                        details.constraint = errorConstraint;
                    }
                    if (errorTable) {
                        details.table = errorTable;
                    }
                    break;

                case '23503': // Foreign key constraint violation
                    message = 'Referenced record does not exist or cannot be deleted';
                    error = 'ForeignKeyConstraintViolation';
                    errorCode = 'FOREIGN_KEY_CONSTRAINT_VIOLATION';
                    status = HttpStatus.BAD_REQUEST;
                    if (errorConstraint) {
                        details.constraint = errorConstraint;
                    }
                    if (errorTable) {
                        details.table = errorTable;
                    }
                    break;

                case '23502': // Not null constraint violation
                    const column = this.extractColumnFromDetail(errorDetail);
                    message = column
                        ? `Field '${column}' is required`
                        : 'Required field is missing';
                    error = 'NotNullConstraintViolation';
                    errorCode = 'NOT_NULL_CONSTRAINT_VIOLATION';
                    status = HttpStatus.BAD_REQUEST;
                    if (column) {
                        details.column = column;
                    }
                    if (errorTable) {
                        details.table = errorTable;
                    }
                    break;

                case '23514': // Check constraint violation
                    message = 'Data validation failed against database constraints';
                    error = 'CheckConstraintViolation';
                    errorCode = 'CHECK_CONSTRAINT_VIOLATION';
                    status = HttpStatus.BAD_REQUEST;
                    if (errorConstraint) {
                        details.constraint = errorConstraint;
                    }
                    break;

                case '42P01': // Undefined table
                    message = 'Database table does not exist';
                    error = 'UndefinedTable';
                    errorCode = 'UNDEFINED_TABLE';
                    status = HttpStatus.INTERNAL_SERVER_ERROR;
                    break;

                case '42703': // Undefined column
                    message = 'Database column does not exist';
                    error = 'UndefinedColumn';
                    errorCode = 'UNDEFINED_COLUMN';
                    status = HttpStatus.INTERNAL_SERVER_ERROR;
                    break;

                default:
                    message = driverError.message || message;
                    if (dbErrorCode) {
                        details.databaseErrorCode = dbErrorCode;
                    }
            }
        }

        // Include query details only in development
        if (process.env.NODE_ENV === 'development') {
            if (query) {
                details.query = query;
            }
            if (parameters) {
                details.parameters = parameters;
            }
        }

        return {
            status,
            message,
            error,
            errorCode,
            details: Object.keys(details).length > 0 ? details : undefined,
        };
    }

    private handleEntityNotFoundError(exception: EntityNotFoundError): {
        status: number;
        message: string | string[];
        error?: string;
        errorCode?: string;
    } {
        const entityName = (exception as any).entityClass?.name || 'Entity';
        return {
            status: HttpStatus.NOT_FOUND,
            message: `${entityName} not found`,
            error: 'EntityNotFoundError',
            errorCode: 'ENTITY_NOT_FOUND',
        };
    }

    private handleRedisError(exception: any): {
        status: number;
        message: string | string[];
        error?: string;
        errorCode?: string;
        details?: any;
    } {
        const details: any = {};

        if (exception.code === 'ECONNREFUSED') {
            return {
                status: HttpStatus.SERVICE_UNAVAILABLE,
                message: 'Cache service is unavailable',
                error: 'RedisConnectionError',
                errorCode: 'CACHE_UNAVAILABLE',
            };
        }

        if (exception.message) {
            details.redisError = exception.message;
        }

        return {
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'Cache operation failed',
            error: 'RedisError',
            errorCode: 'CACHE_ERROR',
            details: Object.keys(details).length > 0 ? details : undefined,
        };
    }

    private handleGenericError(exception: Error): {
        status: number;
        message: string | string[];
        error?: string;
        errorCode?: string;
        details?: any;
    } {
        const details: any = {};

        // Only include stack trace in development
        if (process.env.NODE_ENV === 'development' && exception.stack) {
            details.stack = exception.stack.split('\n').slice(0, 10); // Limit stack trace lines
        }

        return {
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            message: exception.message || 'Internal server error',
            error: exception.name || 'Error',
            errorCode: this.generateErrorCode(exception.name || 'Error'),
            details: Object.keys(details).length > 0 ? details : undefined,
        };
    }

    private formatValidationErrors(
        messages: string[],
        responseObj: any,
    ): ValidationError[] {
        // Handle class-validator error format
        if (responseObj.message && Array.isArray(responseObj.message)) {
            return responseObj.message.map((msg: any) => {
                if (typeof msg === 'string') {
                    // Simple string message - try to extract field name
                    const fieldMatch = msg.match(/^(\w+)\s/);
                    return {
                        field: fieldMatch ? fieldMatch[1] : 'unknown',
                        message: msg,
                    };
                } else if (typeof msg === 'object' && msg.property) {
                    // Proper validation error object
                    return {
                        field: msg.property,
                        message: Object.values(msg.constraints || {})[0] as string || msg.toString(),
                        value: msg.value,
                        constraints: msg.constraints,
                    };
                }
                return {
                    field: 'unknown',
                    message: String(msg),
                };
            });
        }

        // Fallback for simple string arrays
        return messages.map((msg) => ({
            field: 'unknown',
            message: msg,
        }));
    }

    private formatUniqueConstraintMessage(
        constraint: string | null,
        _table: string | null,
    ): string {
        if (constraint) {
            // Try to extract field name from constraint (e.g., "users_username_uk" -> "username")
            const fieldMatch = constraint.match(/_(\w+)_(uk|unique|key)/i);
            if (fieldMatch) {
                return `A record with this ${fieldMatch[1]} already exists`;
            }
            // Try to extract from constraint detail message
            const detailMatch = constraint.match(/\((\w+)\)=/);
            if (detailMatch) {
                return `A record with this ${detailMatch[1]} already exists`;
            }
        }
        return 'A record with this value already exists';
    }

    private extractTableFromQuery(query?: string): string | null {
        if (!query) return null;
        const match = query.match(/FROM\s+["']?(\w+)["']?/i) ||
            query.match(/INTO\s+["']?(\w+)["']?/i) ||
            query.match(/UPDATE\s+["']?(\w+)["']?/i);
        return match ? match[1] : null;
    }

    private extractConstraintFromDetail(detail?: string): string | null {
        if (!detail) return null;
        const match = detail.match(/Key\s+\((\w+)\)/i) || detail.match(/constraint\s+"?(\w+)"?/i);
        return match ? match[1] : null;
    }

    private extractColumnFromDetail(detail?: string): string | null {
        if (!detail) return null;
        const match = detail.match(/column\s+"?(\w+)"?/i) || detail.match(/\((\w+)\)/);
        return match ? match[1] : null;
    }

    private generateErrorCode(exceptionName: string): string {
        return exceptionName
            .replace(/([A-Z])/g, '_$1')
            .replace(/^_/, '')
            .toUpperCase()
            .replace(/EXCEPTION$/, '');
    }

    private isRedisError(exception: any): boolean {
        return (
            exception?.constructor?.name === 'RedisError' ||
            exception?.code === 'ECONNREFUSED' ||
            (exception?.message && exception.message.includes('Redis'))
        );
    }

    private getRequestId(request: Request): string | undefined {
        return (
            (request.headers['x-request-id'] as string) ||
            (request.headers['x-correlation-id'] as string) ||
            (request as any).id
        );
    }

    private logError(
        exception: unknown,
        request: Request,
        status: number,
        message: string | string[],
        requestId?: string,
    ): void {
        const messageStr = Array.isArray(message) ? message.join(', ') : message;
        const logData = {
            requestId,
            method: request.method,
            url: request.url,
            statusCode: status,
            message: messageStr,
            error: exception instanceof Error ? exception.message : String(exception),
            stack: exception instanceof Error ? exception.stack : undefined,
        };

        if (status >= 500) {
            this.logger.error(
                logData,
                `HTTP ${status} Error: ${request.method} ${request.url} - ${messageStr}`,
            );
        } else if (status >= 400) {
            this.logger.warn(
                logData,
                `HTTP ${status} Warning: ${request.method} ${request.url} - ${messageStr}`,
            );
        } else {
            this.logger.debug(
                logData,
                `HTTP ${status}: ${request.method} ${request.url} - ${messageStr}`,
            );
        }
    }
}

