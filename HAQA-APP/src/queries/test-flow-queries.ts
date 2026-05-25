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
import { testFlowQueryKeys } from '@/types'
import type {
  CreateTestFlowInput,
  PaginatedTestFlows,
  SaveTestFlowGraphVariables,
  SearchTestFlowsParams,
  TestFlow,
  TestFlowDetail,
  TestFlowListQueryKey,
  TestFlowDetailQueryKey,
  TestFlowVersionGraph,
  UpdateTestFlowMutationVariables,
} from '@/types'
import { isPaginatedTestFlows } from '@/types/guards'

export type {
  TestFlow,
  Testflow,
  PaginatedTestFlows,
  SearchTestFlowsParams,
  CreateTestFlowInput,
  UpdateTestFlowMutationVariables,
  SaveTestFlowGraphVariables,
} from '@/types'

const emptyPaginatedTestFlows = (): PaginatedTestFlows => ({
  data: [],
  total: 0,
  page: 1,
  limit: 10,
  totalPages: 0,
})

function parsePaginatedTestFlows(response: unknown): PaginatedTestFlows {
  const data = (response as { data?: unknown })?.data ?? response
  if (isPaginatedTestFlows(data)) {
    return data
  }
  return emptyPaginatedTestFlows()
}

export function useSearchTestFlows(
  params?: SearchTestFlowsParams,
  options?: Omit<
    UseQueryOptions<PaginatedTestFlows, Error, PaginatedTestFlows, TestFlowListQueryKey>,
    'queryKey' | 'queryFn'
  >,
) {
  return useQuery({
    queryKey: testFlowQueryKeys.list(params),
    queryFn: async () => {
      try {
        const response = await apiClient.searchTestFlows(params)
        return parsePaginatedTestFlows(response)
      } catch (error) {
        if (error instanceof SessionExpiredError || error instanceof UnauthorizedError) {
          throw error
        }
        throw error
      }
    },
    enabled: true,
    ...options,
  })
}

export function useSearchTestFlowsSuspense(
  params?: SearchTestFlowsParams,
  options?: Omit<
    UseSuspenseQueryOptions<PaginatedTestFlows, Error, PaginatedTestFlows, TestFlowListQueryKey>,
    'queryKey' | 'queryFn'
  >,
) {
  return useSuspenseQuery({
    queryKey: testFlowQueryKeys.list(params),
    queryFn: async () => {
      try {
        const response = await apiClient.searchTestFlows(params)
        return parsePaginatedTestFlows(response)
      } catch (error) {
        if (error instanceof SessionExpiredError || error instanceof UnauthorizedError) {
          throw error
        }
        throw error
      }
    },
    ...options,
  })
}

export function useTestFlow(
  id: string,
  options?: Omit<
    UseQueryOptions<TestFlowDetail, Error, TestFlowDetail, TestFlowDetailQueryKey>,
    'queryKey' | 'queryFn'
  >,
) {
  return useQuery({
    queryKey: testFlowQueryKeys.detail(id),
    queryFn: () => apiClient.getTestFlow(id),
    enabled: Boolean(id),
    ...options,
  })
}

export function useCreateTestFlow(
  options?: Omit<
    UseMutationOptions<TestFlowDetail, Error, CreateTestFlowInput, unknown>,
    'mutationFn'
  >,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data) => {
      const response = await apiClient.createTestFlow(data)
      return unwrapData<TestFlowDetail>(response)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: testFlowQueryKeys.all })
    },
    ...options,
  })
}

export function useUpdateTestFlow(
  options?: Omit<
    UseMutationOptions<TestFlow, Error, UpdateTestFlowMutationVariables, unknown>,
    'mutationFn'
  >,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await apiClient.updateTestFlow(id, data)
      return unwrapData<TestFlow>(response)
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: testFlowQueryKeys.all })
      queryClient.invalidateQueries({ queryKey: testFlowQueryKeys.detail(variables.id) })
    },
    ...options,
  })
}

export function useSaveTestFlowGraph(
  options?: Omit<
    UseMutationOptions<TestFlowVersionGraph | null, Error, SaveTestFlowGraphVariables, unknown>,
    'mutationFn'
  >,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, graph }) => apiClient.saveTestFlowGraph(id, graph),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: testFlowQueryKeys.all })
      queryClient.invalidateQueries({ queryKey: testFlowQueryKeys.detail(variables.id) })
    },
    ...options,
  })
}
