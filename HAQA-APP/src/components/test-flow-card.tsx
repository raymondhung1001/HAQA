import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Testflow } from '@/queries/test-flow-queries'

interface TestFlowCardProps {
  workflow: Testflow
}

export function TestFlowCard({ workflow }: TestFlowCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{workflow.name}</CardTitle>
          <span
            className={`px-2 py-1 text-xs rounded-full ${
              workflow.isActive
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
            }`}
          >
            {workflow.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {workflow.description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            {workflow.description}
          </p>
        )}
        {workflow.createdAt && (
          <p className="text-xs text-gray-500 mt-2">
            Created: {new Date(workflow.createdAt).toLocaleDateString()}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

