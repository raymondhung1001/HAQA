import { Button } from '@/components/ui/button'
import type { TestFlowNodeType } from '@/lib/test-flow-graph'
import { WORKFLOW_NODE_DEFINITIONS } from './workflow-node-definitions'

interface NodePaletteProps {
  onAddNode: (nodeType: TestFlowNodeType) => void
  hasStartNode: boolean
  hasEndNode: boolean
}

export const NodePalette = ({ onAddNode, hasStartNode, hasEndNode }: NodePaletteProps) => {
  return (
    <div className="flex h-full flex-col bg-gray-50 dark:bg-slate-900/50">
      <div className="border-b border-gray-200 px-3 py-2 dark:border-gray-700">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Add Node
        </p>
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto p-2">
        {WORKFLOW_NODE_DEFINITIONS.map((def) => {
          const Icon = def.icon
          const disabled =
            (def.type === 'start' && hasStartNode) || (def.type === 'end' && hasEndNode)

          return (
            <Button
              key={def.type}
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => onAddNode(def.type)}
              className="h-auto w-full justify-start gap-2 px-2 py-2 text-left"
              title={
                disabled
                  ? def.type === 'start'
                    ? 'Only one Start node is allowed'
                    : 'Only one End node is allowed'
                  : def.description
              }
            >
              <Icon className="h-4 w-4 shrink-0 text-gray-600 dark:text-gray-300" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{def.label}</span>
                <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                  {def.description}
                </span>
              </span>
            </Button>
          )
        })}
      </div>
    </div>
  )
}
