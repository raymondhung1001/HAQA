import { QueryClient } from '@tanstack/react-query'

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

// Note: With HttpOnly cookies, we cannot detect auth state changes across tabs
// via storage events since tokens are not accessible to JavaScript.
// Auth state changes will be detected on the next API call or route navigation.
