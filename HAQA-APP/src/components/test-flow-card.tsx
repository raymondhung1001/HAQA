import { Pencil } from 'lucide-react'

import { StatusBadge } from '@/components/status-badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import type { TestFlow } from '@/types'

interface TestFlowCardProps {
  testFlow: TestFlow
}

export function TestFlowCard({ testFlow }: TestFlowCardProps) {
  const testFlowId = typeof testFlow.id === 'string' ? testFlow.id : ''
  const editHref = testFlowId ? `/test-flow/${encodeURIComponent(testFlowId)}/edit` : '#'

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-lg">{testFlow.name}</CardTitle>
          <div className="flex items-center gap-2">
            <StatusBadge active={testFlow.isActive ?? false} />
            <a
              href={editHref}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
              aria-disabled={!testFlowId}
              onClick={(event) => {
                if (!testFlowId) {
                  event.preventDefault()
                }
              }}
            >
              <Pencil className="h-4 w-4" />
              Edit
            </a>
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
