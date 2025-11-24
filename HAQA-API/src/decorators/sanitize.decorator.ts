import { SetMetadata } from '@nestjs/common';

export const SANITIZE_METADATA_KEY = 'sanitize';

export interface SanitizeOptions {
    /**
     * Custom mask pattern. Default is '****'
     * Examples:
     * - '****' (default)
     * - '***'
     * - '******'
     * - 'MASKED'
     */
    pattern?: string;
    /**
     * Number of characters to show at the start. Default is 0.
     * Example: showFirst: 2 for "ab****" instead of "****"
     */
    showFirst?: number;
    /**
     * Number of characters to show at the end. Default is 0.
     * Example: showLast: 2 for "****cd" instead of "****"
     */
    showLast?: number;
}

/**
 * Decorator to mark fields that should be sanitized (masked) in logs.
 * 
 * Usage examples:
 * 
 * 1. Basic usage (sanitizes with '****'):
 * ```typescript
 * class LoginDto {
 *   username: string;
 *   
 *   @Sanitize()
 *   password: string;
 * }
 * ```
 * 
 * 2. Custom mask pattern:
 * ```typescript
 * class UserDto {
 *   @Sanitize({ pattern: '***' })
 *   password: string;
 * }
 * ```
 * 
 * 3. Show first/last characters:
 * ```typescript
 * class TokenDto {
 *   @Sanitize({ showFirst: 4, showLast: 4 })
 *   accessToken: string; // Will show first 4 and last 4 chars: "abcd****wxyz"
 * }
 * ```
 * 
 * 4. Complex example:
 * ```typescript
 * class AuthResponse {
 *   @Sanitize({ pattern: '***', showFirst: 2 })
 *   accessToken: string;
 *   
 *   @Sanitize({ pattern: '***', showFirst: 2 })
 *   refreshToken: string;
 * }
 * ```
 * 
 * The decorator works automatically with:
 * - LoggingInterceptor (method arguments)
 * - LoggerService (context data)
 * - Any object serialized for logging
 */
export const Sanitize = (options?: SanitizeOptions) => SetMetadata(SANITIZE_METADATA_KEY, options || {});

