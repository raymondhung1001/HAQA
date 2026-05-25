import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface SortToggleOption<T extends string> {
  value: T
  label: string
}

interface SortToggleGroupProps<T extends string> {
  value: T
  options: SortToggleOption<T>[]
  onChange: (value: T) => void
  className?: string
}

export function SortToggleGroup<T extends string>({
  value,
  options,
  onChange,
  className,
}: SortToggleGroupProps<T>) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {options.map((option) => (
        <Button
          key={option.value}
          variant={value === option.value ? 'default' : 'outline'}
          size="sm"
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}
