import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Container } from '@/components/ui/container'
import { Navigation } from '@/components/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { FileText, Search, Plus, ChevronLeft, ChevronRight, Filter } from 'lucide-react'
import { useSearchTestFlows } from '@/queries/test-flow-queries'
import { TestFlowCard } from '@/components/test-flow-card'
import { useDebounce } from '@/lib/hooks'

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
  const { data: searchResults, isLoading } = useSearchTestFlows({
    query: debouncedSearchQuery || undefined,
    page,
    limit,
    sortBy,
  })

  const workflows = searchResults?.data || []
  const totalPages = searchResults?.totalPages || 0
  const total = searchResults?.total || 0

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
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage)
      // Scroll to top when page changes
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
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
            <div className="mb-4">
              {!isLoading && total > 0 ? (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total} test flows
                </div>
              ) : null}
            </div>

            {/* Search Results */}
            {isLoading ? (
              <p className="text-gray-600 dark:text-gray-400">
                Loading test flows...
              </p>
            ) : workflows.length === 0 ? (
              <p className="text-gray-600 dark:text-gray-400">
                {debouncedSearchQuery
                  ? 'No test flow found matching your search.'
                  : 'No test flow found. Create your first test flow!'}
              </p>
            ) : (
              <>
                <div className="space-y-4 mb-6">
                  {workflows.map((workflow) => (
                    <TestFlowCard key={workflow.id} workflow={workflow} />
                  ))}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t pt-4">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Page {page} of {totalPages}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(page - 1)}
                        disabled={page === 1 || isLoading}
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Previous
                      </Button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum: number
                          if (totalPages <= 5) {
                            pageNum = i + 1
                          } else if (page <= 3) {
                            pageNum = i + 1
                          } else if (page >= totalPages - 2) {
                            pageNum = totalPages - 4 + i
                          } else {
                            pageNum = page - 2 + i
                          }
                          return (
                            <Button
                              key={pageNum}
                              variant={page === pageNum ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => handlePageChange(pageNum)}
                              disabled={isLoading}
                              className="min-w-[2.5rem]"
                            >
                              {pageNum}
                            </Button>
                          )
                        })}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(page + 1)}
                        disabled={page === totalPages || isLoading}
                      >
                        Next
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </Container>
    </Navigation>
  )
}


