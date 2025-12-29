import { redirect } from '@tanstack/react-router'
import { apiClient } from './api'

/**
 * Global authentication guard function
 * Checks if user is authenticated and redirects to login if not
 * This should be used in route beforeLoad hooks
 * 
 * Logic:
 * 1. Check if token exists in localStorage/sessionStorage
 * 2. If token is > 30 days old (based on issue time), require relogin
 * 3. If token is < 30 days old, check if expired
 * 4. If expired, refresh the token and put it back into storage
 */
export async function requireAuth(): Promise<void> {
  // Only check on client side
  if (typeof window === 'undefined') {
    return
  }

  const token = apiClient.getToken()
  if (!token) {
    throw redirect({
      to: '/login',
    })
  }

  // Get token issue time (when token was first created/issued)
  let tokenIssueTime = apiClient.getTokenIssueTime()
  
  // If no issue time exists, set it to now (for tokens created before this feature)
  // This ensures we can track the age going forward
  if (!tokenIssueTime) {
    const now = Date.now()
    // Store current time as issue time for existing tokens using apiClient method
    apiClient.setTokenIssueTime(now)
    tokenIssueTime = now
    console.log('[requireAuth] No issue time found, setting to current time:', new Date(now).toISOString())
  }

  // Calculate token age in milliseconds
  const now = Date.now()
  const tokenAge = now - tokenIssueTime
  const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000 // 30 days in milliseconds

  console.log('[requireAuth] Token age check:', {
    tokenIssueTime: new Date(tokenIssueTime).toISOString(),
    currentTime: new Date(now).toISOString(),
    tokenAgeMs: tokenAge,
    tokenAgeDays: Math.floor(tokenAge / (24 * 60 * 60 * 1000)),
    thirtyDaysInMs,
    isOlderThan30Days: tokenAge > thirtyDaysInMs,
  })

  // If token is > 30 days old, require relogin
  if (tokenAge > thirtyDaysInMs) {
    console.log('[requireAuth] Token is older than 30 days, requiring relogin')
    apiClient.clearTokens()
    throw redirect({
      to: '/login',
    })
  }

  // If token is < 30 days old, check if expired
  const expiresAt = apiClient.getTokenExpiresAt()
  if (!expiresAt) {
    throw redirect({
      to: '/login',
    })
  }

  const expiresAtNum = parseInt(expiresAt, 10)
  if (isNaN(expiresAtNum)) {
    apiClient.clearTokens()
    throw redirect({
      to: '/login',
    })
  }

  // Check if token is expired
  if (expiresAtNum <= now) {
    // Token is expired, try to refresh it
    try {
      await apiClient.refreshAccessToken()
      // Token refreshed successfully, continue
      return
    } catch (error) {
      // Refresh failed - tokens are already cleared by refreshAccessToken()
      // Ensure localStorage and sessionStorage are completely cleared
      console.error('[requireAuth] Token refresh failed, clearing all tokens and redirecting to login:', error)
      apiClient.clearTokens()
      
      // Explicitly clear localStorage to ensure everything is removed
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
          localStorage.removeItem('tokenExpiresAt')
          localStorage.removeItem('tokenIssueTime')
          localStorage.removeItem('rememberMe')
        } catch (e) {
          console.warn('[requireAuth] Error clearing localStorage:', e)
        }
      }
      
      // Explicitly clear sessionStorage
      if (typeof window !== 'undefined' && window.sessionStorage) {
        try {
          sessionStorage.removeItem('accessToken')
          sessionStorage.removeItem('refreshToken')
          sessionStorage.removeItem('tokenExpiresAt')
          sessionStorage.removeItem('tokenIssueTime')
          sessionStorage.removeItem('rememberMe')
        } catch (e) {
          console.warn('[requireAuth] Error clearing sessionStorage:', e)
        }
      }
      
      // Redirect to login page
      throw redirect({
        to: '/login',
      })
    }
  }

  // Token is valid and not expired
  return
}

