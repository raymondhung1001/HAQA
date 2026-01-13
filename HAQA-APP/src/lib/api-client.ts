// API base URL - defaults to localhost:3001/api (NestJS default with global prefix)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

/**
 * Extended RequestInit with additional options for apiRequest
 */
export interface ApiRequestOptions extends RequestInit {
  /**
   * Whether to include CSRF token (default: auto-detect based on method)
   */
  includeCsrf?: boolean
  /**
   * Custom base URL (default: uses API_BASE_URL)
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
 * API request wrapper that handles authentication, CSRF tokens, and error handling
 */
export async function apiRequest<T = any>(
  url: string,
  options: ApiRequestOptions = {}
): Promise<T | ApiResponse<T>> {
  const {
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

  // Make the request
  let response: Response
  
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
  options?: Omit<ApiRequestOptions, 'method'>
): Promise<T> {
  const result = await apiRequest<T>(url, { ...options, method: 'GET', parseJson: true })
  return result as T
}

export async function apiPost<T = any>(
  url: string,
  body?: any,
  options?: Omit<ApiRequestOptions, 'method' | 'body'>
): Promise<T> {
  const result = await apiRequest<T>(url, {
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
  options?: Omit<ApiRequestOptions, 'method' | 'body'>
): Promise<T> {
  const result = await apiRequest<T>(url, {
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
  options?: Omit<ApiRequestOptions, 'method' | 'body'>
): Promise<T> {
  const result = await apiRequest<T>(url, {
    ...options,
    method: 'PATCH',
    body: body ? JSON.stringify(body) : undefined,
    parseJson: true,
  })
  return result as T
}

export async function apiDelete<T = any>(
  url: string,
  options?: Omit<ApiRequestOptions, 'method'>
): Promise<T> {
  const result = await apiRequest<T>(url, { ...options, method: 'DELETE', parseJson: true })
  return result as T
}

/**
 * API Client object for backward compatibility
 */
export const apiClient = {
  // Test flow methods
  createTestFlow: async (data: {
    name: string
    description?: string
    isActive?: boolean
  }) => {
    return apiPost('/test-flow', data)
  },
  searchTestFlows: async (params?: {
    query?: string
    isActive?: boolean
    userId?: number
    page?: number
    limit?: number
    sortBy?: 'createdAt' | 'updatedAt'
  }) => {
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
  },
}

