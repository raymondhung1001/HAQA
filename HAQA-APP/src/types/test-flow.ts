import type { PaginatedResult } from '@/types/common'
import type { TestFlowGraph } from '@/lib/test-flow-graph'

export type TestFlowSortBy = 'createdAt' | 'updatedAt'

export const TEST_FLOW_SORT_OPTIONS: ReadonlyArray<{
  value: TestFlowSortBy
  label: string
}> = [
  { value: 'createdAt', label: 'Latest Created' },
  { value: 'updatedAt', label: 'Recently Updated' },
] as const

/** List/search row (summary) */
export interface TestFlow {
  id: string
  name: string
  description?: string
  isActive?: boolean
  userId?: number
  createdAt?: string
  updatedAt?: string
}

/** @deprecated Use `TestFlow` — kept for gradual migration */
export type Testflow = TestFlow

export type PaginatedTestFlows = PaginatedResult<TestFlow>

export interface TestFlowFilters {
  searchQuery: string
  page: number
  limit: number
  sortBy: TestFlowSortBy
}

export interface SearchTestFlowsParams {
  query?: string
  isActive?: boolean
  userId?: number
  page?: number
  limit?: number
  sortBy?: TestFlowSortBy
}

export interface CreateTestFlowInput {
  name: string
  description?: string
  isActive?: boolean
  graph?: TestFlowGraph
}

export interface UpdateTestFlowInput {
  name?: string
  description?: string
  isActive?: boolean
}

export interface UpdateTestFlowMutationVariables {
  id: string
  data: UpdateTestFlowInput
}

export interface SaveTestFlowGraphVariables {
  id: string
  graph: TestFlowGraph
}
