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

const normalizeTestFlowRow = (row: unknown): TestFlow | null => {
  if (!row || typeof row !== 'object') return null
  const record = row as Record<string, unknown>

  const rawId = record.id ?? record.testFlowId ?? record.test_flow_id
  const rawName = record.name

  if (typeof rawId !== 'string' || rawId.length === 0) return null
  if (typeof rawName !== 'string' || rawName.length === 0) return null

  const rawDescription = record.description
  const rawIsActive = record.isActive ?? record.is_active
  const rawUserId = record.userId ?? record.user_id
  const rawCreatedAt = record.createdAt ?? record.created_at
  const rawUpdatedAt = record.updatedAt ?? record.updated_at

  return {
    id: rawId,
    name: rawName,
    description: typeof rawDescription === 'string' ? rawDescription : undefined,
    isActive: typeof rawIsActive === 'boolean' ? rawIsActive : undefined,
    userId: typeof rawUserId === 'number' ? rawUserId : undefined,
    createdAt: typeof rawCreatedAt === 'string' ? rawCreatedAt : undefined,
    updatedAt: typeof rawUpdatedAt === 'string' ? rawUpdatedAt : undefined,
  }
}

const parsePaginatedTestFlows = (response: unknown): PaginatedTestFlows => {
  const data = (response as { data?: unknown })?.data ?? response
  if (isPaginatedTestFlows(data)) {
    return {
      ...data,
      data: data.data.map(normalizeTestFlowRow).filter((row): row is TestFlow => row !== null),
    }
  }
  return emptyPaginatedTestFlows()
}

export const useSearchTestFlows = (
  params?: SearchTestFlowsParams,
  options?: Omit<
    UseQueryOptions<PaginatedTestFlows, Error, PaginatedTestFlows, TestFlowListQueryKey>,
    'queryKey' | 'queryFn'
  >,
) => {
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

export const useSearchTestFlowsSuspense = (
  params?: SearchTestFlowsParams,
  options?: Omit<
    UseSuspenseQueryOptions<PaginatedTestFlows, Error, PaginatedTestFlows, TestFlowListQueryKey>,
    'queryKey' | 'queryFn'
  >,
) => {
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

export const useTestFlow = (
  id: string,
  options?: Omit<
    UseQueryOptions<TestFlowDetail, Error, TestFlowDetail, TestFlowDetailQueryKey>,
    'queryKey' | 'queryFn'
  >,
) => {
  return useQuery({
    queryKey: testFlowQueryKeys.detail(id),
    queryFn: () => apiClient.getTestFlow(id),
    enabled: Boolean(id),
    ...options,
  })
}

export const useCreateTestFlow = (
  options?: Omit<
    UseMutationOptions<TestFlowDetail, Error, CreateTestFlowInput, unknown>,
    'mutationFn'
  >,
) => {
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

export const useUpdateTestFlow = (
  options?: Omit<
    UseMutationOptions<TestFlow, Error, UpdateTestFlowMutationVariables, unknown>,
    'mutationFn'
  >,
) => {
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

export const useSaveTestFlowGraph = (
  options?: Omit<
    UseMutationOptions<TestFlowVersionGraph | null, Error, SaveTestFlowGraphVariables, unknown>,
    'mutationFn'
  >,
) => {
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
