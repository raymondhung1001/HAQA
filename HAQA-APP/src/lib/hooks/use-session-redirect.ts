import { useEffect } from 'react'

import { SessionExpiredError, UnauthorizedError } from '@/lib/api-client'

export const isSessionExpiredError = (error: unknown): boolean => {
  return (
    error instanceof SessionExpiredError ||
    error instanceof UnauthorizedError ||
    (error instanceof Error &&
      (error.message.includes('Session expired') || error.message.includes('Not authorized')))
  )
}

export const redirectToLoginIfNeeded = (): void => {
  if (typeof window === 'undefined') return
  if (window.location.pathname !== '/login') {
    window.location.href = '/login'
  }
}

export const useSessionRedirect = (error: unknown): void => {
  useEffect(() => {
    if (isSessionExpiredError(error)) {
      redirectToLoginIfNeeded()
    }
  }, [error])
}
