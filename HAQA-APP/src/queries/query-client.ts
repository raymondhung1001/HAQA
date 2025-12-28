import { QueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api'

/**
 * Create a new QueryClient instance with default options
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
    mutations: {
      retry: false,
    },
  },
})

// Sync authentication state across tabs
// When auth state changes in another tab (via localStorage), invalidate queries
if (typeof window !== 'undefined') {
  // Listen for storage events from other tabs
  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key === 'accessToken' || e.key === 'refreshToken' || e.key === 'tokenExpiresAt' || e.key === 'rememberMe') {
      console.log('[QueryClient] Auth state changed in another tab, invalidating queries')
      queryClient.invalidateQueries()
    }
  })

  // Also listen via the apiClient's event system
  apiClient.onAuthStateChange(() => {
    console.log('[QueryClient] Auth state changed, invalidating queries')
    queryClient.invalidateQueries()
  })
}

