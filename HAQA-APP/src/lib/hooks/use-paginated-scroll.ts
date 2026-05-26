import { useCallback } from 'react'

export const usePaginatedScroll = (onPageChange: (page: number) => void) => {
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
