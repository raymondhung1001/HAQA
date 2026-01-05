import { useQuery, useSuspenseQuery, UseQueryOptions, UseSuspenseQueryOptions } from '@tanstack/react-query'
import { apiClient } from '@/lib/api'

export interface Testflow {
  id: string
  name: string
  description?: string
  isActive?: boolean
  userId?: number
  createdAt?: string
  updatedAt?: string
}

export interface PaginatedTestFlows {
  data: Testflow[]
  total: number
  page: number
  limit: number
  totalPages: number
}

interface SearchTestFlowsParams {
  query?: string
  isActive?: boolean
  page?: number
  limit?: number
  sortBy?: 'createdAt' | 'updatedAt'
}

/**
 * Search test flows query hook with pagination
 */
export function useSearchTestFlows(
  params?: SearchTestFlowsParams,
  options?: Omit<
    UseQueryOptions<PaginatedTestFlows, Error, PaginatedTestFlows, (string | number)[]>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: ['testFlows', params?.query || '', params?.page || 1, params?.limit || 10, params?.sortBy || 'createdAt'],
    queryFn: async () => {
      const response = await apiClient.searchTestFlows({
        query: params?.query || undefined,
        isActive: params?.isActive,
        page: params?.page,
        limit: params?.limit,
        sortBy: params?.sortBy,
      })
      // Response is wrapped in SuccessResponse format: { success: true, data: {...}, ... }
      return (response?.data || { data: [], total: 0, page: 1, limit: 10, totalPages: 0 }) as PaginatedTestFlows
    },
    enabled: true,
    ...options,
  })
}

/**
 * Search test flows query hook with Suspense support
 * Note: This will throw errors that should be caught by ErrorBoundary
 */
export function useSearchTestFlowsSuspense(
  params?: SearchTestFlowsParams,
  options?: Omit<
    UseSuspenseQueryOptions<PaginatedTestFlows, Error, PaginatedTestFlows, (string | number)[]>,
    'queryKey' | 'queryFn'
  >
) {
  return useSuspenseQuery({
    queryKey: ['testFlows', params?.query || '', params?.page || 1, params?.limit || 10, params?.sortBy || 'createdAt'],
    queryFn: async () => {
      const response = await apiClient.searchTestFlows({
        query: params?.query || undefined,
        isActive: params?.isActive,
        page: params?.page,
        limit: params?.limit,
        sortBy: params?.sortBy,
      })
      // Response is wrapped in SuccessResponse format: { success: true, data: {...}, ... }
      return (response?.data || { data: [], total: 0, page: 1, limit: 10, totalPages: 0 }) as PaginatedTestFlows
    },
    ...options,
  })
}

