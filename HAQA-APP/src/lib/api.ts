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
}

export interface RefreshTokenRequest {
  refreshToken: string
}

/**
 * API client for making HTTP requests
 */
class ApiClient {
  private baseUrl: string
  private refreshTokenPromise: Promise<AuthTokenResponse> | null = null
  private csrfToken: string | null = null

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  /**
   * Get CSRF token from cookie or fetch it from the server
   */
  private async getCsrfToken(): Promise<string | null> {
    // Try to read from cookie first (set by server with httpOnly: false)
    const cookieToken = this.getCookie('XSRF-TOKEN')
    if (cookieToken) {
      this.csrfToken = cookieToken
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
        this.csrfToken = headerToken
        return headerToken
      }

      // Try to read from cookie after the request
      const cookieTokenAfter = this.getCookie('XSRF-TOKEN')
      if (cookieTokenAfter) {
        this.csrfToken = cookieTokenAfter
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
    const value = `; ${document.cookie}`
    const parts = value.split(`; ${name}=`)
    if (parts.length === 2) {
      return parts.pop()?.split(';').shift() || null
    }
    return null
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
   * Get the stored access token from localStorage
   */
  getToken(): string | null {
    if (!this.isBrowser()) return null
    return localStorage.getItem('accessToken')
  }

  /**
   * Set the access token in localStorage
   */
  setToken(token: string): void {
    if (!this.isBrowser()) {
      console.warn('[setToken] Not in browser environment')
      return
    }
    if (!token) {
      console.warn('[setToken] Token is empty or undefined')
      return
    }
    try {
      localStorage.setItem('accessToken', token)
      console.log('[setToken] Token stored successfully, length:', token.length)
    } catch (error) {
      console.error('[setToken] Error storing token:', error)
      throw error
    }
  }

  /**
   * Get the stored refresh token from localStorage
   */
  getRefreshToken(): string | null {
    if (!this.isBrowser()) return null
    return localStorage.getItem('refreshToken')
  }

  /**
   * Set the refresh token in localStorage
   */
  setRefreshToken(token: string): void {
    if (!this.isBrowser()) {
      console.warn('[setRefreshToken] Not in browser environment')
      return
    }
    try {
      localStorage.setItem('refreshToken', token)
      console.log('[setRefreshToken] Refresh token stored successfully')
    } catch (error) {
      console.error('[setRefreshToken] Error storing refresh token:', error)
      throw error
    }
  }

  /**
   * Set the token expiration time
   */
  setTokenExpiresAt(expiresAt: number): void {
    if (!this.isBrowser()) {
      console.warn('[setTokenExpiresAt] Not in browser environment')
      return
    }
    try {
      const expiresAtStr = String(expiresAt)
      localStorage.setItem('tokenExpiresAt', expiresAtStr)
      console.log('[setTokenExpiresAt] Expiration time stored:', expiresAtStr)
    } catch (error) {
      console.error('[setTokenExpiresAt] Error storing expiration time:', error)
      throw error
    }
  }

  /**
   * Get the token expiration time
   */
  getTokenExpiresAt(): string | null {
    if (!this.isBrowser()) return null
    return localStorage.getItem('tokenExpiresAt')
  }

  /**
   * Clear all stored tokens
   */
  clearTokens(): void {
    if (!this.isBrowser()) return
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('tokenExpiresAt')
  }

  /**
   * Refresh the access token using the refresh token
   */
  async refreshAccessToken(): Promise<AuthTokenResponse> {
    // If there's already a refresh in progress, wait for it
    if (this.refreshTokenPromise) {
      return this.refreshTokenPromise
    }

    const refreshToken = this.getRefreshToken()
    if (!refreshToken) {
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
          // If refresh fails, clear tokens and throw error
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

        // Store new tokens
        this.setToken(data.accessToken)
        this.setRefreshToken(data.refreshToken)
        this.setTokenExpiresAt(data.expiresAt)

        return data
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
        }
      } catch (refreshError) {
        // If refresh fails, clear tokens and throw the original error
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
    const response = await this.request<any>(
      '/token',
      {
        method: 'POST',
        body: JSON.stringify(credentials),
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
    })
    
    // Ensure we're in browser before storing
    if (!this.isBrowser()) {
      console.error('[Login] Not in browser environment, cannot store tokens')
      throw new Error('Cannot store tokens: not in browser environment')
    }
    
    try {
      this.setToken(authData.accessToken)
      this.setRefreshToken(authData.refreshToken)
      this.setTokenExpiresAt(authData.expiresAt)
      
      // Verify tokens were stored
      const storedToken = this.getToken()
      const storedExpiresAt = this.getTokenExpiresAt()
      console.log('[Login] Verification:', {
        storedToken: storedToken ? `${storedToken.substring(0, 20)}...` : 'null',
        storedTokenLength: storedToken?.length || 0,
        storedExpiresAt: storedExpiresAt,
        storedExpiresAtType: typeof storedExpiresAt,
        isAuthenticated: this.isAuthenticated(),
        localStorageKeys: typeof window !== 'undefined' ? Object.keys(localStorage) : [],
      })
      
      // Double-check by reading directly from localStorage
      const directToken = localStorage.getItem('accessToken')
      const directExpiresAt = localStorage.getItem('tokenExpiresAt')
      console.log('[Login] Direct localStorage check:', {
        directToken: directToken ? `${directToken.substring(0, 20)}...` : 'null',
        directExpiresAt: directExpiresAt,
      })
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

    // Store tokens
    this.setToken(data.accessToken)
    this.setRefreshToken(data.refreshToken)
    this.setTokenExpiresAt(data.expiresAt)

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
   */
  isAuthenticated(): boolean {
    if (!this.isBrowser()) return false
    
    const token = this.getToken()
    const expiresAt = this.getTokenExpiresAt()
    
    if (!token) {
      console.debug('[Auth] No token found')
      return false
    }
    
    if (!expiresAt) {
      console.debug('[Auth] No expiration time found')
      return false
    }

    // Check if token is expired
    const now = Date.now()
    const expiresAtNum = parseInt(expiresAt, 10)
    
    if (isNaN(expiresAtNum)) {
      // Invalid expiration time, clear tokens
      console.warn('[Auth] Invalid expiration time:', expiresAt)
      this.clearTokens()
      return false
    }
    
    // Check if token is expired
    // expiresAt is in milliseconds (timestamp)
    const timeUntilExpiry = expiresAtNum - now
    if (timeUntilExpiry <= 0) {
      // Token is expired, clear tokens
      console.debug('[Auth] Token expired. Expired', Math.abs(timeUntilExpiry), 'ms ago')
      this.clearTokens()
      return false
    }

    console.debug('[Auth] Token valid. Expires in', Math.floor(timeUntilExpiry / 1000), 'seconds')
    return true
  }
}

// Export singleton instance
export const apiClient = new ApiClient(API_BASE_URL)

