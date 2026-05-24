import { redirect } from '@tanstack/react-router'
import { getAuthSession } from './auth-session'

/**
 * Route guard for authenticated app pages.
 */
export async function requireAuth(): Promise<void> {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const { isValid } = await getAuthSession()

    if (!isValid) {
      const currentPath = window.location.pathname
      throw redirect({
        to: '/login',
        search: currentPath !== '/login' ? { returnUrl: currentPath } : undefined,
      })
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'to' in error) {
      throw error
    }

    const currentPath = window.location.pathname
    throw redirect({
      to: '/login',
      search: { returnUrl: currentPath },
    })
  }
}
