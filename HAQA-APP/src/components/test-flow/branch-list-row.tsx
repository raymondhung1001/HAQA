import { Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface BranchListRowProps {
  index: number
  children: React.ReactNode
  onRemove?: () => void
  removeDisabled?: boolean
  removeTitle?: string
  trailing?: React.ReactNode
  className?: string
}

export function BranchListRow({
  index,
  children,
  onRemove,
  removeDisabled,
  removeTitle = 'Remove',
  trailing,
  className,
}: BranchListRowProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="w-5 shrink-0 text-xs text-gray-400">{index + 1}.</span>
      <div className="min-w-0 flex-1">{children}</div>
      {trailing}
      {onRemove ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0"
          disabled={removeDisabled}
          onClick={onRemove}
          title={removeTitle}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  )
}

interface BranchListInputRowProps extends Omit<BranchListRowProps, 'children'> {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  readOnly?: boolean
  readOnlyLabel?: React.ReactNode
}

export function BranchListInputRow({
  value,
  onChange,
  placeholder,
  readOnly,
  readOnlyLabel,
  ...rowProps
}: BranchListInputRowProps) {
  return (
    <BranchListRow {...rowProps}>
      {readOnly ? (
        <div className="rounded-md border bg-white px-3 py-2 text-sm text-gray-700 dark:bg-slate-900 dark:text-gray-300">
          {readOnlyLabel ?? value}
        </div>
      ) : (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="bg-white dark:bg-slate-900"
        />
      )}
    </BranchListRow>
  )
}
