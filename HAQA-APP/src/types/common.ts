/** Shared layout / UI literals */
export type ContainerSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'

export type StatCardColor = 'blue' | 'green' | 'purple' | 'orange'

export type CalloutVariant = 'info' | 'warning' | 'success' | 'orange'

/** Standard paginated API list shape */
export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export const DEFAULT_PAGE = 1
export const DEFAULT_PAGE_LIMIT = 10
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const
export type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number]
