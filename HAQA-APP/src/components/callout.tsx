import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'
import type { CalloutVariant } from '@/types'

const calloutVariantMap: Record<CalloutVariant, string> = {
  info: 'border-slate-200 bg-slate-50/60 dark:border-slate-700 dark:bg-slate-950/20',
  warning: 'border-amber-200 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/20',
  success: 'border-green-200 bg-green-50/60 dark:border-green-900/50 dark:bg-green-950/20',
  orange: 'border-orange-200 bg-orange-50/60 dark:border-orange-900/50 dark:bg-orange-950/20',
}

const calloutVariants = cva('space-y-3 rounded-lg border p-3', {
  variants: {
    variant: calloutVariantMap,
  },
  defaultVariants: {
    variant: 'info',
  },
})

interface CalloutProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof calloutVariants> {
  title?: string
  description?: string
}

export function Callout({
  variant,
  title,
  description,
  className,
  children,
  ...props
}: CalloutProps) {
  return (
    <div className={cn(calloutVariants({ variant }), className)} {...props}>
      {title || description ? (
        <div>
          {title ? (
            <p className="text-sm font-medium text-gray-900 dark:text-white">{title}</p>
          ) : null}
          {description ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  )
}
