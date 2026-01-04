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

export const Pagination = React.forwardRef<HTMLDivElement, PaginationProps>(
  ({ currentPage, totalPages, onPageChange, isLoading = false, className }, ref) => {
    const handlePageChange = (newPage: number) => {
      if (newPage >= 1 && newPage <= totalPages && !isLoading) {
        onPageChange(newPage)
      }
    }

    const getPageNumbers = () => {
      if (totalPages <= 0) return []
      
      const maxVisible = 5
      const pages: number[] = []
      
      if (totalPages <= maxVisible) {
        // Show all pages if total is 5 or less
        for (let i = 1; i <= totalPages; i++) {
          pages.push(i)
        }
      } else if (currentPage <= 3) {
        // Show first 5 pages
        for (let i = 1; i <= maxVisible; i++) {
          pages.push(i)
        }
      } else if (currentPage >= totalPages - 2) {
        // Show last 5 pages
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push(i)
        }
      } else {
        // Show 2 pages before and after current
        for (let i = currentPage - 2; i <= currentPage + 2; i++) {
          pages.push(i)
        }
      }
      
      return pages
    }

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
            {getPageNumbers().map((pageNum) => (
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

