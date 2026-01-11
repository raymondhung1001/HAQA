import { useQuery } from '@tanstack/react-query'
import { getAuthSession, clearSessionCache, refreshAuthSession } from './auth-session'

/**
 * React hook for authentication state
 * Uses React Query to cache and manage session state
 * Avoids repeated API calls to /profile endpoint
 */
export function useAuth() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['auth', 'session'],
    queryFn: async () => {
      // Use cached session (only calls API when necessary)
      return getAuthSession()
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: true,
  })

  const session = data?.session
  const isAuthenticated = data?.isValid ?? false

  return {
    session,
    isAuthenticated,
    isLoading,
    error,
    refetch: async () => {
      // Force refresh from API
      const result = await refreshAuthSession()
      // Update React Query cache
      await refetch()
      return result
    },
  }
}

/**
 * Hook to check if user is authenticated (simplified)
 */
export function useIsAuthenticated(): boolean {
  const { isAuthenticated } = useAuth()
  return isAuthenticated
}

