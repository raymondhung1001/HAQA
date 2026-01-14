import { createContext, useContext, ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAuthSession } from '@/lib/auth-session'
import { useLogin, useLogout, type LoginRequest } from '@/queries/auth-queries'

/**
 * Auth context value interface
 */
export interface AuthContextValue {
  /**
   * Whether the user is authenticated
   */
  isAuthenticated: boolean
  /**
   * Whether auth status is being checked
   */
  isLoading: boolean
  /**
   * Current user session data (if available)
   */
  user: any | null
  /**
   * Login function
   */
  login: (credentials: LoginRequest) => Promise<void>
  /**
   * Logout function
   */
  logout: () => Promise<void>
  /**
   * Whether login is in progress
   */
  isLoggingIn: boolean
  /**
   * Whether logout is in progress
   */
  isLoggingOut: boolean
}

/**
 * Auth context
 */
const AuthContext = createContext<AuthContextValue | undefined>(undefined)

/**
 * AuthProvider props
 */
export interface AuthProviderProps {
  children: ReactNode
}

/**
 * AuthProvider component
 * Provides authentication state and methods to child components
 */
export function AuthProvider({ children }: AuthProviderProps) {
  // Query to check authentication status
  const { data: authSession, isLoading: isLoadingAuth } = useQuery({
    queryKey: ['auth', 'session'],
    queryFn: async () => {
      const session = await getAuthSession()
      return session
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    retry: false,
  })

  // Login mutation
  const loginMutation = useLogin({
    onSuccess: () => {
      // Query will automatically refetch after invalidation
    },
  })

  // Logout mutation
  const logoutMutation = useLogout()

  // Derived state
  const isAuthenticated = authSession?.isValid ?? false
  const user = authSession?.session ?? null
  const isLoading = isLoadingAuth

  // Login function
  const login = async (credentials: LoginRequest) => {
    await loginMutation.mutateAsync(credentials)
  }

  // Logout function
  const logout = async () => {
    await logoutMutation.mutateAsync()
  }

  const value: AuthContextValue = {
    isAuthenticated,
    isLoading,
    user,
    login,
    logout,
    isLoggingIn: loginMutation.isPending,
    isLoggingOut: logoutMutation.isPending,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * Hook to use auth context
 * @throws Error if used outside AuthProvider
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

/**
 * Hook to check if user is authenticated (without throwing)
 * Useful for conditional rendering
 */
export function useAuthOptional(): Partial<AuthContextValue> {
  const context = useContext(AuthContext)
  return context ?? {}
}

