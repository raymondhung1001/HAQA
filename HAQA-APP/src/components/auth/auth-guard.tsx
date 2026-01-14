import { ReactNode } from 'react'
import { Navigate } from '@tanstack/react-router'
import { useAuth } from '@/context/auth-context'

/**
 * Props for AuthGuard component
 */
export interface AuthGuardProps {
  /**
   * Children to render if authenticated
   */
  children: ReactNode
  /**
   * Redirect path when not authenticated (default: '/login')
   */
  redirectTo?: string
  /**
   * Whether to show loading state while checking auth
   */
  showLoading?: boolean
  /**
   * Custom loading component
   */
  loadingComponent?: ReactNode
}

/**
 * AuthGuard component
 * Wraps content that requires authentication
 * Redirects to login if not authenticated
 */
export function AuthGuard({
  children,
  redirectTo = '/login',
  showLoading = true,
  loadingComponent,
}: AuthGuardProps) {
  const { isAuthenticated, isLoading } = useAuth()

  // Show loading state while checking authentication
  if (isLoading && showLoading) {
    return (
      <>
        {loadingComponent || (
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-gray-100 mx-auto"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-400">Checking authentication...</p>
            </div>
          </div>
        )}
      </>
    )
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to={redirectTo} />
  }

  // Render children if authenticated
  return <>{children}</>
}

