import { useEffect } from 'react'

import { SessionExpiredError } from '@/lib/api-client'

export function isSessionExpiredError(error: unknown): boolean {
  return (
    error instanceof SessionExpiredError ||
    (error instanceof Error && error.message.includes('Session expired'))
  )
}

export function redirectToLoginIfNeeded(): void {
  if (typeof window === 'undefined') return
  if (window.location.pathname !== '/login') {
    window.location.href = '/login'
  }
}

export function useSessionRedirect(error: unknown): void {
  useEffect(() => {
    if (isSessionExpiredError(error)) {
      redirectToLoginIfNeeded()
    }
  }, [error])
}
