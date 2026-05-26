/**
 * In-memory session cache for client-side auth state.
 * Tokens live in HttpOnly cookies; this cache tracks whether the user logged in.
 */
let sessionCache: {
  session: unknown | null
  timestamp: number
  isValid: boolean
  expiresAt: number | null
} | null = null

const SESSION_CACHE_TTL = 5 * 60 * 1000

const getCachedSession = (): { session: unknown | null; isValid: boolean } | null => {
  if (!sessionCache) return null

  const now = Date.now()

  if (sessionCache.expiresAt && now >= sessionCache.expiresAt) {
    sessionCache = null
    return null
  }

  if (now - sessionCache.timestamp < SESSION_CACHE_TTL) {
    return {
      session: sessionCache.session,
      isValid: sessionCache.isValid,
    }
  }

  sessionCache = null
  return null
}

const setSessionCache = (
  session: unknown | null,
  isValid: boolean,
  expiresAt: number | null = null,
): void => {
  const now = Date.now()
  sessionCache = {
    session,
    isValid,
    timestamp: now,
    expiresAt: expiresAt || (isValid ? now + SESSION_CACHE_TTL : null),
  }
}

export const clearSessionCache = (): void => {
  sessionCache = null
}

const probeSessionFromCookies = async (): Promise<boolean> => {
  if (typeof window === 'undefined') return false

  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

  try {
    const response = await fetch(`${baseUrl}/test-flow?page=1&limit=1`, {
      method: 'GET',
      credentials: 'include',
    })
    return response.ok
  } catch {
    return false
  }
}

export const getAuthSession = async (): Promise<{ session: unknown | null; isValid: boolean }> => {
  const cached = getCachedSession()
  if (cached !== null) {
    return cached
  }

  if (await probeSessionFromCookies()) {
    setSessionAuthenticated({ authenticated: true })
    return { session: { authenticated: true }, isValid: true }
  }

  return {
    session: null,
    isValid: false,
  }
}

export const isAuthenticated = async (): Promise<boolean> => {
  const { isValid } = await getAuthSession()
  return isValid
}

export const setSessionAuthenticated = (
  sessionData: unknown = null,
  expiresAt: number | null = null,
): void => {
  setSessionCache(sessionData || { authenticated: true }, true, expiresAt)
}
