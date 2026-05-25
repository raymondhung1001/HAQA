import { useCallback } from 'react'

export function usePaginatedScroll(onPageChange: (page: number) => void) {
  return useCallback(
    (page: number) => {
      onPageChange(page)
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    },
    [onPageChange],
  )
}
