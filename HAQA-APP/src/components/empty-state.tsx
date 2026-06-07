import { cn } from '@/lib/utils'

interface EmptyStateProps {
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export const EmptyState = ({ title, description, action, className }: EmptyStateProps) => {
  return (
    <div className={cn('text-center sm:text-left', className)}>
      <p className="text-gray-600 dark:text-gray-400">{title}</p>
      {description ? (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
