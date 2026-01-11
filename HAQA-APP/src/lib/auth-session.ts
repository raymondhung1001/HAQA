/**
 * Session cache to avoid repeated API calls
 * Since we use HttpOnly cookies, we can't read tokens directly,
 * so we rely on session cache set after login
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
 * Check authentication status using cached session only
 * No API calls - relies on session cache set after login
 */
export async function getAuthSession(): Promise<{ session: any | null; isValid: boolean }> {
  // Check cache first - this is the only source of truth
  const cached = getCachedSession()
  if (cached !== null) {
    return cached
  }

  // No cache or cache expired - not authenticated
  return {
    session: null,
    isValid: false,
  }
}

/**
 * Check if user is authenticated (cached)
 */
export async function isAuthenticated(): Promise<boolean> {
  const { isValid } = await getAuthSession()
  return isValid
}

/**
 * Mark session as authenticated (used after successful login)
 * This avoids needing to call any API endpoint
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

