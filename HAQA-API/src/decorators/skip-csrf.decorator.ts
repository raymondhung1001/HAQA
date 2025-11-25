import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key for skipping CSRF protection
 */
export const IS_SKIP_CSRF_KEY = 'isSkipCsrf';

/**
 * Decorator to skip CSRF protection for a specific route or controller
 * 
 * Usage:
 * ```typescript
 * @SkipCsrf()
 * @Post('public-endpoint')
 * async publicEndpoint() {
 *   // This route will skip CSRF validation
 * }
 * ```
 */
export const SkipCsrf = () => SetMetadata(IS_SKIP_CSRF_KEY, true);

