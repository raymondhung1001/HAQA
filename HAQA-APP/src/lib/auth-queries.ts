import { useMutation, UseMutationOptions, useQueryClient } from '@tanstack/react-query'
import { apiClient, type LoginRequest, type AuthTokenResponse } from './api'

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
 */
export function useRefreshToken(
  options?: Omit<
    UseMutationOptions<AuthTokenResponse, Error, string, unknown>,
    'mutationFn'
  >
) {
  return useMutation({
    mutationFn: (refreshToken: string) => apiClient.refreshToken(refreshToken),
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

