import { Component, ReactNode } from 'react'
import { SessionExpiredError } from '@/lib/api-client'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    
    // Handle session expiration errors - redirect immediately
    if (error instanceof SessionExpiredError || error.message.includes('Session expired')) {
      // Use window.location for a hard redirect to ensure complete logout
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login'
        return // Exit early to prevent further processing
      }
    }
    
    // Call onError callback if provided
    if (this.props.onError) {
      this.props.onError(error)
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Check if it's a session expiration error
      if (this.state.error instanceof SessionExpiredError || this.state.error?.message.includes('Session expired')) {
        // Redirect will happen in componentDidCatch, but show message while redirecting
        return (
          <div className="p-4 text-center">
            <p className="text-gray-600 dark:text-gray-400">
              Session expired. Redirecting to login...
            </p>
          </div>
        )
      }

      return (
        <div className="p-4 text-center">
          <p className="text-red-600 dark:text-red-400">
            An error occurred: {this.state.error?.message || 'Unknown error'}
          </p>
        </div>
      )
    }

    return this.props.children
  }
}

