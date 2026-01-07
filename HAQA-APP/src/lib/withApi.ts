// API base URL - defaults to localhost:3001/api (NestJS default with global prefix)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

/**
 * Custom error class for session expiration
 * This allows React Query to identify and handle session expiration errors differently
 */
export class SessionExpiredError extends Error {
  constructor(message: string = 'Session expired. Please login again.') {
    super(message)
    this.name = 'SessionExpiredError'
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SessionExpiredError)
    }
  }
}

/**
 * Custom error class for unauthorized access
 */
export class UnauthorizedError extends Error {
  constructor(message: string = 'Not authorized. Please login again.') {
    super(message)
    this.name = 'UnauthorizedError'
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, UnauthorizedError)
    }
  }
}

/**
 * Auth token response interface
 */
export interface AuthTokenResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
  expiresAt: number
  tokenType: 'Bearer'
}

/**
 * Login request interface
 */
export interface LoginRequest {
  username: string
  password: string
  rememberMe?: boolean
}

/**
 * Extended RequestInit with additional options for withApi
 */
export interface WithApiOptions extends RequestInit {
  /**
   * Whether to retry the request on 401 with token refresh (default: true)
   */
  retryOn401?: boolean
  /**
   * Whether to include CSRF token (default: auto-detect based on method)
   */
  includeCsrf?: boolean
  /**
   * Custom base URL (default: uses API client base URL)
   */
  baseUrl?: string
  /**
   * Whether to parse JSON response automatically (default: true)
   */
  parseJson?: boolean
}

/**
 * Response wrapper that includes the raw Response object
 */
export interface ApiResponse<T = any> {
  data: T
  response: Response
  status: number
  statusText: string
  headers: Headers
}

/**
 * Request queuing for token refresh
 */
interface QueuedRequest<T> {
  resolve: (value: T) => void
  reject: (error: Error) => void
  request: () => Promise<T>
}

// Global state for token refresh queuing
let refreshTokenPromise: Promise<AuthTokenResponse> | null = null
let requestQueue: QueuedRequest<any>[] = []
let isRefreshing: boolean = false
let authCheckCache: { isValid: boolean; timestamp: number } | null = null
const AUTH_CHECK_CACHE_TTL = 5000 // 5 seconds cache for auth checks

/**
 * Get a cookie value by name (only works for non-HttpOnly cookies)
 */
function getCookie(name: string): string | null {
  if (typeof window === 'undefined') return null
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
function deleteCookie(name: string, path: string = '/'): void {
  if (typeof window === 'undefined') return
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path};`
}

/**
 * Clear auth check cache
 */
function clearAuthCache(): void {
  authCheckCache = null
}

/**
 * Clear all stored tokens and cookies
 */
export function clearTokens(): void {
  if (typeof window === 'undefined') return

  // Clear any non-HttpOnly cookies
  deleteCookie('accessToken')
  deleteCookie('refreshToken')
  deleteCookie('tokenExpiresAt')
  deleteCookie('rememberMe')
  deleteCookie('isAuthenticated')

  // Clear auth cache
  clearAuthCache()
}

/**
 * Get CSRF token from cookie or fetch it from the server
 */
async function getCsrfToken(baseUrl: string): Promise<string | null> {
  if (typeof window === 'undefined') return null

  // Try to read from cookie first
  const cookieToken = getCookie('XSRF-TOKEN')
  if (cookieToken) {
    return cookieToken
  }

  // If not in cookie, fetch it by making a GET request to root endpoint
  try {
    const response = await fetch(`${baseUrl}/`, {
      method: 'GET',
      credentials: 'include',
    })

    // Try to get from response header
    const headerToken = response.headers.get('X-CSRF-Token')
    if (headerToken) {
      return headerToken
    }

    // Try to read from cookie after the request
    const cookieTokenAfter = getCookie('XSRF-TOKEN')
    if (cookieTokenAfter) {
      return cookieTokenAfter
    }
  } catch (error) {
    // Silently fail - CSRF token fetch error
  }

  return null
}

/**
 * Get the API base URL
 */
function getBaseUrl(customBaseUrl?: string): string {
  if (customBaseUrl) {
    return customBaseUrl
  }
  return API_BASE_URL
}

/**
 * Check if an endpoint is a token endpoint
 */
function isTokenEndpoint(url: string, baseUrl: string): boolean {
  const normalizedUrl = url.startsWith('http') ? url : `${baseUrl}${url.startsWith('/') ? url : `/${url}`}`
  return normalizedUrl.includes('/token') && !normalizedUrl.includes('/token/refresh')
}

/**
 * Check if an endpoint is a token refresh endpoint
 */
function isTokenRefreshEndpoint(url: string, baseUrl: string): boolean {
  const normalizedUrl = url.startsWith('http') ? url : `${baseUrl}${url.startsWith('/') ? url : `/${url}`}`
  return normalizedUrl.includes('/token/refresh')
}

/**
 * Process queued requests after token refresh completes
 */
async function processRequestQueue(): Promise<void> {
  const queue = [...requestQueue]
  requestQueue = []

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
async function queueRequestIfRefreshing<T>(requestFn: () => Promise<T>): Promise<T> {
  if (isRefreshing && refreshTokenPromise) {
    return new Promise<T>((resolve, reject) => {
      requestQueue.push({
        resolve,
        reject,
        request: requestFn,
      })
    })
  }
  return requestFn()
}

/**
 * Refresh the access token using the refresh token
 * Tokens are stored in HttpOnly cookies by the server
 */
export async function refreshAccessToken(): Promise<AuthTokenResponse> {
  // If there's already a refresh in progress, wait for it
  if (refreshTokenPromise) {
    return refreshTokenPromise
  }

  // Mark as refreshing
  isRefreshing = true

  // Create the refresh promise
  refreshTokenPromise = (async () => {
    try {
      const baseUrl = getBaseUrl()
      
      // Get CSRF token for the refresh request
      const csrfToken = await getCsrfToken(baseUrl)
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken
      }

      let response: Response
      try {
        response = await fetch(`${baseUrl}/token/refresh`, {
          method: 'POST',
          headers,
          credentials: 'include',
        })
      } catch (error: any) {
        // Handle connection errors
        if (
          error?.code === 'ECONNREFUSED' ||
          error?.cause?.code === 'ECONNREFUSED' ||
          error?.message?.includes('fetch failed')
        ) {
          clearTokens()
          const errorMessage = `Cannot connect to API server at ${baseUrl}. Please ensure the API server is running.`
          console.error(errorMessage, error)
          throw new Error(errorMessage)
        }
        clearTokens()
        throw error
      }

      if (!response.ok) {
        clearTokens()
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
      const data: AuthTokenResponse = responseData?.data || responseData

      // Clear auth cache after refresh
      clearAuthCache()

      return data
    } catch (error) {
      clearTokens()
      throw error
    } finally {
      // Clear the promise and process queued requests
      refreshTokenPromise = null
      isRefreshing = false
      
      // Process queued requests
      await processRequestQueue()
    }
  })()

  return refreshTokenPromise
}

/**
 * withApi - A wrapper for fetch that includes authorization headers and handles authentication
 */
export async function withApi<T = any>(
  url: string,
  options: WithApiOptions = {}
): Promise<T | ApiResponse<T>> {
  const {
    retryOn401 = true,
    includeCsrf,
    baseUrl: customBaseUrl,
    parseJson = true,
    ...fetchOptions
  } = options

  const baseUrl = getBaseUrl(customBaseUrl)
  
  // Determine if URL is absolute or relative
  const isAbsoluteUrl = url.startsWith('http://') || url.startsWith('https://')
  const fullUrl = isAbsoluteUrl ? url : `${baseUrl}${url.startsWith('/') ? url : `/${url}`}`

  const method = (fetchOptions.method || 'GET').toUpperCase()
  
  // Prepare headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  }

  // Add CSRF token for state-changing methods or if explicitly requested
  const isStateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
  const shouldIncludeCsrf = includeCsrf !== false && (includeCsrf === true || isStateChanging)
  
  if (shouldIncludeCsrf) {
    const csrfToken = await getCsrfToken(baseUrl)
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken
    }
  }

  // Determine endpoint type
  const isToken = isTokenEndpoint(url, baseUrl)
  const isRefresh = isTokenRefreshEndpoint(url, baseUrl)
  const isRegularEndpoint = !isToken && !isRefresh

  // If refresh is in progress and this is a regular endpoint, queue it
  if (isRefreshing && isRegularEndpoint && retryOn401) {
    return queueRequestIfRefreshing(() => withApi<T>(url, options))
  }

  // Make the request - tokens are automatically sent via HttpOnly cookies
  let response: Response
  let cachedBody: string | undefined = fetchOptions.body as string | undefined
  
  try {
    response = await fetch(fullUrl, {
      ...fetchOptions,
      headers,
      credentials: 'include',
    })
  } catch (error: any) {
    // Handle connection errors
    if (
      error?.code === 'ECONNREFUSED' ||
      error?.cause?.code === 'ECONNREFUSED' ||
      error?.message?.includes('fetch failed')
    ) {
      const errorMessage = `Cannot connect to API server at ${baseUrl}. Please ensure the API server is running.`
      console.error(errorMessage, error)
      throw new Error(errorMessage)
    }
    throw error
  }

  // Handle 401 responses based on endpoint type
  if (response.status === 401) {
    // Case 1: /token endpoint (login) - throw unauthorized error immediately
    if (isToken) {
      throw new UnauthorizedError('Invalid credentials. Please check your username and password.')
    }

    // Case 2: /token/refresh endpoint - logout and clear tokens
    if (isRefresh) {
      clearTokens()
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
      throw new UnauthorizedError('Session expired. Please login again.')
    }

    // Case 3: Regular endpoint - cache request and try to refresh token
    if (isRegularEndpoint && retryOn401) {
      try {
        // Cache the original request details
        const cachedRequest = {
          url: fullUrl,
          method: method,
          body: cachedBody,
          headers: headers,
          fetchOptions: fetchOptions,
        }

        // Attempt to refresh the token
        await refreshAccessToken()

        // Retry the original request with cached details
        try {
          // Re-fetch CSRF token if needed for state-changing methods
          if (shouldIncludeCsrf) {
            const csrfToken = await getCsrfToken(baseUrl)
            if (csrfToken) {
              cachedRequest.headers['X-CSRF-Token'] = csrfToken
            }
          }

          response = await fetch(cachedRequest.url, {
            ...cachedRequest.fetchOptions,
            method: cachedRequest.method,
            body: cachedRequest.body,
            headers: cachedRequest.headers,
            credentials: 'include',
          })
        } catch (error: any) {
          // Handle connection errors on retry
          if (
            error?.code === 'ECONNREFUSED' ||
            error?.cause?.code === 'ECONNREFUSED' ||
            error?.message?.includes('fetch failed')
          ) {
            const errorMessage = `Cannot connect to API server at ${baseUrl}. Please ensure the API server is running.`
            console.error(errorMessage, error)
            throw new Error(errorMessage)
          }
          throw error
        }

        // If we still get 401 after refresh, throw unauthorized error
        if (response.status === 401) {
          clearTokens()
          throw new UnauthorizedError('Not authorized. Please login again.')
        }
      } catch (refreshError) {
        clearTokens()
        // If the refresh error is already an UnauthorizedError or SessionExpiredError, re-throw it
        if (refreshError instanceof UnauthorizedError || refreshError instanceof SessionExpiredError) {
          throw refreshError
        }
        // If refresh failed, throw unauthorized error
        throw new UnauthorizedError('Session expired. Please login again.')
      }
    } else if (isRegularEndpoint && !retryOn401) {
      // If retry is disabled, just throw unauthorized error
      throw new UnauthorizedError('Not authorized. Please login again.')
    }
  }

  // Handle non-OK responses
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

  // If parseJson is false, return the ApiResponse object
  if (!parseJson) {
    const data = await response.json()
    return {
      data,
      response,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    } as ApiResponse<T>
  }

  // Parse and return JSON
  return response.json() as Promise<T>
}

/**
 * Convenience methods for common HTTP methods
 */
export async function apiGet<T = any>(
  url: string,
  options?: Omit<WithApiOptions, 'method'>
): Promise<T> {
  const result = await withApi<T>(url, { ...options, method: 'GET', parseJson: true })
  return result as T
}

export async function apiPost<T = any>(
  url: string,
  body?: any,
  options?: Omit<WithApiOptions, 'method' | 'body'>
): Promise<T> {
  const result = await withApi<T>(url, {
    ...options,
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
    parseJson: true,
  })
  return result as T
}

export async function apiPut<T = any>(
  url: string,
  body?: any,
  options?: Omit<WithApiOptions, 'method' | 'body'>
): Promise<T> {
  const result = await withApi<T>(url, {
    ...options,
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
    parseJson: true,
  })
  return result as T
}

export async function apiPatch<T = any>(
  url: string,
  body?: any,
  options?: Omit<WithApiOptions, 'method' | 'body'>
): Promise<T> {
  const result = await withApi<T>(url, {
    ...options,
    method: 'PATCH',
    body: body ? JSON.stringify(body) : undefined,
    parseJson: true,
  })
  return result as T
}

export async function apiDelete<T = any>(
  url: string,
  options?: Omit<WithApiOptions, 'method'>
): Promise<T> {
  const result = await withApi<T>(url, { ...options, method: 'DELETE', parseJson: true })
  return result as T
}

/**
 * API Client Functions - Replacements for apiClient methods
 */

/**
 * Check authentication status via API call
 * Uses a short cache to avoid excessive API calls
 */
export async function checkAuth(): Promise<boolean> {
  // Check cache first
  if (authCheckCache) {
    const now = Date.now()
    if (now - authCheckCache.timestamp < AUTH_CHECK_CACHE_TTL) {
      return authCheckCache.isValid
    }
  }

  try {
    const baseUrl = getBaseUrl()
    try {
      await apiGet('/profile', {
        retryOn401: false, // Don't retry on 401 for auth check
        baseUrl,
      })
      const isValid = true
      authCheckCache = {
        isValid,
        timestamp: Date.now(),
      }
      return isValid
    } catch (error: any) {
      // If it's a 401 or unauthorized error, user is not authenticated
      const isValid = false
      authCheckCache = {
        isValid,
        timestamp: Date.now(),
      }
      return isValid
    }
  } catch (error) {
    authCheckCache = {
      isValid: false,
      timestamp: Date.now(),
    }
    return false
  }
}

/**
 * Login and get authentication tokens
 * Server will set tokens in HttpOnly cookies
 */
export async function login(credentials: LoginRequest): Promise<AuthTokenResponse> {
  // Remove rememberMe from credentials before sending to API
  const { rememberMe: _, ...apiCredentials } = credentials

  const response = await apiPost<{ data?: AuthTokenResponse } | AuthTokenResponse>(
    '/token',
    apiCredentials,
    {
      retryOn401: false, // Don't retry login on 401
    }
  )

  // The API wraps responses in a SuccessResponse format with a 'data' property
  const authData: AuthTokenResponse = (response as any)?.data || response

  // Validate response data
  if (!authData) {
    throw new Error('Invalid login response: no data received')
  }
  
  if (!authData.expiresAt || typeof authData.expiresAt !== 'number') {
    throw new Error('Invalid login response: missing or invalid expiration time')
  }

  // If tokens are missing from response, create a placeholder response
  const result: AuthTokenResponse = {
    accessToken: authData.accessToken || '',
    refreshToken: authData.refreshToken || '',
    expiresIn: authData.expiresIn || Math.floor((authData.expiresAt - Date.now()) / 1000),
    expiresAt: authData.expiresAt,
    tokenType: authData.tokenType || 'Bearer',
  }

  // Clear auth cache after login
  clearAuthCache()

  return result
}

/**
 * Refresh authentication tokens (public method for manual refresh)
 */
export async function refreshToken(): Promise<AuthTokenResponse> {
  return refreshAccessToken()
}

/**
 * Logout - clear tokens
 */
export function logout(): void {
  clearTokens()
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  return checkAuth()
}

/**
 * Create a test flow
 */
export async function createTestFlow(data: {
  name: string
  description?: string
  isActive?: boolean
}) {
  return apiPost('/test-flow', data)
}

/**
 * Search test flows
 */
export async function searchTestFlows(params?: {
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

  return apiGet(endpoint)
}

/**
 * API Client object for backward compatibility
 * This provides the same interface as the old apiClient
 */
export const apiClient = {
  login,
  logout,
  refreshToken,
  checkAuth,
  isAuthenticated,
  clearTokens,
  refreshAccessToken,
  createTestFlow,
  searchTestFlows,
  // Backward compatibility methods (no-ops)
  getToken: () => null as string | null,
  getTokenExpiresAt: () => null as string | null,
  getTokenIssueTime: () => null as number | null,
  setTokenIssueTime: (_issueTime: number) => {},
}
