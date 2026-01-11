import { useMutation, UseMutationOptions, useQueryClient } from '@tanstack/react-query'
import { authClient } from '@/lib/auth-client'
import { apiPost } from '@/lib/api-client'
import { clearSessionCache, setSessionAuthenticated } from '@/lib/auth-session'

/**
 * Login request interface
 */
export interface LoginRequest {
  username: string
  password: string
  rememberMe?: boolean
}

/**
 * Auth token response interface
 */
export interface AuthTokenResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
  expiresAt: number
  tokenType: 'Bearer'
}

/**
 * Login mutation hook
 * Uses the existing NestJS API endpoint
 */
export function useLogin(
  options?: Omit<
    UseMutationOptions<AuthTokenResponse, Error, LoginRequest, unknown>,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (credentials: LoginRequest) => {
      // Remove rememberMe from credentials before sending to API
      const { rememberMe: _, ...apiCredentials } = credentials

      const response = await apiPost<{ data?: AuthTokenResponse } | AuthTokenResponse>(
        '/token',
        apiCredentials,
        {
          retryOn401: false, // Don't retry login on 401
        }
      )

      // The API wraps responses in a SuccessResponse format with a 'data' property
      const authData: AuthTokenResponse = (response as any)?.data || response

      // Validate response data
      if (!authData) {
        throw new Error('Invalid login response: no data received')
      }
      
      if (!authData.expiresAt || typeof authData.expiresAt !== 'number') {
        throw new Error('Invalid login response: missing or invalid expiration time')
      }

      // If tokens are missing from response, create a placeholder response
      const result: AuthTokenResponse = {
        accessToken: authData.accessToken || '',
        refreshToken: authData.refreshToken || '',
        expiresIn: authData.expiresIn || Math.floor((authData.expiresAt - Date.now()) / 1000),
        expiresAt: authData.expiresAt,
        tokenType: authData.tokenType || 'Bearer',
      }

      return result
    },
    onSuccess: async (data) => {
      // Mark session as authenticated after successful login
      // No API call needed - tokens are in HttpOnly cookies
      setSessionAuthenticated({
        user: data, // Store token response data if needed
        authenticated: true,
      })
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['auth', 'session'] })
      queryClient.invalidateQueries()
    },
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
    mutationFn: async () => {
      // Sign out using better-auth
      await authClient.signOut()
    },
    onSuccess: () => {
      // Clear session cache and all queries on logout
      clearSessionCache()
      queryClient.clear()
    },
    ...options,
  })
}

/**
 * Check authentication status using cached session (avoids API call)
 */
export async function checkAuth(): Promise<boolean> {
  const { isAuthenticated } = await import('@/lib/auth-session')
  return isAuthenticated()
}
