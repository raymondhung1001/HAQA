import { Navigation } from '@/components/navigation'
import { Container } from '@/components/ui/container'
import { cn } from '@/lib/utils'

interface QueryStateProps {
  isLoading?: boolean
  error?: Error | null
  isEmpty?: boolean
  loadingMessage?: string
  errorMessage?: string
  emptyMessage?: string
  children: React.ReactNode
  className?: string
}

export const QueryState = ({
  isLoading,
  error,
  isEmpty,
  loadingMessage = 'Loading...',
  errorMessage = 'Failed to load data.',
  emptyMessage = 'No data found.',
  children,
  className,
}: QueryStateProps) => {
  if (isLoading) {
    return (
      <Navigation>
        <Container size="2xl" className={className}>
          <p className="text-gray-600 dark:text-gray-400">{loadingMessage}</p>
        </Container>
      </Navigation>
    )
  }

  if (error) {
    return (
      <Navigation>
        <Container size="2xl" className={className}>
          <p className="text-red-600 dark:text-red-400">{errorMessage}</p>
        </Container>
      </Navigation>
    )
  }

  if (isEmpty) {
    return (
      <Navigation>
        <Container size="2xl" className={className}>
          <p className={cn('text-gray-600 dark:text-gray-400')}>{emptyMessage}</p>
        </Container>
      </Navigation>
    )
  }

  return <>{children}</>
}
