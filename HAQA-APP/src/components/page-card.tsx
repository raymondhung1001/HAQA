import type { LucideIcon } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface PageCardHeaderProps {
  icon: LucideIcon
  title: string
  action?: React.ReactNode
  className?: string
}

export function PageCardHeader({ icon: Icon, title, action, className }: PageCardHeaderProps) {
  return (
    <CardHeader className={className}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Icon className="h-6 w-6" />
          <CardTitle className="text-2xl">{title}</CardTitle>
        </div>
        {action}
      </div>
    </CardHeader>
  )
}

interface PageCardProps {
  icon: LucideIcon
  title: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  contentClassName?: string
}

export function PageCard({
  icon,
  title,
  action,
  children,
  className,
  contentClassName,
}: PageCardProps) {
  return (
    <Card className={cn(className)}>
      <PageCardHeader icon={icon} title={title} action={action} />
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  )
}
