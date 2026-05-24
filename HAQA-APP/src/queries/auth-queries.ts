import { useMutation, UseMutationOptions, useQueryClient } from '@tanstack/react-query'
import { apiPost } from '@/lib/api-client'
import { clearSessionCache, setSessionAuthenticated } from '@/lib/auth-session'

export interface LoginRequest {
  username: string
  password: string
  rememberMe?: boolean
}

export interface AuthTokenResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
  expiresAt: number
  tokenType: 'Bearer'
}

function unwrapTokenResponse(
  response: { data?: AuthTokenResponse } | AuthTokenResponse,
): AuthTokenResponse {
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

export function useLogin(
  options?: Omit<
    UseMutationOptions<AuthTokenResponse, Error, LoginRequest, unknown>,
    'mutationFn'
  >,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (credentials: LoginRequest) => {
      const response = await apiPost<{ data?: AuthTokenResponse } | AuthTokenResponse>(
        '/token',
        credentials,
        { retryOn401: false },
      )

      return unwrapTokenResponse(response)
    },
    onSuccess: async (data) => {
      setSessionAuthenticated({ authenticated: true }, data.expiresAt || null)
      await queryClient.invalidateQueries({ queryKey: ['auth', 'session'] })
    },
    ...options,
  })
}

export function useLogout(
  options?: Omit<UseMutationOptions<void, Error, void, unknown>, 'mutationFn'>,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      try {
        await apiPost('/token/logout', undefined, { retryOn401: false })
      } catch {
        // Clear local session even if the server call fails
      } finally {
        clearSessionCache()
      }
    },
    onSuccess: () => {
      queryClient.clear()
      queryClient.invalidateQueries({ queryKey: ['auth', 'session'] })
    },
    ...options,
  })
}
