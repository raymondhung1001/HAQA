import { Body, Query, Param } from '@nestjs/common';
import type { ZodType } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

/**
 * Generic helper function to create a validated parameter decorator
 * @param decorator The NestJS parameter decorator (Body, Query, or Param)
 * @param schema The Zod schema to validate against
 * @returns A parameter decorator with validation
 */
const createSchemaDecorator = (
    decorator: (...args: any[]) => any,
    schema: ZodType<any, any, any>
) => decorator(ZodValidationPipe.create(schema));

/**
 * Helper function to create a validated Body parameter decorator
 * 
 * Usage:
 * ```typescript
 * import { z } from 'zod';
 * 
 * const loginSchema = z.object({
 *   username: z.string().min(1),
 *   password: z.string().min(6),
 * });
 * 
 * @Post()
 * async login(@BodySchema(loginSchema) data: z.infer<typeof loginSchema>) {
 *   // data is validated and typed
 * }
 * ```
 */
export const BodySchema = (schema: ZodType<any, any, any>) => createSchemaDecorator(Body, schema);

/**
 * Helper function to create a validated Query parameter decorator
 * 
 * Usage:
 * ```typescript
 * const querySchema = z.object({
 *   page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
 *   limit: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
 * });
 * 
 * @Get()
 * async findAll(@QuerySchema(querySchema) query: z.infer<typeof querySchema>) {
 *   // query is validated and typed
 * }
 * ```
 */
export const QuerySchema = (schema: ZodType<any, any, any>) => createSchemaDecorator(Query, schema);

/**
 * Helper function to create a validated Param parameter decorator
 * 
 * Usage:
 * ```typescript
 * const paramsSchema = z.object({
 *   id: z.string().uuid(),
 * });
 * 
 * @Get(':id')
 * async findOne(@ParamSchema(paramsSchema) params: z.infer<typeof paramsSchema>) {
 *   // params is validated and typed
 * }
 * ```
 */
export const ParamSchema = (schema: ZodType<any, any, any>) => createSchemaDecorator(Param, schema);

