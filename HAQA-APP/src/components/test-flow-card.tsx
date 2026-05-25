import { Link } from '@tanstack/react-router'
import { Pencil } from 'lucide-react'

import { StatusBadge } from '@/components/status-badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Testflow } from '@/queries/test-flow-queries'

interface TestFlowCardProps {
  testFlow: Testflow
}

export function TestFlowCard({ testFlow }: TestFlowCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-lg">{testFlow.name}</CardTitle>
          <div className="flex items-center gap-2">
            <StatusBadge active={testFlow.isActive ?? false} />
            <Link
              to="/test-flow/$id/edit"
              params={{ id: testFlow.id }}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Link>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {testFlow.description ? (
          <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">{testFlow.description}</p>
        ) : null}
        {testFlow.createdAt ? (
          <p className="mt-2 text-xs text-gray-500">
            Created: {new Date(testFlow.createdAt).toLocaleDateString()}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
