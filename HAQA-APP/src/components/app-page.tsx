import { Navigation } from '@/components/navigation'
import { Container } from '@/components/ui/container'
import { cn } from '@/lib/utils'
import type { ContainerSize } from '@/types'

interface AppPageProps {
  children: React.ReactNode
  size?: ContainerSize
  className?: string
  containerClassName?: string
}

export function AppPage({
  children,
  size = '2xl',
  className,
  containerClassName,
}: AppPageProps) {
  return (
    <Navigation>
      <Container size={size} className={cn(containerClassName)}>
        <div className={className}>{children}</div>
      </Container>
    </Navigation>
  )
}
