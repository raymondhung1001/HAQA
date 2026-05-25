interface ResultsCountProps {
  page: number
  limit: number
  total: number
  noun?: string
  isLoading?: boolean
  className?: string
}

export function ResultsCount({
  page,
  limit,
  total,
  noun = 'items',
  isLoading = false,
  className,
}: ResultsCountProps) {
  if (isLoading || total <= 0) {
    return null
  }

  const start = (page - 1) * limit + 1
  const end = Math.min(page * limit, total)

  return (
    <div className={className}>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Showing {start} to {end} of {total} {noun}
      </p>
    </div>
  )
}
