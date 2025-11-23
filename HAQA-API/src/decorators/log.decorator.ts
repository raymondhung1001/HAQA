import { SetMetadata } from '@nestjs/common';

export const LOG_METADATA_KEY = 'log';

/**
 * Decorator to automatically log method entry and exit with requestId.
 * 
 * Usage examples:
 * 
 * 1. Log a specific method:
 * ```typescript
 * @Log()
 * async someMethod() {
 *   // Method body - enter/leave will be logged automatically
 * }
 * ```
 * 
 * 2. Log with custom method name:
 * ```typescript
 * @Log('customMethodName')
 * async someMethod() {
 *   // Method body
 * }
 * ```
 * 
 * 3. Log all methods in a class:
 * ```typescript
 * @Log()
 * @Controller('users')
 * export class UsersController {
 *   // All methods will be logged automatically
 * }
 * ```
 * 
 * The decorator automatically includes:
 * - requestId (unique ID for the HTTP request)
 * - method name
 * - class name
 * - execution duration
 * - success/failure status
 */
export const Log = (methodName?: string) => SetMetadata(LOG_METADATA_KEY, methodName || true);

