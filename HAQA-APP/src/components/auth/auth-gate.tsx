import { ReactNode } from 'react'
import { useAuth } from '@/context/auth-context'

/**
 * Props for AuthGate component
 */
export interface AuthGateProps {
  /**
   * Children to render if authenticated
   */
  children: ReactNode
  /**
   * Fallback content to show when not authenticated
   */
  fallback?: ReactNode
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
 * AuthGate component
 * Conditionally renders children based on authentication status
 * Does not redirect - useful for showing/hiding UI elements
 */
export function AuthGate({
  children,
  fallback = null,
  showLoading = true,
  loadingComponent,
}: AuthGateProps) {
  const { isAuthenticated, isLoading } = useAuth()

  // Show loading state while checking authentication
  if (isLoading && showLoading) {
    return (
      <>
        {loadingComponent || (
          <div className="flex items-center justify-center p-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
          </div>
        )}
      </>
    )
  }

  // Show fallback if not authenticated
  if (!isAuthenticated) {
    return <>{fallback}</>
  }

  // Render children if authenticated
  return <>{children}</>
}

