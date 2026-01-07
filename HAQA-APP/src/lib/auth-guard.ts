import { authMiddlewareWithRefresh } from './authMiddleware'

/**
 * Global authentication guard function
 * Checks if user is authenticated and redirects to login if not
 * This should be used in route beforeLoad hooks
 * 
 * Uses the authMiddlewareWithRefresh for automatic token refresh handling
 * 
 * With HttpOnly cookies:
 * - Tokens are stored securely in HttpOnly cookies (set by server)
 * - Client checks authentication via API call
 * - No client-side token storage (prevents XSS attacks)
 */
export async function requireAuth(): Promise<void> {
  // Use the enhanced auth middleware with automatic token refresh
  await authMiddlewareWithRefresh(undefined, undefined, true, true)
}
