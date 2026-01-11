import { authClient } from './auth-client'

/**
 * Session cache to avoid repeated API calls
 */
let sessionCache: {
  session: any | null
  timestamp: number
  isValid: boolean
  lastVerified: number
} | null = null

const SESSION_CACHE_TTL = 5 * 60 * 1000 // 5 minutes - how long to trust cached session
const SESSION_VERIFY_INTERVAL = 15 * 60 * 1000 // 15 minutes - how often to verify with API

/**
 * Get cached session if still valid
 */
function getCachedSession(): { session: any | null; isValid: boolean } | null {
  if (!sessionCache) return null
  
  const now = Date.now()
  // Use cached session if it's within the TTL
  if (now - sessionCache.timestamp < SESSION_CACHE_TTL) {
    return {
      session: sessionCache.session,
      isValid: sessionCache.isValid,
    }
  }
  
  // Cache expired
  sessionCache = null
  return null
}

/**
 * Check if we need to verify session with API
 */
function shouldVerifySession(): boolean {
  if (!sessionCache) return true
  
  const now = Date.now()
  // Verify if last verification was more than VERIFY_INTERVAL ago
  return (now - sessionCache.lastVerified) > SESSION_VERIFY_INTERVAL
}

/**
 * Set session cache
 */
function setSessionCache(session: any | null, isValid: boolean, verified: boolean = false): void {
  const now = Date.now()
  sessionCache = {
    session,
    isValid,
    timestamp: now,
    lastVerified: verified ? now : (sessionCache?.lastVerified || 0),
  }
}

/**
 * Clear session cache
 */
export function clearSessionCache(): void {
  sessionCache = null
}

/**
 * Verify session using better-auth (no API call needed)
 * Since tokens are in HttpOnly cookies, we rely on better-auth's session management
 */
async function verifySessionWithBetterAuth(): Promise<{ session: any | null; isValid: boolean }> {
  try {
    // Try to get session from better-auth
    const session = await authClient.getSession()
    const isValid = !!session?.data?.session
    
    // Cache the result
    setSessionCache(session?.data?.session || null, isValid, true)
    
    return {
      session: session?.data?.session || null,
      isValid,
    }
  } catch (error) {
    // If better-auth session check fails, check cache
    const cached = getCachedSession()
    if (cached) {
      return cached
    }
    
    // No session found
    setSessionCache(null, false, false)
    return {
      session: null,
      isValid: false,
    }
  }
}

/**
 * Check authentication status using cached session
 * Uses better-auth session management instead of API calls
 */
export async function getAuthSession(): Promise<{ session: any | null; isValid: boolean }> {
  // Check cache first
  const cached = getCachedSession()
  if (cached !== null) {
    // If we have a cached session, check if we need to verify it
    if (shouldVerifySession()) {
      // Verify in background using better-auth (don't wait for it)
      verifySessionWithBetterAuth().catch(() => {
        // Silently fail - we'll use cached value
      })
    }
    return cached
  }

  // No cache or cache expired - verify with better-auth
  return verifySessionWithBetterAuth()
}

/**
 * Check if user is authenticated (cached)
 */
export async function isAuthenticated(): Promise<boolean> {
  const { isValid } = await getAuthSession()
  return isValid
}

/**
 * Force refresh session using better-auth
 */
export async function refreshAuthSession(): Promise<{ session: any | null; isValid: boolean }> {
  clearSessionCache()
  return verifySessionWithBetterAuth()
}

/**
 * Mark session as authenticated (used after successful login)
 * This avoids needing to call any API endpoint
 */
export function setSessionAuthenticated(sessionData: any = null): void {
  setSessionCache(sessionData || { authenticated: true }, true, true)
}

