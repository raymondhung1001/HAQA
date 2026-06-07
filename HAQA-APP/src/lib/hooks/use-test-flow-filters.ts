import { useStore } from '@tanstack/react-store'

import { useDebounce } from '@/lib/hooks/use-debounce'
import { testFlowFiltersActions, testFlowFiltersStore } from '@/stores'
import type { SearchTestFlowsParams, UseTestFlowFiltersReturn } from '@/types'

export const useTestFlowFilters = (debounceMs: number = 500): UseTestFlowFiltersReturn => {
  const filters = useStore(testFlowFiltersStore)
  const debouncedSearchQuery = useDebounce(filters.searchQuery, debounceMs)

  const searchParams: SearchTestFlowsParams = {
    query: debouncedSearchQuery || undefined,
    page: filters.page,
    limit: filters.limit,
    sortBy: filters.sortBy,
  }

  return {
    filters,
    debouncedSearchQuery,
    searchParams,
    setSearchQuery: testFlowFiltersActions.setSearchQuery,
    setPage: testFlowFiltersActions.setPage,
    setLimit: testFlowFiltersActions.setLimit,
    setSortBy: testFlowFiltersActions.setSortBy,
    reset: testFlowFiltersActions.reset,
  }
}
