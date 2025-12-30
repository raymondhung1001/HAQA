import { redirect } from '@tanstack/react-router'
import { apiClient } from './api'

/**
 * Global authentication guard function
 * Checks if user is authenticated and redirects to login if not
 * This should be used in route beforeLoad hooks
 * 
 * With HttpOnly cookies:
 * - Tokens are stored securely in HttpOnly cookies (set by server)
 * - Client checks authentication via API call
 * - No client-side token storage (prevents XSS attacks)
 */
export async function requireAuth(): Promise<void> {
  // Only check on client side
  if (typeof window === 'undefined') {
    return
  }

  // Check authentication via API call
  // This verifies that HttpOnly cookies contain valid tokens
  const isAuthenticated = await apiClient.checkAuth()
  
  if (!isAuthenticated) {
    // Clear any remaining client-side state
    apiClient.clearTokens()
    throw redirect({
      to: '/login',
    })
  }

  // User is authenticated
  return
}
