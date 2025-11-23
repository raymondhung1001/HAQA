import { SetMetadata } from '@nestjs/common';
import type { ZodType } from 'zod';
import { ZOD_SCHEMA_METADATA } from './zod-validation.pipe';

/**
 * Decorator to attach a Zod schema to a parameter
 * This allows the ZodValidationPipe to automatically validate parameters
 * 
 * Usage:
 * ```typescript
 * @Post()
 * async create(@Body() @ZodSchema(loginSchema) data: LoginDto) {
 *   // data is validated against loginSchema
 * }
 * ```
 */
export const ZodSchema = (schema: ZodType<any, any, any>) => SetMetadata(ZOD_SCHEMA_METADATA, schema);

