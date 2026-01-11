import { redirect } from '@tanstack/react-router'
import { getAuthSession } from './auth-session'

/**
 * Global authentication guard function for route protection
 * Uses cached session to avoid repeated API calls
 * This should be used in route beforeLoad hooks
 */
export async function requireAuth(): Promise<void> {
  // Only run on client side
  if (typeof window === 'undefined') {
    return
  }

  try {
    // Check authentication using cached session (avoids API call)
    const { isValid } = await getAuthSession()

    // If not authenticated, redirect to login
    if (!isValid) {
      const currentPath = window.location.pathname
      const returnUrl = currentPath !== '/' ? `?returnUrl=${encodeURIComponent(currentPath)}` : ''
      throw redirect({
        to: '/login',
        search: returnUrl ? { returnUrl: currentPath } : undefined,
      })
    }

    // User is authenticated
    return
  } catch (error) {
    // If it's a redirect, re-throw it
    if (error && typeof error === 'object' && 'to' in error) {
      throw error
    }

    // For other errors, redirect to login
    const currentPath = window.location.pathname
    throw redirect({
      to: '/login',
      search: { returnUrl: currentPath },
    })
  }
}

