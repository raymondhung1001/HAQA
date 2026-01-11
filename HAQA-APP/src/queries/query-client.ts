import { QueryClient } from '@tanstack/react-query'
import { SessionExpiredError, UnauthorizedError } from '@/lib/api-client'

/**
 * Create a new QueryClient instance with default options
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry on session expiration or unauthorized errors
        if (
          error instanceof SessionExpiredError ||
          error instanceof UnauthorizedError ||
          (error instanceof Error && (error.message.includes('Session expired') || error.message.includes('Not authorized')))
        ) {
          return false
        }
        // Otherwise, retry once
        return failureCount < 1
      },
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
      onError: (error) => {
        handleSessionExpiration(error)
      },
    },
    mutations: {
      retry: false,
      onError: (error) => {
        handleSessionExpiration(error)
      },
    },
  },
})

/**
 * Handle session expiration and unauthorized errors globally
 * Redirects to login page when session expires or unauthorized and clears query cache
 */
function handleSessionExpiration(error: unknown) {
  if (
    error instanceof SessionExpiredError ||
    error instanceof UnauthorizedError ||
    (error instanceof Error && (error.message.includes('Session expired') || error.message.includes('Not authorized')))
  ) {
    // Clear all queries to prevent retries
    queryClient.clear()
    
    // Use window.location for a hard redirect to ensure complete logout
    // This clears any cached state and forces a fresh login
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
  }
}

// Note: With HttpOnly cookies, we cannot detect auth state changes across tabs
// via storage events since tokens are not accessible to JavaScript.
// Auth state changes will be detected on the next API call or route navigation.
