import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { FileText, Plus } from 'lucide-react'

import { AppPage } from '@/components/app-page'
import { EmptyState } from '@/components/empty-state'
import { ListToolbar } from '@/components/list-toolbar'
import { PageCard } from '@/components/page-card'
import { ResultsCount } from '@/components/results-count'
import { TestFlowCard } from '@/components/test-flow-card'
import { TestFlowSkeleton } from '@/components/test-flow-skeleton'
import { Button } from '@/components/ui/button'
import { Pagination } from '@/components/ui/pagination'
import { usePaginatedScroll, useSessionRedirect, useTestFlowFilters } from '@/lib/hooks'
import { useSearchTestFlows } from '@/queries/test-flow-queries'
import { TEST_FLOW_SORT_OPTIONS } from '@/types'

const TestFlowsPage = () => {
  const navigate = useNavigate()
  const { filters, debouncedSearchQuery, searchParams, setSearchQuery, setPage, setLimit, setSortBy } =
    useTestFlowFilters()

  useEffect(() => {
    if (filters.searchQuery) {
      setSearchQuery('')
    }
    // Intentionally run once on page mount to avoid stale persisted filters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { data: searchResults, isLoading, isFetching, error } = useSearchTestFlows(searchParams)
  useSessionRedirect(error)

  const handlePageChange = usePaginatedScroll(setPage)

  const testFlows = searchResults?.data || []
  const total = searchResults?.total || 0
  const totalPages = searchResults?.totalPages || Math.ceil(total / filters.limit) || 1

  return (
    <AppPage>
      <PageCard
        icon={FileText}
        title="Test Flow"
        className="mb-6"
        action={
          <Button onClick={() => navigate({ to: '/test-flow-create' })}>
            <Plus className="h-4 w-4" />
            Create Test Flow
          </Button>
        }
      >
        <ListToolbar
          searchValue={filters.searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search test flow..."
          sortBy={filters.sortBy}
          sortOptions={TEST_FLOW_SORT_OPTIONS}
          onSortChange={setSortBy}
          limit={filters.limit}
          onLimitChange={setLimit}
        />

        <ResultsCount
          className="mb-4"
          page={filters.page}
          limit={filters.limit}
          total={total}
          noun="test flows"
          isLoading={isLoading}
        />

        {isLoading ? (
          <TestFlowSkeleton count={filters.limit} />
        ) : testFlows.length === 0 ? (
          <EmptyState
            title={
              debouncedSearchQuery
                ? 'No test flow found matching your search.'
                : 'No test flow found. Create your first test flow!'
            }
          />
        ) : (
          <div className="mb-6 space-y-4">
            {testFlows.map((testFlow) => (
              <TestFlowCard key={testFlow.id} testFlow={testFlow} />
            ))}
          </div>
        )}

        <Pagination
          currentPage={filters.page}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          isLoading={isFetching}
        />
      </PageCard>
    </AppPage>
  )
}

export const Route = createFileRoute('/(app)/test-flow/')({
  component: TestFlowsPage,
})
