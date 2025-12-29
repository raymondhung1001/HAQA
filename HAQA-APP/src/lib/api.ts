// API base URL - defaults to localhost:3001/api (NestJS default with global prefix)
// This can be overridden via environment variables if needed
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

export interface AuthTokenResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
  expiresAt: number
  tokenType: 'Bearer'
}

export interface LoginRequest {
  username: string
  password: string
  rememberMe?: boolean
}


/**
 * API client for making HTTP requests
 */
class ApiClient {
  private baseUrl: string
  private refreshTokenPromise: Promise<AuthTokenResponse> | null = null
  private storageListeners: Set<() => void> = new Set()

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
    this.setupStorageSync()
  }

  /**
   * Setup storage event listeners to sync auth state across tabs
   */
  private setupStorageSync(): void {
    if (!this.isBrowser()) return

    // Listen for storage changes from other tabs
    const handleStorageChange = (e: StorageEvent) => {
      // Only handle our auth-related keys
      if (e.key === 'accessToken' || e.key === 'refreshToken' || e.key === 'tokenExpiresAt' || e.key === 'rememberMe') {
        console.log('[StorageSync] Storage changed in another tab:', e.key)
        // Trigger any registered listeners (e.g., for TanStack Query cache invalidation)
        this.storageListeners.forEach(listener => listener())
      }
    }

    window.addEventListener('storage', handleStorageChange)
  }

  /**
   * Register a listener to be called when auth state changes in other tabs
   */
  onAuthStateChange(listener: () => void): () => void {
    this.storageListeners.add(listener)
    return () => {
      this.storageListeners.delete(listener)
    }
  }

  /**
   * Get CSRF token from cookie or fetch it from the server
   */
  private async getCsrfToken(): Promise<string | null> {
    // Try to read from cookie first (set by server with httpOnly: false)
    const cookieToken = this.getCookie('XSRF-TOKEN')
    if (cookieToken) {
      return cookieToken
    }

    // If not in cookie, fetch it by making a GET request to root endpoint
    // The server will set the token in response header and cookie
    try {
      const response = await fetch(`${this.baseUrl}/`, {
        method: 'GET',
        credentials: 'include',
      })

      // Try to get from response header
      const headerToken = response.headers.get('X-CSRF-Token')
      if (headerToken) {
        return headerToken
      }

      // Try to read from cookie after the request
      const cookieTokenAfter = this.getCookie('XSRF-TOKEN')
      if (cookieTokenAfter) {
        return cookieTokenAfter
      }
    } catch (error) {
      console.warn('Failed to fetch CSRF token:', error)
    }

    return null
  }

  /**
   * Get a cookie value by name
   */
  private getCookie(name: string): string | null {
    if (!this.isBrowser()) return null
    const value = `; ${document.cookie}`
    const parts = value.split(`; ${name}=`)
    if (parts.length === 2) {
      const cookieValue = parts.pop()?.split(';').shift() || null
      if (cookieValue) {
        try {
          return decodeURIComponent(cookieValue)
        } catch (e) {
          // If decoding fails, return the raw value (for backward compatibility)
          return cookieValue
        }
      }
      return null
    }
    return null
  }


  /**
   * Delete a cookie
   */
  private deleteCookie(name: string, path: string = '/'): void {
    if (!this.isBrowser()) return
    // Set expiration date to the past to delete the cookie
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path};`
  }

  /**
   * Check if we're in a browser environment
   */
  private isBrowser(): boolean {
    try {
      return typeof window !== 'undefined' && 
             typeof localStorage !== 'undefined' &&
             window.localStorage !== null
    } catch (e) {
      return false
    }
  }


  /**
   * Get the storage instance based on rememberMe preference
   */
  private getStorage(rememberMe: boolean): Storage {
    return rememberMe ? localStorage : sessionStorage
  }

  /**
   * Get the stored access token from localStorage or sessionStorage
   */
  getToken(): string | null {
    if (!this.isBrowser()) return null
    
    // Check localStorage first (for rememberMe)
    const localToken = localStorage.getItem('accessToken')
    if (localToken) {
      return localToken
    }
    
    // Check sessionStorage (for non-rememberMe)
    const sessionToken = sessionStorage.getItem('accessToken')
    if (sessionToken) {
      return sessionToken
    }
    
    // Fallback to cookie for backward compatibility
    return this.getCookie('accessToken')
  }

  /**
   * Set the access token in localStorage (rememberMe) or sessionStorage (no rememberMe)
   * @param token - The access token to store
   * @param rememberMe - Whether to use localStorage (true) or sessionStorage (false)
   * @param updateIssueTime - Whether to update the token issue time (default: true, set to false on refresh)
   */
  setToken(token: string, rememberMe: boolean = false, updateIssueTime: boolean = true): void {
    if (!this.isBrowser()) {
      console.warn('[setToken] Not in browser environment')
      return
    }
    if (!token) {
      console.warn('[setToken] Token is empty or undefined')
      return
    }
    try {
      const storage = this.getStorage(rememberMe)
      
      // Clear from both storages first to avoid conflicts
      localStorage.removeItem('accessToken')
      sessionStorage.removeItem('accessToken')
      
      // Store in the appropriate storage
      storage.setItem('accessToken', token)
      
      // Store token issue time (when token was first created/issued)
      // Only update if this is a new token (not a refresh)
      // This is used to check if token is > 30 days old
      if (updateIssueTime) {
        const tokenIssueTime = Date.now()
        const tokenIssueTimeStr = String(tokenIssueTime)
        localStorage.removeItem('tokenIssueTime')
        sessionStorage.removeItem('tokenIssueTime')
        storage.setItem('tokenIssueTime', tokenIssueTimeStr)
      }
      
      console.log('[setToken] Token stored successfully in', rememberMe ? 'localStorage' : 'sessionStorage', 'rememberMe:', rememberMe, 'length:', token.length)
    } catch (error) {
      console.error('[setToken] Error storing token:', error)
      throw error
    }
  }

  /**
   * Get the stored refresh token from localStorage or sessionStorage
   */
  getRefreshToken(): string | null {
    if (!this.isBrowser()) return null
    
    // Check localStorage first (for rememberMe)
    const localToken = localStorage.getItem('refreshToken')
    if (localToken) {
      return localToken
    }
    
    // Check sessionStorage (for non-rememberMe)
    const sessionToken = sessionStorage.getItem('refreshToken')
    if (sessionToken) {
      return sessionToken
    }
    
    // Fallback to cookie for backward compatibility
    return this.getCookie('refreshToken')
  }

  /**
   * Set the refresh token in localStorage (rememberMe) or sessionStorage (no rememberMe)
   */
  setRefreshToken(token: string, rememberMe: boolean = false): void {
    if (!this.isBrowser()) {
      console.warn('[setRefreshToken] Not in browser environment')
      return
    }
    try {
      const storage = this.getStorage(rememberMe)
      
      // Clear from both storages first to avoid conflicts
      localStorage.removeItem('refreshToken')
      sessionStorage.removeItem('refreshToken')
      
      // Store in the appropriate storage
      storage.setItem('refreshToken', token)
      
      console.log('[setRefreshToken] Refresh token stored successfully in', rememberMe ? 'localStorage' : 'sessionStorage', 'rememberMe:', rememberMe)
    } catch (error) {
      console.error('[setRefreshToken] Error storing refresh token:', error)
      throw error
    }
  }

  /**
   * Set the token expiration time in localStorage (rememberMe) or sessionStorage (no rememberMe)
   */
  setTokenExpiresAt(expiresAt: number, rememberMe: boolean = false): void {
    if (!this.isBrowser()) {
      console.warn('[setTokenExpiresAt] Not in browser environment')
      return
    }
    try {
      const expiresAtStr = String(expiresAt)
      const storage = this.getStorage(rememberMe)
      
      // Clear from both storages first to avoid conflicts
      localStorage.removeItem('tokenExpiresAt')
      sessionStorage.removeItem('tokenExpiresAt')
      
      // Store in the appropriate storage
      storage.setItem('tokenExpiresAt', expiresAtStr)
      
      console.log('[setTokenExpiresAt] Expiration time stored in', rememberMe ? 'localStorage' : 'sessionStorage', 'rememberMe:', rememberMe, ':', expiresAtStr)
    } catch (error) {
      console.error('[setTokenExpiresAt] Error storing expiration time:', error)
      throw error
    }
  }

  /**
   * Get the token expiration time from localStorage or sessionStorage
   */
  getTokenExpiresAt(): string | null {
    if (!this.isBrowser()) return null
    
    // Check localStorage first (for rememberMe)
    const localExpiresAt = localStorage.getItem('tokenExpiresAt')
    if (localExpiresAt) {
      return localExpiresAt
    }
    
    // Check sessionStorage (for non-rememberMe)
    const sessionExpiresAt = sessionStorage.getItem('tokenExpiresAt')
    if (sessionExpiresAt) {
      return sessionExpiresAt
    }
    
    // Fallback to cookie for backward compatibility
    return this.getCookie('tokenExpiresAt')
  }

  /**
   * Get the token issue time (when token was first created/issued)
   * Returns null if not found
   */
  getTokenIssueTime(): number | null {
    if (!this.isBrowser()) return null
    
    // Check localStorage first (for rememberMe)
    const localIssueTime = localStorage.getItem('tokenIssueTime')
    if (localIssueTime) {
      const issueTimeNum = parseInt(localIssueTime, 10)
      return isNaN(issueTimeNum) ? null : issueTimeNum
    }
    
    // Check sessionStorage (for non-rememberMe)
    const sessionIssueTime = sessionStorage.getItem('tokenIssueTime')
    if (sessionIssueTime) {
      const issueTimeNum = parseInt(sessionIssueTime, 10)
      return isNaN(issueTimeNum) ? null : issueTimeNum
    }
    
    return null
  }

  /**
   * Set the token issue time (when token was first created/issued)
   * Uses the same storage as the token (based on rememberMe preference)
   */
  setTokenIssueTime(issueTime: number): void {
    if (!this.isBrowser()) return
    
    // Get rememberMe preference from storage (default to false if not found)
    const rememberMeLocal = localStorage.getItem('rememberMe') === 'true'
    const rememberMeSession = sessionStorage.getItem('rememberMe') === 'true'
    const rememberMe = rememberMeLocal || rememberMeSession
    
    const storage = this.getStorage(rememberMe)
    const issueTimeStr = String(issueTime)
    
    // Clear from both storages first to avoid conflicts
    localStorage.removeItem('tokenIssueTime')
    sessionStorage.removeItem('tokenIssueTime')
    
    // Store in the appropriate storage
    storage.setItem('tokenIssueTime', issueTimeStr)
  }

  /**
   * Clear all stored tokens from localStorage, sessionStorage, and cookies
   */
  clearTokens(): void {
    if (!this.isBrowser()) return
    
    // Clear from localStorage
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('tokenExpiresAt')
    localStorage.removeItem('tokenIssueTime')
    localStorage.removeItem('rememberMe')
    
    // Clear from sessionStorage
    sessionStorage.removeItem('accessToken')
    sessionStorage.removeItem('refreshToken')
    sessionStorage.removeItem('tokenExpiresAt')
    sessionStorage.removeItem('tokenIssueTime')
    sessionStorage.removeItem('rememberMe')
    
    // Clear from cookies (for backward compatibility)
    this.deleteCookie('accessToken')
    this.deleteCookie('refreshToken')
    this.deleteCookie('tokenExpiresAt')
    this.deleteCookie('rememberMe')
    
    console.log('[clearTokens] All tokens cleared from localStorage, sessionStorage, and cookies')
  }

  /**
   * Refresh the access token using the refresh token
   */
  async refreshAccessToken(): Promise<AuthTokenResponse> {
    // If there's already a refresh in progress, wait for it
    if (this.refreshTokenPromise) {
      return this.refreshTokenPromise
    }

    // Get rememberMe preference from storage (default to false if not found)
    const rememberMeLocal = localStorage.getItem('rememberMe') === 'true'
    const rememberMeSession = sessionStorage.getItem('rememberMe') === 'true'
    const rememberMe = rememberMeLocal || rememberMeSession

    const refreshToken = this.getRefreshToken()
    if (!refreshToken) {
      // No refresh token available, clear all tokens and throw error
      this.clearTokens()
      throw new Error('No refresh token available')
    }

    // Create the refresh promise
    this.refreshTokenPromise = (async () => {
      try {
        // Get CSRF token for the refresh request
        const csrfToken = await this.getCsrfToken()
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        }
        if (csrfToken) {
          headers['X-CSRF-Token'] = csrfToken
        }

        const response = await fetch(`${this.baseUrl}/token/refresh`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ refreshToken }),
          credentials: 'include',
        })

        if (!response.ok) {
          // If refresh fails, clear all tokens from localStorage/sessionStorage and throw error
          console.error('[refreshAccessToken] Refresh failed with status:', response.status)
          this.clearTokens()
          let errorMessage = 'Failed to refresh token'
          try {
            const errorData = await response.json()
            errorMessage = errorData.message || errorData.error || errorMessage
          } catch {
            errorMessage = response.statusText || `HTTP ${response.status}`
          }
          throw new Error(errorMessage)
        }

        const responseData = await response.json()
        
        // The API wraps responses in a SuccessResponse format with a 'data' property
        // Extract the actual auth data from the response
        const data: AuthTokenResponse = responseData?.data || responseData

        // Store new tokens (preserving rememberMe preference)
        // Don't update issue time on refresh - keep original login time
        this.setToken(data.accessToken, rememberMe, false)
        this.setRefreshToken(data.refreshToken, rememberMe)
        this.setTokenExpiresAt(data.expiresAt, rememberMe)

        return data
      } catch (error) {
        // If any error occurs during refresh (network error, parsing error, etc.)
        // clear all tokens from localStorage/sessionStorage
        console.error('[refreshAccessToken] Error during token refresh:', error)
        this.clearTokens()
        throw error
      } finally {
        // Clear the promise so future requests can trigger a new refresh
        this.refreshTokenPromise = null
      }
    })()

    return this.refreshTokenPromise
  }

  /**
   * Make an API request with automatic token refresh on 401
   */
  async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryOn401: boolean = true
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const token = this.getToken()

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    }

    // Add authorization header if token exists
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    // Add CSRF token for state-changing methods (POST, PUT, PATCH, DELETE)
    // Skip CSRF if Bearer token is present (API authentication)
    const method = options.method || 'GET'
    const isStateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())
    if (isStateChanging && !token) {
      // Only add CSRF token if we don't have a Bearer token
      const csrfToken = await this.getCsrfToken()
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken
      }
    }

    let response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include', // Include cookies for CSRF token
    })

    // If we get a 401 and retry is enabled, try to refresh the token
    if (response.status === 401 && retryOn401 && token) {
      try {
        // Attempt to refresh the token
        await this.refreshAccessToken()

        // Retry the original request with the new token
        const newToken = this.getToken()
        if (newToken) {
          headers['Authorization'] = `Bearer ${newToken}`
          response = await fetch(url, {
            ...options,
            headers,
            credentials: 'include',
          })
          
          // If we still get 401 after refresh, return the error response
          // Don't redirect - let the calling code handle it
          if (response.status === 401) {
            console.warn('[request] Still got 401 after token refresh, returning error response')
            // Don't clear tokens here - let the calling code decide what to do
            // Just return the error response
          }
        } else {
          // No new token after refresh, clear tokens and throw error
          console.error('[request] No token available after refresh')
          this.clearTokens()
          throw new Error('Session expired. Please login again.')
        }
      } catch (refreshError) {
        // If refresh fails, clear tokens but don't redirect
        // Let the calling code handle the error
        console.error('[request] Token refresh failed during API request:', refreshError)
        this.clearTokens()
        throw new Error('Session expired. Please login again.')
      }
    }

    if (!response.ok) {
      let errorMessage = 'An error occurred'
      try {
        const errorData = await response.json()
        errorMessage = errorData.message || errorData.error || errorMessage
      } catch {
        errorMessage = response.statusText || `HTTP ${response.status}`
      }
      throw new Error(errorMessage)
    }

    return response.json()
  }

  /**
   * Login and get authentication tokens
   */
  async login(credentials: LoginRequest): Promise<AuthTokenResponse> {
    // Get rememberMe preference (default to false if not specified)
    const rememberMe = credentials.rememberMe === true

    // Remove rememberMe from credentials before sending to API
    const { rememberMe: _, ...apiCredentials } = credentials

    const response = await this.request<any>(
      '/token',
      {
        method: 'POST',
        body: JSON.stringify(apiCredentials),
      },
      false // Don't retry login on 401
    )

    // The API wraps responses in a SuccessResponse format with a 'data' property
    // Extract the actual auth data from the response
    const authData: AuthTokenResponse = response?.data || response

    // Validate response data
    if (!authData || !authData.accessToken || !authData.refreshToken) {
      console.error('[Login] Invalid response:', { response, authData })
      throw new Error('Invalid login response: missing tokens')
    }
    
    if (!authData.expiresAt || typeof authData.expiresAt !== 'number') {
      console.error('[Login] Invalid expiration time:', authData.expiresAt)
      throw new Error('Invalid login response: missing or invalid expiration time')
    }
    
    // Store tokens
    console.log('[Login] Storing tokens:', {
      hasAccessToken: !!authData.accessToken,
      hasRefreshToken: !!authData.refreshToken,
      expiresAt: authData.expiresAt,
      expiresAtType: typeof authData.expiresAt,
      currentTime: Date.now(),
      timeUntilExpiry: authData.expiresAt - Date.now(),
      isBrowser: this.isBrowser(),
      rememberMe,
      storageType: rememberMe ? 'localStorage' : 'sessionStorage',
    })
    
    // Ensure we're in browser before storing
    if (!this.isBrowser()) {
      console.error('[Login] Not in browser environment, cannot store tokens')
      throw new Error('Cannot store tokens: not in browser environment')
    }
    
    try {
      // Store rememberMe preference in localStorage so we can preserve it on refresh
      // This helps us know which storage to use when reading tokens
      if (rememberMe) {
        localStorage.setItem('rememberMe', 'true')
        sessionStorage.removeItem('rememberMe')
      } else {
        sessionStorage.setItem('rememberMe', 'false')
        localStorage.removeItem('rememberMe')
      }
      
      this.setToken(authData.accessToken, rememberMe)
      this.setRefreshToken(authData.refreshToken, rememberMe)
      this.setTokenExpiresAt(authData.expiresAt, rememberMe)
      
      // Verify tokens were stored correctly
      const retrievedToken = this.getToken()
      const retrievedRefreshToken = this.getRefreshToken()
      const retrievedExpiresAt = this.getTokenExpiresAt()
      
      console.log('[Login] Verification:', {
        rememberMe,
        storageType: rememberMe ? 'localStorage' : 'sessionStorage',
        retrievedToken: retrievedToken ? `${retrievedToken.substring(0, 20)}...` : 'null',
        retrievedTokenLength: retrievedToken?.length || 0,
        retrievedRefreshToken: retrievedRefreshToken ? 'present' : 'null',
        retrievedExpiresAt: retrievedExpiresAt,
        isAuthenticated: this.isAuthenticated(),
      })
      
      if (!retrievedToken || !retrievedExpiresAt) {
        console.error('[Login] ERROR: Tokens not stored correctly!', {
          retrievedToken: !!retrievedToken,
          retrievedExpiresAt: !!retrievedExpiresAt,
        })
      }
    } catch (error) {
      console.error('[Login] Error storing tokens:', error)
      throw error
    }

    return authData
  }

  /**
   * Refresh authentication tokens (public method for manual refresh)
   */
  async refreshToken(refreshToken: string): Promise<AuthTokenResponse> {
    // Get rememberMe preference from storage (default to false if not found)
    const rememberMeLocal = localStorage.getItem('rememberMe') === 'true'
    const rememberMeSession = sessionStorage.getItem('rememberMe') === 'true'
    const rememberMe = rememberMeLocal || rememberMeSession

    // Get CSRF token for the refresh request
    const csrfToken = await this.getCsrfToken()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken
    }

    const response = await fetch(`${this.baseUrl}/token/refresh`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ refreshToken }),
      credentials: 'include',
    })

    if (!response.ok) {
      this.clearTokens()
      let errorMessage = 'Failed to refresh token'
      try {
        const errorData = await response.json()
        errorMessage = errorData.message || errorData.error || errorMessage
      } catch {
        errorMessage = response.statusText || `HTTP ${response.status}`
      }
      throw new Error(errorMessage)
    }

    const responseData = await response.json()
    
    // The API wraps responses in a SuccessResponse format with a 'data' property
    // Extract the actual auth data from the response
    const data: AuthTokenResponse = responseData?.data || responseData

    // Store tokens (preserving rememberMe preference)
    // Don't update issue time on refresh - keep original login time
    this.setToken(data.accessToken, rememberMe, false)
    this.setRefreshToken(data.refreshToken, rememberMe)
    this.setTokenExpiresAt(data.expiresAt, rememberMe)

    return data
  }

  /**
   * Logout - clear tokens
   */
  logout(): void {
    this.clearTokens()
  }

  /**
   * Check if user is authenticated
   * This is a fast synchronous check for route guards
   */
  isAuthenticated(): boolean {
    if (!this.isBrowser()) {
      return false
    }
    
    try {
      // Fast synchronous check - localStorage/sessionStorage are synchronous
      const token = this.getToken()
      const expiresAt = this.getTokenExpiresAt()
      
      if (!token || !expiresAt) {
        return false
      }

      // Check if token is expired
      const now = Date.now()
      const expiresAtNum = parseInt(expiresAt, 10)
      
      if (isNaN(expiresAtNum)) {
        // Invalid expiration time, clear tokens
        this.clearTokens()
        return false
      }
      
      // Check if token is expired
      // expiresAt is in milliseconds (timestamp)
      const timeUntilExpiry = expiresAtNum - now
      if (timeUntilExpiry <= 0) {
        // Token is expired
        const rememberMe = localStorage.getItem('rememberMe') === 'true' || sessionStorage.getItem('rememberMe') === 'true'
        const refreshToken = this.getRefreshToken()
        
        // If we have a refresh token and rememberMe is true, we might be able to refresh
        // But for route guards, we'll return false and let the refresh happen on the next API call
        if (!refreshToken || !rememberMe) {
          this.clearTokens()
        }
        return false
      }

      return true
    } catch (error) {
      console.error('[isAuthenticated] Error checking authentication:', error)
      return false
    }
  }
  
}

// Export singleton instance
export const apiClient = new ApiClient(API_BASE_URL)

