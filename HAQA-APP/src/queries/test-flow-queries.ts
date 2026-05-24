import {
  useQuery,
  useSuspenseQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseSuspenseQueryOptions,
  type UseMutationOptions,
} from '@tanstack/react-query'
import { apiClient, SessionExpiredError, UnauthorizedError, unwrapData } from '@/lib/api-client'
import type { TestFlowDetail, TestFlowGraph } from '@/lib/test-flow-graph'

export interface Testflow {  id: string
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
      try {
        const response = await apiClient.searchTestFlows({
          query: params?.query || undefined,
          isActive: params?.isActive,
          page: params?.page,
          limit: params?.limit,
          sortBy: params?.sortBy,
        })
        // Response is wrapped in SuccessResponse format: { success: true, data: {...}, ... }
        return (response?.data || { data: [], total: 0, page: 1, limit: 10, totalPages: 0 }) as PaginatedTestFlows
      } catch (error) {
        // Re-throw SessionExpiredError and UnauthorizedError as-is so React Query can handle them properly
        if (error instanceof SessionExpiredError || error instanceof UnauthorizedError) {
          throw error
        }
        // Re-throw other errors
        throw error
      }
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
      try {
        const response = await apiClient.searchTestFlows({
          query: params?.query || undefined,
          isActive: params?.isActive,
          page: params?.page,
          limit: params?.limit,
          sortBy: params?.sortBy,
        })
        // Response is wrapped in SuccessResponse format: { success: true, data: {...}, ... }
        return (response?.data || { data: [], total: 0, page: 1, limit: 10, totalPages: 0 }) as PaginatedTestFlows
      } catch (error) {
        // Re-throw SessionExpiredError and UnauthorizedError as-is so React Query can handle them properly
        if (error instanceof SessionExpiredError || error instanceof UnauthorizedError) {
          throw error
        }
        // Re-throw other errors
        throw error
      }
    },
    ...options,
  })
}

export function useTestFlow(
  id: string,
  options?: Omit<
    UseQueryOptions<TestFlowDetail, Error, TestFlowDetail, string[]>,
    'queryKey' | 'queryFn'
  >,
) {
  return useQuery({
    queryKey: ['testFlow', id],
    queryFn: () => apiClient.getTestFlow(id),
    enabled: Boolean(id),
    ...options,
  })
}

export function useCreateTestFlow(
  options?: Omit<
    UseMutationOptions<
      TestFlowDetail,
      Error,
      {
        name: string
        description?: string
        isActive?: boolean
        graph?: TestFlowGraph
      },
      unknown
    >,
    'mutationFn'
  >,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data) => {
      const response = await apiClient.createTestFlow(data)
      return unwrapData(response) as TestFlowDetail
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testFlows'] })
    },
    ...options,
  })
}

export function useUpdateTestFlow(
  options?: Omit<
    UseMutationOptions<
      Testflow,
      Error,
      { id: string; data: { name?: string; description?: string; isActive?: boolean } },
      unknown
    >,
    'mutationFn'
  >,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await apiClient.updateTestFlow(id, data)
      return ((response as { data?: Testflow })?.data ?? response) as Testflow
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['testFlows'] })
      queryClient.invalidateQueries({ queryKey: ['testFlow', variables.id] })
    },
    ...options,
  })
}

export function useSaveTestFlowGraph(
  options?: Omit<
    UseMutationOptions<
      TestFlowDetail['latestVersion'],
      Error,
      { id: string; graph: TestFlowGraph },
      unknown
    >,
    'mutationFn'
  >,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, graph }) => apiClient.saveTestFlowGraph(id, graph),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['testFlows'] })
      queryClient.invalidateQueries({ queryKey: ['testFlow', variables.id] })
    },
    ...options,
  })
}
