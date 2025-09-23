import type { StatusCode } from 'hono/utils/http-status';
import type { ErrorType } from '@/util/apiResponseUtil';

export class ApiException extends Error {

    constructor(
        public type: ErrorType,
        message: string,
        public details?: Record<string, any>,
        public statusCode?: StatusCode
    ) {
        super(message);
        this.name = 'ApiException';
    }

}