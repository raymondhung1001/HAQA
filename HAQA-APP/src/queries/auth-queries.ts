import { useMutation, UseMutationOptions, useQueryClient } from '@tanstack/react-query'
import { apiClient, type LoginRequest, type AuthTokenResponse } from '@/lib/withApi'

/**
 * Login mutation hook
 */
export function useLogin(
  options?: Omit<
    UseMutationOptions<AuthTokenResponse, Error, LoginRequest, unknown>,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (credentials: LoginRequest) => apiClient.login(credentials),
    onSuccess: () => {
      // Invalidate any queries that depend on auth state
      queryClient.invalidateQueries()
    },
    ...options,
  })
}

/**
 * Refresh token mutation hook
 * Refresh token is automatically sent via HttpOnly cookie
 */
export function useRefreshToken(
  options?: Omit<
    UseMutationOptions<AuthTokenResponse, Error, void, unknown>,
    'mutationFn'
  >
) {
  return useMutation({
    mutationFn: () => apiClient.refreshToken(),
    ...options,
  })
}

/**
 * Logout mutation hook
 */
export function useLogout(
  options?: Omit<
    UseMutationOptions<void, Error, void, unknown>,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => {
      apiClient.logout()
      return Promise.resolve()
    },
    onSuccess: () => {
      // Clear all queries on logout
      queryClient.clear()
    },
    ...options,
  })
}

