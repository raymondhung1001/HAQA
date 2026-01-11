import { useQuery } from '@tanstack/react-query'
import { getAuthSession, clearSessionCache } from './auth-session'

/**
 * React hook for authentication state
 * Uses React Query to cache and manage session state
 * No API calls - relies on session cache set after login
 */
export function useAuth() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['auth', 'session'],
    queryFn: async () => {
      // Use cached session only - no API calls
      return getAuthSession()
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false, // No need to refetch on reconnect
  })

  const session = data?.session
  const isAuthenticated = data?.isValid ?? false

  return {
    session,
    isAuthenticated,
    isLoading,
    error,
    refetch: async () => {
      // Just refetch from cache
      return refetch()
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

