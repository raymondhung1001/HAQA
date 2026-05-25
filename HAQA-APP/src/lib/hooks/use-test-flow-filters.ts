import { useStore } from '@tanstack/react-store'

import { useDebounce } from '@/lib/hooks/use-debounce'
import { testFlowFiltersActions, testFlowFiltersStore } from '@/stores'

export function useTestFlowFilters(debounceMs: number = 500) {
  const filters = useStore(testFlowFiltersStore)
  const debouncedSearchQuery = useDebounce(filters.searchQuery, debounceMs)

  const searchParams = {
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
