import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  isLoading?: boolean
  className?: string
}

const MAX_VISIBLE_PAGES = 5

const getVisiblePageNumbers = (currentPage: number, totalPages: number) => {
  if (totalPages <= 0) return []

  const visibleCount = Math.min(MAX_VISIBLE_PAGES, totalPages)
  const firstPage =
    totalPages <= MAX_VISIBLE_PAGES
      ? 1
      : currentPage <= 3
        ? 1
        : currentPage >= totalPages - 2
          ? totalPages - MAX_VISIBLE_PAGES + 1
          : currentPage - 2

  return Array.from({ length: visibleCount }, (_, index) => firstPage + index)
}

export const Pagination = React.forwardRef<HTMLDivElement, PaginationProps>(
  ({ currentPage, totalPages, onPageChange, isLoading = false, className }, ref) => {
    const handlePageChange = (newPage: number) => {
      if (newPage >= 1 && newPage <= totalPages && !isLoading) {
        onPageChange(newPage)
      }
    }

    const pageNumbers = getVisiblePageNumbers(currentPage, totalPages)

    if (totalPages <= 0) {
      return null
    }

    return (
      <div
        ref={ref}
        className={cn("flex items-center justify-between border-t pt-4 mt-6", className)}
      >
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Page {currentPage} of {totalPages}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1 || isLoading}
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </Button>
          <div className="flex items-center gap-1">
            {pageNumbers.map((pageNum) => (
              <Button
                key={pageNum}
                variant={currentPage === pageNum ? "default" : "outline"}
                size="sm"
                onClick={() => handlePageChange(pageNum)}
                disabled={isLoading}
                className="min-w-[2.5rem]"
              >
                {pageNum}
              </Button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages || isLoading}
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    )
  }
)
Pagination.displayName = "Pagination"

