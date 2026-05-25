import { Filter } from 'lucide-react'

import { SearchInput } from '@/components/search-input'
import { SortToggleGroup, type SortToggleOption } from '@/components/sort-toggle-group'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface ListToolbarProps<TSort extends string> {
  searchValue: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  sortBy: TSort
  sortOptions: SortToggleOption<TSort>[]
  onSortChange: (value: TSort) => void
  limit: number
  onLimitChange: (limit: number) => void
  pageSizeOptions?: number[]
  className?: string
}

export function ListToolbar<TSort extends string>({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  sortBy,
  sortOptions,
  onSortChange,
  limit,
  onLimitChange,
  pageSizeOptions = [10, 25, 50, 100],
  className,
}: ListToolbarProps<TSort>) {
  return (
    <div className={cn('mb-4 flex items-center gap-4', className)}>
      <SearchInput
        placeholder={searchPlaceholder}
        value={searchValue}
        onChange={(e) => onSearchChange(e.target.value)}
      />

      <div className="flex shrink-0 items-center gap-2">
        <Filter className="h-4 w-4 text-gray-400" />
        <span className="whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
          Sort by:
        </span>
        <SortToggleGroup value={sortBy} options={sortOptions} onChange={onSortChange} />
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <label
          htmlFor="page-size"
          className="whitespace-nowrap text-sm text-gray-600 dark:text-gray-400"
        >
          Items per page:
        </label>
        <Select
          id="page-size"
          value={limit}
          onChange={(e) => onLimitChange(Number(e.target.value))}
          className="w-20"
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </Select>
      </div>
    </div>
  )
}
