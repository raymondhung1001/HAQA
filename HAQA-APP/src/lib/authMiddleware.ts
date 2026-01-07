import { redirect } from '@tanstack/react-router'
import { apiClient, SessionExpiredError } from './withApi'

/**
 * Authentication middleware for TanStack Router
 * 
 * This middleware handles:
 * - Authentication checks on route navigation
 * - Automatic token refresh when needed
 * - Redirecting unauthenticated users to login
 * - Redirecting authenticated users away from auth pages
 * - Session expiration handling
 * 
 * With HttpOnly cookies:
 * - Tokens are stored securely in HttpOnly cookies (set by server)
 * - Client checks authentication via API call
 * - No client-side token storage (prevents XSS attacks)
 */

export interface AuthMiddlewareContext {
  isAuthenticated: boolean
  isAuthenticating: boolean
  lastAuthCheck: number | null
}

/**
 * Public routes that don't require authentication
 */
const PUBLIC_ROUTES = ['/login', '/register', '/forgot-password', '/reset-password']

/**
 * Auth routes that should redirect authenticated users
 */
const AUTH_ROUTES = ['/login', '/register']

/**
 * Check if a route is public (doesn't require authentication)
 */
function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => pathname.startsWith(route))
}

/**
 * Check if a route is an auth route (login, register, etc.)
 */
function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some(route => pathname.startsWith(route))
}

/**
 * Auth middleware function
 * This should be called in route beforeLoad hooks or router context
 * 
 * @param context - Router context (optional, for future use)
 * @param pathname - Current route pathname
 * @param requireAuth - Whether authentication is required for this route (default: true)
 * @returns Promise that resolves if auth check passes, throws redirect if not
 */
export async function authMiddleware(
  _context?: unknown,
  pathname?: string,
  requireAuth: boolean = true
): Promise<void> {
  // Only run on client side
  if (typeof window === 'undefined') {
    return
  }

  const currentPath = pathname || window.location.pathname

  // Skip auth check for public routes if not requiring auth
  if (!requireAuth || isPublicRoute(currentPath)) {
    // If user is on an auth route and is authenticated, redirect to home
    if (isAuthRoute(currentPath)) {
      try {
        const isAuthenticated = await apiClient.checkAuth()
        if (isAuthenticated) {
          throw redirect({
            to: '/',
            search: undefined,
          })
        }
      } catch (error) {
        // If it's a redirect, re-throw it
        if (error && typeof error === 'object' && 'to' in error) {
          throw error
        }
        // Otherwise, ignore auth check errors on public routes
      }
    }
    return
  }

  // For protected routes, check authentication
  try {
    const isAuthenticated = await apiClient.checkAuth()

    if (!isAuthenticated) {
      // Clear any remaining client-side state
      apiClient.clearTokens()
      
      // Redirect to login with return URL
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

    // If it's a SessionExpiredError, redirect to login
    if (error instanceof SessionExpiredError) {
      apiClient.clearTokens()
      throw redirect({
        to: '/login',
        search: { returnUrl: currentPath },
      })
    }

    // For other errors, clear tokens and redirect
    apiClient.clearTokens()
    throw redirect({
      to: '/login',
      search: { returnUrl: currentPath },
    })
  }
}

/**
 * Enhanced auth middleware with automatic token refresh
 * This version attempts to refresh tokens before redirecting
 * 
 * @param context - Router context (optional)
 * @param pathname - Current route pathname
 * @param requireAuth - Whether authentication is required (default: true)
 * @param attemptRefresh - Whether to attempt token refresh on 401 (default: true)
 * @returns Promise that resolves if auth check passes, throws redirect if not
 */
export async function authMiddlewareWithRefresh(
  _context?: unknown,
  pathname?: string,
  requireAuth: boolean = true,
  attemptRefresh: boolean = true
): Promise<void> {
  // Only run on client side
  if (typeof window === 'undefined') {
    return
  }

  const currentPath = pathname || window.location.pathname

  // Skip auth check for public routes if not requiring auth
  if (!requireAuth || isPublicRoute(currentPath)) {
    // If user is on an auth route and is authenticated, redirect to home
    if (isAuthRoute(currentPath)) {
      try {
        const isAuthenticated = await apiClient.checkAuth()
        if (isAuthenticated) {
          throw redirect({
            to: '/',
            search: undefined,
          })
        }
      } catch (error) {
        // If it's a redirect, re-throw it
        if (error && typeof error === 'object' && 'to' in error) {
          throw error
        }
        // Otherwise, ignore auth check errors on public routes
      }
    }
    return
  }

  // For protected routes, check authentication
  try {
    let isAuthenticated = await apiClient.checkAuth()

    // If not authenticated and refresh is enabled, try to refresh token
    if (!isAuthenticated && attemptRefresh) {
      try {
        await apiClient.refreshAccessToken()
        // Re-check authentication after refresh
        isAuthenticated = await apiClient.checkAuth()
      } catch (refreshError) {
        // Refresh failed, will redirect to login below
        isAuthenticated = false
      }
    }

    if (!isAuthenticated) {
      // Clear any remaining client-side state
      apiClient.clearTokens()
      
      // Redirect to login with return URL
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

    // If it's a SessionExpiredError, redirect to login
    if (error instanceof SessionExpiredError) {
      apiClient.clearTokens()
      throw redirect({
        to: '/login',
        search: { returnUrl: currentPath },
      })
    }

    // For other errors, clear tokens and redirect
    apiClient.clearTokens()
    throw redirect({
      to: '/login',
      search: { returnUrl: currentPath },
    })
  }
}

/**
 * Create a route-specific auth middleware
 * Use this in route beforeLoad hooks
 * 
 * @param requireAuth - Whether this route requires authentication (default: true)
 * @returns Middleware function for use in beforeLoad
 */
export function createAuthMiddleware(requireAuth: boolean = true) {
  return async () => {
    await authMiddlewareWithRefresh(undefined, undefined, requireAuth, true)
  }
}

/**
 * Middleware for handling API request errors globally
 * This can be used to intercept API errors and handle authentication failures
 */
export function handleApiAuthError(error: unknown): void {
  if (error instanceof SessionExpiredError) {
    // Clear tokens and redirect to login
    apiClient.clearTokens()
    const currentPath = window.location.pathname
    window.location.href = `/login?returnUrl=${encodeURIComponent(currentPath)}`
  }
}

/**
 * Check authentication status without redirecting
 * Useful for conditional rendering or UI state
 * 
 * @returns Promise<boolean> - true if authenticated, false otherwise
 */
export async function checkAuthStatus(): Promise<boolean> {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    return await apiClient.checkAuth()
  } catch (error) {
    return false
  }
}

/**
 * Get the return URL from search params and navigate to it
 * Used after successful login
 * 
 * @param defaultPath - Default path to navigate to if no returnUrl is found
 */
export function navigateToReturnUrl(defaultPath: string = '/'): void {
  if (typeof window === 'undefined') {
    return
  }

  const searchParams = new URLSearchParams(window.location.search)
  const returnUrl = searchParams.get('returnUrl')
  
  if (returnUrl && returnUrl.startsWith('/')) {
    window.location.href = returnUrl
  } else {
    window.location.href = defaultPath
  }
}

