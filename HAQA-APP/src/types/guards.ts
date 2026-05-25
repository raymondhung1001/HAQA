import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_LIMIT,
  type PageSizeOption,
} from '@/types/common'
import type { PaginatedTestFlows, TestFlow, TestFlowFilters, TestFlowSortBy } from '@/types/test-flow'

const TEST_FLOW_SORT_BY: TestFlowSortBy[] = ['createdAt', 'updatedAt']

export function isTestFlowSortBy(value: unknown): value is TestFlowSortBy {
  return typeof value === 'string' && TEST_FLOW_SORT_BY.includes(value as TestFlowSortBy)
}

export function isPageSizeOption(value: number): value is PageSizeOption {
  return [10, 25, 50, 100].includes(value)
}

export function isTestFlow(value: unknown): value is TestFlow {
  if (!value || typeof value !== 'object') return false
  const row = value as TestFlow
  return typeof row.id === 'string' && typeof row.name === 'string'
}

export function isPaginatedTestFlows(value: unknown): value is PaginatedTestFlows {
  if (!value || typeof value !== 'object') return false
  const page = value as PaginatedTestFlows
  return (
    Array.isArray(page.data) &&
    typeof page.total === 'number' &&
    typeof page.page === 'number' &&
    typeof page.limit === 'number' &&
    typeof page.totalPages === 'number'
  )
}

export function parseTestFlowFilters(stored: unknown): Partial<TestFlowFilters> | null {
  if (!stored || typeof stored !== 'object') return null

  const raw = stored as Record<string, unknown>
  const partial: Partial<TestFlowFilters> = {}

  if (typeof raw.searchQuery === 'string') {
    partial.searchQuery = raw.searchQuery
  }
  if (typeof raw.page === 'number' && raw.page >= 1) {
    partial.page = Math.floor(raw.page)
  }
  if (typeof raw.limit === 'number' && isPageSizeOption(raw.limit)) {
    partial.limit = raw.limit
  }
  if (isTestFlowSortBy(raw.sortBy)) {
    partial.sortBy = raw.sortBy
  }

  return Object.keys(partial).length > 0 ? partial : null
}

export const defaultTestFlowFilters: TestFlowFilters = {
  searchQuery: '',
  page: DEFAULT_PAGE,
  limit: DEFAULT_PAGE_LIMIT,
  sortBy: 'createdAt',
}

export function mergeTestFlowFilters(partial?: Partial<TestFlowFilters> | null): TestFlowFilters {
  return { ...defaultTestFlowFilters, ...partial }
}
