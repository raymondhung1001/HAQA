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

interface QueuedRequest<T> {
  resolve: (value: T) => void
  reject: (error: Error) => void
  request: () => Promise<T>
}

/**
 * API client for making HTTP requests
 * Uses HttpOnly cookies for secure token storage (set by server)
 */
class ApiClient {
  private baseUrl: string
  private refreshTokenPromise: Promise<AuthTokenResponse> | null = null
  private requestQueue: QueuedRequest<any>[] = []
  private isRefreshing: boolean = false
  private authCheckCache: { isValid: boolean; timestamp: number } | null = null
  private readonly AUTH_CHECK_CACHE_TTL = 5000 // 5 seconds cache for auth checks

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
      // Silently fail - CSRF token fetch error
    }

    return null
  }

  /**
   * Get a cookie value by name (only works for non-HttpOnly cookies)
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
      return typeof window !== 'undefined'
    } catch (e) {
      return false
    }
  }

  /**
   * Check authentication status via API call
   * Uses a short cache to avoid excessive API calls
   */
  async checkAuth(): Promise<boolean> {
    // Check cache first
    if (this.authCheckCache) {
      const now = Date.now()
      if (now - this.authCheckCache.timestamp < this.AUTH_CHECK_CACHE_TTL) {
        return this.authCheckCache.isValid
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}/auth/check`, {
        method: 'GET',
        credentials: 'include',
      })

      const isValid = response.ok
      this.authCheckCache = {
        isValid,
        timestamp: Date.now(),
      }
      return isValid
    } catch (error) {
      this.authCheckCache = {
        isValid: false,
        timestamp: Date.now(),
      }
      return false
    }
  }

  /**
   * Clear auth check cache
   */
  private clearAuthCache(): void {
    this.authCheckCache = null
  }

  /**
   * Process queued requests after token refresh completes
   */
  private async processRequestQueue(): Promise<void> {
    const queue = [...this.requestQueue]
    this.requestQueue = []

    for (const queuedRequest of queue) {
      try {
        const result = await queuedRequest.request()
        queuedRequest.resolve(result)
      } catch (error) {
        queuedRequest.reject(error as Error)
      }
    }
  }

  /**
   * Add request to queue if refresh is in progress
   */
  private async queueRequestIfRefreshing<T>(requestFn: () => Promise<T>): Promise<T> {
    if (this.isRefreshing && this.refreshTokenPromise) {
      return new Promise<T>((resolve, reject) => {
        this.requestQueue.push({
          resolve,
          reject,
          request: requestFn,
        })
      })
    }
    return requestFn()
  }

  /**
   * Clear all stored tokens and cookies
   * Note: HttpOnly cookies can only be cleared by server, but we clear any non-HttpOnly cookies
   */
  clearTokens(): void {
    if (!this.isBrowser()) return

    // Clear any non-HttpOnly cookies (if any)
    this.deleteCookie('accessToken')
    this.deleteCookie('refreshToken')
    this.deleteCookie('tokenExpiresAt')
    this.deleteCookie('rememberMe')
    this.deleteCookie('isAuthenticated')

    // Clear auth cache
    this.clearAuthCache()

    // Call logout endpoint to clear HttpOnly cookies on server
    fetch(`${this.baseUrl}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {
      // Silently fail - server might not have this endpoint
    })
  }

  /**
   * Refresh the access token using the refresh token
   * Tokens are stored in HttpOnly cookies by the server
   */
  async refreshAccessToken(): Promise<AuthTokenResponse> {
    // If there's already a refresh in progress, wait for it
    if (this.refreshTokenPromise) {
      return this.refreshTokenPromise
    }

    // Mark as refreshing
    this.isRefreshing = true

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
          credentials: 'include', // Refresh token is in HttpOnly cookie
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

        // Clear auth cache after refresh
        this.clearAuthCache()

        return data
      } catch (error) {
        this.clearTokens()
        throw error
      } finally {
        // Clear the promise and process queued requests
        this.refreshTokenPromise = null
        this.isRefreshing = false
        
        // Process queued requests
        await this.processRequestQueue()
      }
    })()

    return this.refreshTokenPromise
  }

  /**
   * Make an API request with automatic token refresh on 401
   * Tokens are automatically sent via HttpOnly cookies
   */
  async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryOn401: boolean = true
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const method = options.method || 'GET'

    // If refresh is in progress, queue this request
    if (this.isRefreshing) {
      return this.queueRequestIfRefreshing(() => this.request<T>(endpoint, options, retryOn401))
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    }

    // Add CSRF token for state-changing methods (POST, PUT, PATCH, DELETE)
    const isStateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())
    if (isStateChanging) {
      const csrfToken = await this.getCsrfToken()
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken
      }
    }

    // Make the request - tokens are automatically sent via HttpOnly cookies
    let response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include', // Include cookies (HttpOnly tokens)
    })

    // If we get a 401 and retry is enabled, try to refresh the token
    if (response.status === 401 && retryOn401) {
      try {
        // Clear auth cache
        this.clearAuthCache()

        // Attempt to refresh the token
        await this.refreshAccessToken()

        // Retry the original request
        // If refresh is still in progress, queue this retry
        if (this.isRefreshing) {
          return this.queueRequestIfRefreshing(() => this.request<T>(endpoint, options, false))
        }

        response = await fetch(url, {
          ...options,
          headers,
          credentials: 'include',
        })

        // If we still get 401 after refresh, throw error
        if (response.status === 401) {
          this.clearTokens()
          throw new Error('Session expired. Please login again.')
        }
      } catch (refreshError) {
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
   * Server will set tokens in HttpOnly cookies
   */
  async login(credentials: LoginRequest): Promise<AuthTokenResponse> {
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
    // Note: With HttpOnly cookies, tokens may be in cookies only, not in response body
    // But we still need expiresAt to know when to refresh
    if (!authData) {
      throw new Error('Invalid login response: no data received')
    }
    
    // Tokens might be in HttpOnly cookies only, so they may be missing from response
    // But we need expiresAt to track expiration
    if (!authData.expiresAt || typeof authData.expiresAt !== 'number') {
      throw new Error('Invalid login response: missing or invalid expiration time')
    }

    // If tokens are missing from response, create a placeholder response
    // The actual tokens are in HttpOnly cookies set by the server
    const result: AuthTokenResponse = {
      accessToken: authData.accessToken || '', // May be empty if in cookie only
      refreshToken: authData.refreshToken || '', // May be empty if in cookie only
      expiresIn: authData.expiresIn || Math.floor((authData.expiresAt - Date.now()) / 1000),
      expiresAt: authData.expiresAt,
      tokenType: authData.tokenType || 'Bearer',
    }

    // Clear auth cache after login
    this.clearAuthCache()

    // Note: Tokens are stored in HttpOnly cookies by the server
    // We don't need to store them client-side

    return result
  }

  /**
   * Refresh authentication tokens (public method for manual refresh)
   * Tokens are stored in HttpOnly cookies by the server
   * Refresh token is automatically sent via HttpOnly cookie
   */
  async refreshToken(): Promise<AuthTokenResponse> {
    // Use the internal refresh method which handles HttpOnly cookies
    return this.refreshAccessToken()
  }

  /**
   * Logout - clear tokens
   */
  logout(): void {
    this.clearTokens()
  }

  /**
   * Check if user is authenticated
   * Makes an API call to verify authentication status
   * Uses a short cache to avoid excessive calls
   */
  async isAuthenticated(): Promise<boolean> {
    return this.checkAuth()
  }

  /**
   * Get token (for backward compatibility)
   * Returns null since tokens are in HttpOnly cookies and not accessible to JavaScript
   * This is the security feature - tokens cannot be stolen via XSS
   */
  getToken(): string | null {
    // Tokens are in HttpOnly cookies, not accessible to JavaScript
    // This is intentional for security
    return null
  }

  /**
   * Get token expiration (for backward compatibility)
   * Returns null since tokens are in HttpOnly cookies
   * Expiration is validated server-side
   */
  getTokenExpiresAt(): string | null {
    // Tokens are in HttpOnly cookies, not accessible to JavaScript
    return null
  }

  /**
   * Get token issue time (for backward compatibility)
   * Returns null since tokens are in HttpOnly cookies
   */
  getTokenIssueTime(): number | null {
    // Tokens are in HttpOnly cookies, not accessible to JavaScript
    return null
  }

  /**
   * Set token issue time (for backward compatibility)
   * No-op since tokens are in HttpOnly cookies
   */
  setTokenIssueTime(_issueTime: number): void {
    // Tokens are in HttpOnly cookies, managed by server
  }

  /**
   * Test Cases API methods (using Workflows)
   */
  async createTestFlow(data: {
    name: string
    description?: string
    isActive?: boolean
  }) {
    return this.request<any>('/test-flow', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async searchTestFlows(params?: {
    query?: string
    isActive?: boolean
    userId?: number
    page?: number
    limit?: number
    sortBy?: 'createdAt' | 'updatedAt'
  }) {
    const queryParams = new URLSearchParams()
    if (params?.query) queryParams.append('query', params.query)
    if (params?.isActive !== undefined) queryParams.append('isActive', params.isActive.toString())
    if (params?.userId) queryParams.append('userId', params.userId.toString())
    if (params?.page) queryParams.append('page', params.page.toString())
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.sortBy) queryParams.append('sortBy', params.sortBy)

    const queryString = queryParams.toString()
    const endpoint = queryString ? `/test-flow?${queryString}` : '/test-flow'

    return this.request<any>(endpoint, {
      method: 'GET',
    })
  }
}

// Export singleton instance
export const apiClient = new ApiClient(API_BASE_URL)
