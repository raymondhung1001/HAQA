import { Handle, Position, type NodeProps } from '@xyflow/react'
import {
  Play,
  Square,
  Code2,
  Globe,
  GitBranch,
  Repeat,
  RefreshCw,
  Clock,
  type LucideIcon,
} from 'lucide-react'
import type { TestFlowNodeType } from '@/lib/test-flow-graph'
import { cn } from '@/lib/utils'

const NODE_STYLES: Record<
  TestFlowNodeType,
  { icon: LucideIcon; border: string; bg: string; iconColor: string }
> = {
  start: {
    icon: Play,
    border: 'border-green-500',
    bg: 'bg-green-50 dark:bg-green-950/40',
    iconColor: 'text-green-600 dark:text-green-400',
  },
  end: {
    icon: Square,
    border: 'border-red-500',
    bg: 'bg-red-50 dark:bg-red-950/40',
    iconColor: 'text-red-600 dark:text-red-400',
  },
  script: {
    icon: Code2,
    border: 'border-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
  'api-call': {
    icon: Globe,
    border: 'border-violet-500',
    bg: 'bg-violet-50 dark:bg-violet-950/40',
    iconColor: 'text-violet-600 dark:text-violet-400',
  },
  'if-else': {
    icon: GitBranch,
    border: 'border-amber-500',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
  'for-loop': {
    icon: Repeat,
    border: 'border-orange-500',
    bg: 'bg-orange-50 dark:bg-orange-950/40',
    iconColor: 'text-orange-600 dark:text-orange-400',
  },
  'do-while': {
    icon: RefreshCw,
    border: 'border-orange-500',
    bg: 'bg-orange-50 dark:bg-orange-950/40',
    iconColor: 'text-orange-600 dark:text-orange-400',
  },
  wait: {
    icon: Clock,
    border: 'border-slate-500',
    bg: 'bg-slate-50 dark:bg-slate-900/40',
    iconColor: 'text-slate-600 dark:text-slate-400',
  },
}

export function WorkflowNode({ data, selected }: NodeProps) {
  const nodeType = (data.nodeType as TestFlowNodeType) ?? 'script'
  const style = NODE_STYLES[nodeType] ?? NODE_STYLES.script
  const Icon = style.icon
  const label = (data.label as string) || nodeType

  const showTarget = nodeType !== 'start'
  const showSource = nodeType !== 'end'
  const isBranch = nodeType === 'if-else'

  return (
    <div
      className={cn(
        'min-w-[140px] rounded-lg border-2 px-3 py-2 shadow-sm transition-shadow',
        style.border,
        style.bg,
        selected && 'ring-2 ring-primary ring-offset-2',
      )}
    >
      {showTarget && (
        <Handle
          type="target"
          position={Position.Top}
          className="!h-2.5 !w-2.5 !border-2 !border-gray-400 !bg-white"
        />
      )}

      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4 shrink-0', style.iconColor)} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{label}</p>
          <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {nodeType}
          </p>
        </div>
      </div>

      {showSource && !isBranch && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!h-2.5 !w-2.5 !border-2 !border-gray-400 !bg-white"
        />
      )}

      {isBranch && (
        <>
          <Handle
            id="true"
            type="source"
            position={Position.Bottom}
            style={{ left: '30%' }}
            className="!h-2.5 !w-2.5 !border-2 !border-green-500 !bg-white"
          />
          <Handle
            id="false"
            type="source"
            position={Position.Bottom}
            style={{ left: '70%' }}
            className="!h-2.5 !w-2.5 !border-2 !border-red-500 !bg-white"
          />
          <div className="mt-1 flex justify-between px-1 text-[9px] text-gray-500">
            <span>Yes</span>
            <span>No</span>
          </div>
        </>
      )}
    </div>
  )
}
