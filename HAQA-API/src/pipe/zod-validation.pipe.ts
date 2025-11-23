import {
    PipeTransform,
    Injectable,
    ArgumentMetadata,
    BadRequestException,
} from '@nestjs/common';
import type { ZodType } from 'zod';
import { ZodError } from 'zod';

/**
 * Metadata key for storing Zod schema
 */
export const ZOD_SCHEMA_METADATA = 'zod-schema';

/**
 * Zod Validation Pipe
 * Validates request parameters (body, query, params) against a Zod schema
 * 
 * Usage:
 * ```typescript
 * @Post()
 * async create(@Body(ZodValidationPipe.create(schema)) data: SchemaType) {
 *   // data is now validated and typed
 * }
 * ```
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
    constructor(private readonly schema: ZodType<any, any, any>) {}

    /**
     * Factory method to create a pipe instance with a schema
     */
    static create(schema: ZodType<any, any, any>) {
        return new ZodValidationPipe(schema);
    }

    /**
     * Transform and validate the incoming value
     */
    transform(value: any, metadata: ArgumentMetadata) {
        try {
            // If value is null or undefined, pass it through (let schema handle it)
            if (value === null || value === undefined) {
                return this.schema.parse(value);
            }

            // Validate and transform the value
            return this.schema.parse(value);
        } catch (error) {
            if (error instanceof ZodError) {
                // Format Zod errors to match NestJS validation error format
                const formattedErrors = this.formatZodErrors(error);
                
                throw new BadRequestException({
                    message: 'Validation failed',
                    error: 'Bad Request',
                    statusCode: 400,
                    validationErrors: formattedErrors,
                });
            }

            // Re-throw if it's not a ZodError
            throw error;
        }
    }

    /**
     * Format Zod errors to match the ValidationError interface used by HttpExceptionFilter
     */
    private formatZodErrors(error: ZodError): Array<{
        field: string;
        message: string;
        value?: any;
        constraints?: Record<string, string>;
    }> {
        return error.issues.map((err) => {
            const path = err.path.join('.');
            // Try to extract the value that caused the error
            let errorValue: any;
            try {
                const input = (error as any).input;
                if (input) {
                    errorValue = err.path.reduce((obj: any, key) => {
                        if (obj && typeof obj === 'object' && key in obj) {
                            return obj[key];
                        }
                        return undefined;
                    }, input);
                }
            } catch {
                errorValue = undefined;
            }

            return {
                field: path || 'root',
                message: err.message,
                value: errorValue,
                constraints: {
                    [err.code]: err.message,
                },
            };
        });
    }
}

