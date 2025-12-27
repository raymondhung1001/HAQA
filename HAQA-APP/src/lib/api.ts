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

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  /**
   * Get the stored access token from localStorage
   */
  getToken(): string | null {
    return localStorage.getItem('accessToken')
  }

  /**
   * Set the access token in localStorage
   */
  setToken(token: string): void {
    localStorage.setItem('accessToken', token)
  }

  /**
   * Get the stored refresh token from localStorage
   */
  getRefreshToken(): string | null {
    return localStorage.getItem('refreshToken')
  }

  /**
   * Set the refresh token in localStorage
   */
  setRefreshToken(token: string): void {
    localStorage.setItem('refreshToken', token)
  }

  /**
   * Clear all stored tokens
   */
  clearTokens(): void {
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
        const response = await fetch(`${this.baseUrl}/token/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refreshToken }),
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

        const data: AuthTokenResponse = await response.json()

        // Store new tokens
        this.setToken(data.accessToken)
        this.setRefreshToken(data.refreshToken)
        localStorage.setItem('tokenExpiresAt', String(data.expiresAt))

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

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    }

    // Add authorization header if token exists
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    let response = await fetch(url, {
      ...options,
      headers,
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
    const response = await this.request<AuthTokenResponse>(
      '/token',
      {
        method: 'POST',
        body: JSON.stringify(credentials),
      },
      false // Don't retry login on 401
    )

    // Store tokens
    this.setToken(response.accessToken)
    this.setRefreshToken(response.refreshToken)
    localStorage.setItem('tokenExpiresAt', String(response.expiresAt))

    return response
  }

  /**
   * Refresh authentication tokens (public method for manual refresh)
   */
  async refreshToken(refreshToken: string): Promise<AuthTokenResponse> {
    const response = await fetch(`${this.baseUrl}/token/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
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

    const data: AuthTokenResponse = await response.json()

    // Store tokens
    this.setToken(data.accessToken)
    this.setRefreshToken(data.refreshToken)
    localStorage.setItem('tokenExpiresAt', String(data.expiresAt))

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
    const token = this.getToken()
    const expiresAt = localStorage.getItem('tokenExpiresAt')
    
    if (!token || !expiresAt) {
      return false
    }

    // Check if token is expired
    const now = Date.now()
    const expiresAtNum = parseInt(expiresAt, 10)
    if (isNaN(expiresAtNum) || now >= expiresAtNum) {
      this.clearTokens()
      return false
    }

    return true
  }
}

// Export singleton instance
export const apiClient = new ApiClient(API_BASE_URL)

