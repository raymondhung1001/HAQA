// API base URL - defaults to localhost:3001/api (NestJS default with global prefix)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

/**
 * Custom error class for session expiration
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
 * Extended RequestInit with additional options for apiRequest
 */
export interface ApiRequestOptions extends RequestInit {
  /**
   * Whether to retry the request on 401 with token refresh (default: true)
   */
  retryOn401?: boolean
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
export interface ApiResponse<T = unknown> {
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
export async function apiRequest<T = unknown>(
  url: string,
  options: ApiRequestOptions = {}
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

  // Make the request - tokens are automatically sent via HttpOnly cookies
  let response: Response
  
  try {
    response = await fetch(fullUrl, {
      ...fetchOptions,
      headers,
      credentials: 'include',
    })
  } catch (error: unknown) {
    const err = error as { code?: string; cause?: { code?: string }; message?: string }
    if (
      err?.code === 'ECONNREFUSED' ||
      err?.cause?.code === 'ECONNREFUSED' ||
      err?.message?.includes('fetch failed')
    ) {
      const errorMessage = `Cannot connect to API server at ${baseUrl}. Please ensure the API server is running.`
      console.error(errorMessage, error)
      throw new Error(errorMessage)
    }
    throw error
  }

  // Handle 401 responses
  if (response.status === 401) {
    if (retryOn401) {
      // For 401 errors, throw unauthorized error
      // The auth system will handle redirects
      throw new UnauthorizedError('Not authorized. Please login again.')
    } else {
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
export async function apiGet<T = unknown>(
  url: string,
  options?: Omit<ApiRequestOptions, 'method'>
): Promise<T> {
  const result = await apiRequest<T>(url, { ...options, method: 'GET', parseJson: true })
  return result as T
}

export async function apiPost<T = unknown>(
  url: string,
  body?: JsonValue,
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

export async function apiPut<T = unknown>(
  url: string,
  body?: JsonValue,
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

export async function apiPatch<T = unknown>(
  url: string,
  body?: JsonValue,
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

export async function apiDelete<T = unknown>(
  url: string,
  options?: Omit<ApiRequestOptions, 'method'>
): Promise<T> {
  const result = await apiRequest<T>(url, { ...options, method: 'DELETE', parseJson: true })
  return result as T
}

import type { TestFlowDetail, TestFlowGraph } from '@/lib/test-flow-graph'
import type {
  CreateTestFlowInput,
  JsonValue,
  PaginatedTestFlows,
  SearchTestFlowsParams,
  UpdateTestFlowInput,
} from '@/types'

export function unwrapData<T>(response: { data?: T } | T): T {
  return ((response as { data?: T })?.data ?? response) as T
}

/**
 * API Client object for backward compatibility
 */
export const apiClient = {
  createTestFlow: async (data: CreateTestFlowInput) => {
    return apiPost('/test-flow', data as JsonValue)
  },
  getTestFlow: async (id: string): Promise<TestFlowDetail> => {
    const response = await apiGet<{ data?: TestFlowDetail } | TestFlowDetail>(`/test-flow/${id}`)
    return unwrapData(response)
  },
  updateTestFlow: async (id: string, data: UpdateTestFlowInput) => {
    return apiPatch(`/test-flow/${id}`, data as JsonValue)
  },
  saveTestFlowGraph: async (id: string, graph: TestFlowGraph) => {
    const response = await apiPut<
      { data?: TestFlowDetail['latestVersion'] } | TestFlowDetail['latestVersion']
    >(`/test-flow/${id}/graph`, graph as JsonValue)
    return unwrapData(response)
  },
  searchTestFlows: async (params?: SearchTestFlowsParams): Promise<{ data?: PaginatedTestFlows } | PaginatedTestFlows> => {
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

