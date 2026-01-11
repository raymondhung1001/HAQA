import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, Suspense } from 'react'
import { useStore } from '@tanstack/react-store'
import { Container } from '@/components/ui/container'
import { Navigation } from '@/components/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { FileText, Search, Plus, Filter } from 'lucide-react'
import { useSearchTestFlows, useSearchTestFlowsSuspense } from '@/queries/test-flow-queries'
import { TestFlowCard } from '@/components/test-flow-card'
import { TestFlowSkeleton } from '@/components/test-flow-skeleton'
import { ErrorBoundary } from '@/components/error-boundary'
import { useDebounce } from '@/lib/hooks'
import { Pagination } from '@/components/ui/pagination'
import { testFlowFiltersStore, testFlowFiltersActions } from '@/stores'
import { SessionExpiredError } from '@/lib/api-client'

export const Route = createFileRoute('/(app)/test-flow')({
  component: TestFlowsPage,
})

function TestFlowsPage() {
  const navigate = useNavigate()
  const filters = useStore(testFlowFiltersStore)
  
  // Debounce search query to avoid too many API calls
  const debouncedSearchQuery = useDebounce(filters.searchQuery, 500)

  // Reset to page 1 when search query changes
  const { data: searchResults, isLoading, error } = useSearchTestFlows({
    query: debouncedSearchQuery || undefined,
    page: filters.page,
    limit: filters.limit,
    sortBy: filters.sortBy,
  })

  // Handle session expiration error (backup handler - global handler in QueryClient should catch this first)
  useEffect(() => {
    if (error instanceof SessionExpiredError || (error instanceof Error && error.message.includes('Session expired'))) {
      // Use window.location for a hard redirect to ensure complete logout
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
  }, [error])

  const handlePageChange = (newPage: number) => {
    testFlowFiltersActions.setPage(newPage)
    // Scroll to top when page changes
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <Navigation>
      <Container size="2xl">
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-6 h-6" />
                <CardTitle className="text-2xl">Test Flow</CardTitle>
              </div>
              <Button
                onClick={() => navigate({ to: '/test-flow-create' as any })}
              >
                <Plus className="w-4 h-4" />
                Create Test Flow
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Search, Sort, and Items per page in one row */}
            <div className="mb-4 flex items-center gap-4">
              {/* Search Input */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search test flow..."
                  value={filters.searchQuery}
                  onChange={(e) => {
                    testFlowFiltersActions.setSearchQuery(e.target.value)
                  }}
                  className="w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Sort By Filter */}
              <div className="flex items-center gap-2 shrink-0">
                <Filter className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">Sort by:</span>
                <div className="flex items-center gap-2">
                  <Button
                    variant={filters.sortBy === 'createdAt' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => testFlowFiltersActions.setSortBy('createdAt')}
                  >
                    Latest Created
                  </Button>
                  <Button
                    variant={filters.sortBy === 'updatedAt' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => testFlowFiltersActions.setSortBy('updatedAt')}
                  >
                    Recently Updated
                  </Button>
                </div>
              </div>

              {/* Items per page */}
              <div className="flex items-center gap-2 shrink-0">
                <label htmlFor="page-size" className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                  Items per page:
                </label>
                <Select
                  id="page-size"
                  value={filters.limit}
                  onChange={(e) => testFlowFiltersActions.setLimit(Number(e.target.value))}
                  className="w-20"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </Select>
              </div>
            </div>

            {/* Results Count */}
            <TestFlowResultsCount
              searchResults={searchResults}
              isLoading={isLoading}
              page={filters.page}
              limit={filters.limit}
            />

            {/* Search Results */}
            <ErrorBoundary
              onError={(error) => {
                // Handle session expiration errors (ErrorBoundary will auto-redirect, but this is a backup)
                if ((error instanceof SessionExpiredError || error.message.includes('Session expired')) && window.location.pathname !== '/login') {
                  window.location.href = '/login'
                }
              }}
            >
              <Suspense fallback={<TestFlowSkeleton count={filters.limit} />}>
                <TestFlowResults
                  debouncedSearchQuery={debouncedSearchQuery}
                  page={filters.page}
                  limit={filters.limit}
                  sortBy={filters.sortBy}
                  onPageChange={handlePageChange}
                />
              </Suspense>
            </ErrorBoundary>
          </CardContent>
        </Card>
      </Container>
    </Navigation>
  )
}

function TestFlowResultsCount({
  searchResults,
  isLoading,
  page,
  limit,
}: {
  searchResults?: { total: number } | null
  isLoading: boolean
  page: number
  limit: number
}) {
  const total = searchResults?.total || 0
  return (
    <div className="mb-4">
      {!isLoading && total > 0 ? (
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total} test flows
        </div>
      ) : null}
    </div>
  )
}

function TestFlowResults({
  debouncedSearchQuery,
  page,
  limit,
  sortBy,
  onPageChange,
}: {
  debouncedSearchQuery: string
  page: number
  limit: number
  sortBy: 'createdAt' | 'updatedAt'
  onPageChange: (page: number) => void
}) {
  // Use suspense query hook - this will automatically suspend when loading
  // Errors will be thrown and should be caught by ErrorBoundary
  const { data: searchResults, isFetching } = useSearchTestFlowsSuspense({
    query: debouncedSearchQuery || undefined,
    page,
    limit,
    sortBy,
  })

  const testFlows = searchResults?.data || []
  const total = searchResults?.total || 0
  const totalPages = searchResults?.totalPages || Math.ceil(total / limit) || 1

  return (
    <>
      {testFlows.length === 0 ? (
        <p className="text-gray-600 dark:text-gray-400">
          {debouncedSearchQuery
            ? 'No test flow found matching your search.'
            : 'No test flow found. Create your first test flow!'}
        </p>
      ) : (
        <div className="space-y-4 mb-6">
          {testFlows.map((testFlow) => (
            <TestFlowCard key={testFlow.id} testFlow={testFlow} />
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={onPageChange}
        isLoading={isFetching}
      />
    </>
  )
}



