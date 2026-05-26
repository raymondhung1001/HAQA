import { useMutation, UseMutationOptions, useQueryClient } from '@tanstack/react-query'

import { apiPost } from '@/lib/api-client'
import { clearSessionCache, setSessionAuthenticated } from '@/lib/auth-session'
import { testFlowQueryKeys } from '@/types'
import type { AuthTokenResponse, LoginRequest } from '@/types'

export type { LoginRequest, AuthTokenResponse } from '@/types'

const unwrapTokenResponse = (
  response: { data?: AuthTokenResponse } | AuthTokenResponse,
): AuthTokenResponse => {
  const authData: AuthTokenResponse = (response as { data?: AuthTokenResponse })?.data || response

  if (!authData?.expiresAt || typeof authData.expiresAt !== 'number') {
    throw new Error('Invalid login response: missing or invalid expiration time')
  }

  return {
    accessToken: authData.accessToken || '',
    refreshToken: authData.refreshToken || '',
    expiresIn: authData.expiresIn || Math.floor((authData.expiresAt - Date.now()) / 1000),
    expiresAt: authData.expiresAt,
    tokenType: authData.tokenType || 'Bearer',
  }
}

export const useLogin = (
  options?: Omit<
    UseMutationOptions<AuthTokenResponse, Error, LoginRequest, unknown>,
    'mutationFn'
  >,
) => {
  const queryClient = useQueryClient()
  const { onSuccess: userOnSuccess, ...restOptions } = options ?? {}

  return useMutation({
    ...restOptions,
    mutationFn: async (credentials: LoginRequest) => {
      const response = await apiPost<{ data?: AuthTokenResponse } | AuthTokenResponse>(
        '/token',
        credentials,
        { retryOn401: false },
      )

      return unwrapTokenResponse(response)
    },
    onSuccess: async (data, variables, context) => {
      setSessionAuthenticated({ authenticated: true }, data.expiresAt || null)
      await queryClient.invalidateQueries({ queryKey: ['auth', 'session'] })
      await queryClient.invalidateQueries({ queryKey: testFlowQueryKeys.all })
      await userOnSuccess?.(data, variables, context)
    },
  })
}

export const useLogout = (
  options?: Omit<UseMutationOptions<void, Error, void, unknown>, 'mutationFn'>,
) => {
  const queryClient = useQueryClient()
  const { onSuccess: userOnSuccess, ...restOptions } = options ?? {}

  return useMutation({
    ...restOptions,
    mutationFn: async () => {
      try {
        await apiPost('/token/logout', undefined, { retryOn401: false })
      } catch {
        // Clear local session even if the server call fails
      } finally {
        clearSessionCache()
      }
    },
    onSuccess: async (data, variables, context) => {
      queryClient.clear()
      await queryClient.invalidateQueries({ queryKey: ['auth', 'session'] })
      await userOnSuccess?.(data, variables, context)
    },
  })
}
