import { Link } from '@tanstack/react-router'
import { GitBranch, Pencil } from 'lucide-react'

import { StatusBadge } from '@/components/status-badge'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import type { TestFlow } from '@/types'

interface TestFlowCardProps {
  testFlow: TestFlow
}

export const TestFlowCard = ({ testFlow }: TestFlowCardProps) => {
  const testFlowId = typeof testFlow.id === 'string' ? testFlow.id : ''
  const hasVersion = testFlow.latestVersionNumber != null
  const hasNodeCount = typeof testFlow.nodeCount === 'number'

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-lg">{testFlow.name}</CardTitle>
          <div className="flex items-center gap-2">
            <StatusBadge active={testFlow.isActive ?? false} />
            {testFlowId ? (
              <Link
                to="/test-flow/$id/edit"
                params={{ id: testFlowId }}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                <Pencil className="h-4 w-4" />
                Edit
              </Link>
            ) : (
              <span className={buttonVariants({ variant: 'outline', size: 'sm' })} aria-disabled>
                <Pencil className="h-4 w-4" />
                Edit
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {testFlow.description ? (
          <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">{testFlow.description}</p>
        ) : null}
        {hasVersion || hasNodeCount ? (
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {hasVersion ? (
              <Badge variant="secondary">v{testFlow.latestVersionNumber}</Badge>
            ) : null}
            {hasNodeCount ? (
              <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <GitBranch className="h-3.5 w-3.5" aria-hidden />
                {testFlow.nodeCount} node{testFlow.nodeCount === 1 ? '' : 's'}
              </span>
            ) : null}
          </div>
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
