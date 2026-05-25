import { Badge } from '@/components/ui/badge'

interface StatusBadgeProps {
  active: boolean
  className?: string
}

export function StatusBadge({ active, className }: StatusBadgeProps) {
  return (
    <Badge variant={active ? 'success' : 'muted'} className={className}>
      {active ? 'Active' : 'Inactive'}
    </Badge>
  )
}
