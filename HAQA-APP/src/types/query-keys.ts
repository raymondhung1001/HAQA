import type { SearchTestFlowsParams } from '@/types/test-flow'

export const testFlowQueryKeys = {
  all: ['testFlows'] as const,
  lists: () => [...testFlowQueryKeys.all, 'list'] as const,
  list: (params: SearchTestFlowsParams = {}) =>
    [
      ...testFlowQueryKeys.lists(),
      params.query ?? '',
      params.page ?? 1,
      params.limit ?? 10,
      params.sortBy ?? 'createdAt',
    ] as const,
  details: () => ['testFlow'] as const,
  detail: (id: string) => [...testFlowQueryKeys.details(), id] as const,
}

export type TestFlowListQueryKey = ReturnType<typeof testFlowQueryKeys.list>
export type TestFlowDetailQueryKey = ReturnType<typeof testFlowQueryKeys.detail>
