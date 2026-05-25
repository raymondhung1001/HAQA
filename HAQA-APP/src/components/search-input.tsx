import { Search } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface SearchInputProps extends Omit<React.ComponentProps<typeof Input>, 'type'> {
  containerClassName?: string
}

export function SearchInput({
  className,
  containerClassName,
  ...props
}: SearchInputProps) {
  return (
    <div className={cn('relative flex-1', containerClassName)}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <Input type="search" className={cn('pl-10', className)} {...props} />
    </div>
  )
}
