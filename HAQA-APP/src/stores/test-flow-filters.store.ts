import { Store } from '@tanstack/react-store'

import {
  defaultTestFlowFilters,
  mergeTestFlowFilters,
  parseTestFlowFilters,
  type TestFlowFilters,
  type TestFlowSortBy,
} from '@/types'

const loadFromStorage = (): TestFlowFilters => {
  if (typeof window === 'undefined') return defaultTestFlowFilters

  try {
    const stored = localStorage.getItem('testFlowFilters')
    if (stored) {
      const parsed: unknown = JSON.parse(stored)
      return mergeTestFlowFilters(parseTestFlowFilters(parsed))
    }
  } catch (error) {
    console.warn('Failed to load test flow filters from localStorage', error)
  }

  return defaultTestFlowFilters
}

export type { TestFlowFilters, TestFlowSortBy }

export const testFlowFiltersStore = new Store<TestFlowFilters>(loadFromStorage())

testFlowFiltersStore.subscribe(() => {
  if (typeof window !== 'undefined') {
    try {
      const state = testFlowFiltersStore.state
      localStorage.setItem('testFlowFilters', JSON.stringify(state))
    } catch (error) {
      console.warn('Failed to save test flow filters to localStorage', error)
    }
  }
})

export const testFlowFiltersActions = {
  setSearchQuery: (query: string) => {
    testFlowFiltersStore.setState((prev) => ({
      ...prev,
      searchQuery: query,
      page: 1,
    }))
  },

  setPage: (page: number) => {
    testFlowFiltersStore.setState((prev) => ({
      ...prev,
      page,
    }))
  },

  setLimit: (limit: number) => {
    testFlowFiltersStore.setState((prev) => ({
      ...prev,
      limit,
      page: 1,
    }))
  },

  setSortBy: (sortBy: TestFlowSortBy) => {
    testFlowFiltersStore.setState((prev) => ({
      ...prev,
      sortBy,
      page: 1,
    }))
  },

  reset: () => {
    testFlowFiltersStore.setState(defaultTestFlowFilters)
  },
}
