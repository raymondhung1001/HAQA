import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect, Suspense } from 'react'
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

export const Route = createFileRoute('/(app)/test-flow')({
  component: TestFlowsPage,
})

function TestFlowsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [sortBy, setSortBy] = useState<'createdAt' | 'updatedAt'>('createdAt')
  const navigate = useNavigate()

  // Debounce search query to avoid too many API calls
  const debouncedSearchQuery = useDebounce(searchQuery, 500)

  // Reset to page 1 when search query changes
  const { data: searchResults, isLoading, error } = useSearchTestFlows({
    query: debouncedSearchQuery || undefined,
    page,
    limit,
    sortBy,
  })

  // Handle session expiration error
  useEffect(() => {
    if (error instanceof Error && error.message.includes('Session expired')) {
      // Redirect to login on session expiration
      navigate({ to: '/login' })
    }
  }, [error, navigate])

  // Reset to page 1 when debounced search query changes
  useEffect(() => {
    setPage(1)
  }, [debouncedSearchQuery])

  // Reset to page 1 when limit changes
  useEffect(() => {
    setPage(1)
  }, [limit])

  // Reset to page 1 when sortBy changes
  useEffect(() => {
    setPage(1)
  }, [sortBy])

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
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
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setPage(1) // Reset to first page when searching
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
                    variant={sortBy === 'createdAt' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSortBy('createdAt')}
                  >
                    Latest Created
                  </Button>
                  <Button
                    variant={sortBy === 'updatedAt' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSortBy('updatedAt')}
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
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
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
              page={page}
              limit={limit}
            />

            {/* Search Results */}
            <ErrorBoundary
              onError={(error) => {
                // Handle session expiration errors
                if (error.message.includes('Session expired')) {
                  navigate({ to: '/login' })
                }
              }}
            >
              <Suspense fallback={<TestFlowSkeleton count={limit} />}>
                <TestFlowResults
                  debouncedSearchQuery={debouncedSearchQuery}
                  page={page}
                  limit={limit}
                  sortBy={sortBy}
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



