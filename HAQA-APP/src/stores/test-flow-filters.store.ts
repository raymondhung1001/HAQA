import { Store } from '@tanstack/react-store'

export interface TestFlowFilters {
  searchQuery: string
  page: number
  limit: number
  sortBy: 'createdAt' | 'updatedAt'
}

const defaultFilters: TestFlowFilters = {
  searchQuery: '',
  page: 1,
  limit: 10,
  sortBy: 'createdAt',
}

// Load from localStorage if available
const loadFromStorage = (): TestFlowFilters => {
  if (typeof window === 'undefined') return defaultFilters
  
  try {
    const stored = localStorage.getItem('testFlowFilters')
    if (stored) {
      const parsed = JSON.parse(stored)
      return { ...defaultFilters, ...parsed }
    }
  } catch (error) {
    console.warn('Failed to load test flow filters from localStorage', error)
  }
  
  return defaultFilters
}

// Create the store with initial state from localStorage
export const testFlowFiltersStore = new Store<TestFlowFilters>(loadFromStorage())

// Persist to localStorage on changes
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

// Helper functions for updating the store
export const testFlowFiltersActions = {
  setSearchQuery: (query: string) => {
    testFlowFiltersStore.setState((prev) => ({
      ...prev,
      searchQuery: query,
      page: 1, // Reset to page 1 when searching
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
      page: 1, // Reset to page 1 when limit changes
    }))
  },
  
  setSortBy: (sortBy: 'createdAt' | 'updatedAt') => {
    testFlowFiltersStore.setState((prev) => ({
      ...prev,
      sortBy,
      page: 1, // Reset to page 1 when sort changes
    }))
  },
  
  reset: () => {
    testFlowFiltersStore.setState(defaultFilters)
  },
}

