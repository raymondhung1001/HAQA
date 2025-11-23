import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    Inject,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request } from 'express';
import { PinoLogger } from 'nestjs-pino';

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

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, SuccessResponse<T>> {
    constructor(
        @Inject(PinoLogger)
        private readonly logger: PinoLogger,
    ) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<SuccessResponse<T>> {
        const ctx = context.switchToHttp();
        const request = ctx.getRequest<Request>();
        const response = ctx.getResponse();

        const requestId = this.getRequestId(request);

        return next.handle().pipe(
            map((data) => {
                const statusCode = response.statusCode || 200;

                const successResponse: SuccessResponse<T> = {
                    success: true,
                    statusCode,
                    data,
                    timestamp: new Date().toISOString(),
                    path: request.url,
                    method: request.method,
                    ...(requestId && { requestId }),
                };

                // If data is an object with a message property, extract it
                if (data && typeof data === 'object' && 'message' in data) {
                    successResponse.message = data.message as string;
                }

                return successResponse;
            }),
        );
    }

    private getRequestId(request: Request): string | undefined {
        return (
            (request.headers['x-request-id'] as string) ||
            (request.headers['x-correlation-id'] as string) ||
            (request as any).id
        );
    }
}

