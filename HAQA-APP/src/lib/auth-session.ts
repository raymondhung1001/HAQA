import { apiPost } from './api-client'

/**
 * Session cache to avoid repeated API calls
 * Since we use HttpOnly cookies, we verify by calling existing /token/refresh endpoint
 */
let sessionCache: {
  session: any | null
  timestamp: number
  isValid: boolean
  expiresAt: number | null
} | null = null

const SESSION_CACHE_TTL = 5 * 60 * 1000 // 5 minutes - how long to trust cached session

/**
 * Get cached session if still valid
 */
function getCachedSession(): { session: any | null; isValid: boolean } | null {
  if (!sessionCache) return null
  
  const now = Date.now()
  
  // Check if session has expired based on expiresAt
  if (sessionCache.expiresAt && now >= sessionCache.expiresAt) {
    // Session expired
    sessionCache = null
    return null
  }
  
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
 * Set session cache
 */
function setSessionCache(
  session: any | null, 
  isValid: boolean, 
  expiresAt: number | null = null
): void {
  const now = Date.now()
  sessionCache = {
    session,
    isValid,
    timestamp: now,
    expiresAt: expiresAt || (isValid ? now + SESSION_CACHE_TTL : null),
  }
}

/**
 * Clear session cache
 */
export function clearSessionCache(): void {
  sessionCache = null
}

/**
 * Verify httpOnly cookie by calling existing /token/refresh endpoint
 * This endpoint reads the refreshToken from httpOnly cookies
 */
async function verifyHttpOnlyCookie(): Promise<boolean> {
  try {
    // Call refresh endpoint with empty body - it reads from httpOnly cookies
    // If cookie is valid, it will return new tokens
    // If cookie is invalid/missing, it will return 401
    await apiPost('/token/refresh', {}, {
      includeCsrf: false, // Refresh endpoint might not need CSRF
    })
    return true
  } catch (error: any) {
    // 401 or any error means cookie is invalid or missing
    return false
  }
}

/**
 * Check authentication status by verifying httpOnly cookie
 * Uses existing /token/refresh endpoint to verify cookie validity
 */
export async function getAuthSession(): Promise<{ session: any | null; isValid: boolean }> {
  // Check cache first
  const cached = getCachedSession()
  if (cached !== null) {
    return cached
  }

  // No cache or cache expired - verify httpOnly cookie with existing endpoint
  const isValid = await verifyHttpOnlyCookie()
  
  setSessionCache(
    isValid ? { authenticated: true } : null,
    isValid,
    null // Don't set expiresAt from verification
  )

  return {
    session: isValid ? { authenticated: true } : null,
    isValid,
  }
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const { isValid } = await getAuthSession()
  return isValid
}

/**
 * Mark session as authenticated (used after successful login)
 * @param sessionData - Optional session data to store
 * @param expiresAt - Optional expiration timestamp (from token response)
 */
export function setSessionAuthenticated(
  sessionData: any = null, 
  expiresAt: number | null = null
): void {
  setSessionCache(
    sessionData || { authenticated: true }, 
    true,
    expiresAt
  )
}
