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
  ChevronLeft,
  ChevronRight,
  Pencil,
  type LucideIcon,
} from 'lucide-react'
import type { IfElseBranch, TestFlowNodeType, WorkflowNodeData } from '@/lib/test-flow-graph'
import {
  getBranchHandleColorClass,
  getIfElseBranchHandleTopPercent,
  getIfElseBranches,
  getIfElseNodeHeight,
} from '@/lib/test-flow-graph'
import {
  IF_ELSE_NODE_LAYOUT,
  WORKFLOW_REORDER_FOOTER_HEIGHT,
} from '@/components/test-flow/workflow-node-layout'
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

const actionButtonClass =
  'nodrag nopan rounded-md p-1 text-gray-500 transition-colors hover:bg-black/5 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-white/10 dark:hover:text-gray-200'

const REORDER_FOOTER_HEIGHT = WORKFLOW_REORDER_FOOTER_HEIGHT

function WorkflowNodeReorderFooter({
  nodeData,
  borderClassName = 'border-black/5 dark:border-white/10',
}: {
  nodeData: WorkflowNodeData
  borderClassName?: string
}) {
  const showSwap = Boolean(nodeData.canSwapLeft || nodeData.canSwapRight)
  if (!showSwap) return null

  return (
    <footer
      className={cn(
        'mt-auto flex shrink-0 items-center gap-1 border-t pt-1',
        borderClassName,
      )}
      style={{ height: REORDER_FOOTER_HEIGHT }}
    >
      <span className="mr-auto text-[9px] font-medium uppercase tracking-wide text-gray-400">
        Reorder
      </span>
      <button
        type="button"
        className={actionButtonClass}
        title="Move step left"
        disabled={!nodeData.canSwapLeft}
        onClick={(event) => {
          event.stopPropagation()
          nodeData.onSwapLeft?.()
        }}
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        className={actionButtonClass}
        title="Move step right"
        disabled={!nodeData.canSwapRight}
        onClick={(event) => {
          event.stopPropagation()
          nodeData.onSwapRight?.()
        }}
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </footer>
  )
}

interface IfElseWorkflowNodeProps {
  nodeData: WorkflowNodeData
  style: (typeof NODE_STYLES)[TestFlowNodeType]
  name: string
  description?: string
  branches: IfElseBranch[]
  selected: boolean
}

function IfElseWorkflowNode({
  nodeData,
  style,
  name,
  description,
  branches,
  selected,
}: IfElseWorkflowNodeProps) {
  const Icon = style.icon
  const showSwap = Boolean(nodeData.canSwapLeft || nodeData.canSwapRight)
  const nodeHeight = getIfElseNodeHeight(branches.length, showSwap)

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-lg border-2 px-3 py-2 shadow-sm transition-shadow',
        style.border,
        style.bg,
        selected && 'ring-2 ring-primary ring-offset-2',
      )}
      style={{ height: nodeHeight, minWidth: IF_ELSE_NODE_LAYOUT.minWidth }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border-2 !border-gray-400 !bg-white"
      />

      <header
        className="flex shrink-0 items-start gap-2 border-b border-amber-200/80 pb-2 dark:border-amber-900/50"
        style={{ height: IF_ELSE_NODE_LAYOUT.headerHeight }}
      >
        <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', style.iconColor)} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{name}</p>
          {description ? (
            <p className="mt-0.5 line-clamp-1 text-xs text-gray-600 dark:text-gray-300">
              {description}
            </p>
          ) : (
            <p className="mt-0.5 text-[10px] uppercase tracking-wide text-amber-700/70 dark:text-amber-300/70">
              Conditional
            </p>
          )}
        </div>
        {nodeData.onEdit && (
          <button
            type="button"
            className={cn(actionButtonClass, 'shrink-0')}
            title="Edit node"
            onClick={(event) => {
              event.stopPropagation()
              nodeData.onEdit?.()
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </header>

      <div className="shrink-0">
        {branches.map((branch, index) => (
          <div
            key={branch.id}
            className="flex items-center justify-end gap-2 border-b border-amber-100/80 px-0.5 last:border-b-0 dark:border-amber-900/30"
            style={{ height: IF_ELSE_NODE_LAYOUT.branchRowHeight }}
          >
            <span className="truncate pr-1 text-[11px] font-medium text-gray-700 dark:text-gray-200">
              {branch.label}
            </span>
          </div>
        ))}
      </div>

      <WorkflowNodeReorderFooter
        nodeData={nodeData}
        borderClassName="border-amber-200/80 dark:border-amber-900/50"
      />

      {branches.map((branch, index) => (
        <Handle
          key={branch.id}
          id={branch.id}
          type="source"
          position={Position.Right}
          style={{ top: getIfElseBranchHandleTopPercent(index, branches.length, showSwap) }}
          className={cn(
            '!h-2.5 !w-2.5 !border-2 !bg-white',
            getBranchHandleColorClass(index, branches.length),
          )}
        />
      ))}
    </div>
  )
}

export function WorkflowNode({ data, selected }: NodeProps) {
  const nodeData = data as WorkflowNodeData
  const nodeType = nodeData.nodeType ?? 'script'
  const style = NODE_STYLES[nodeType] ?? NODE_STYLES.script
  const Icon = style.icon
  const name = nodeData.label || nodeType
  const description = nodeData.description?.trim()
  const branches = nodeType === 'if-else' ? getIfElseBranches(nodeData) : []

  const showTarget = nodeType !== 'start'
  const showSource = nodeType !== 'end'
  const isBranch = nodeType === 'if-else'

  if (isBranch) {
    return (
      <IfElseWorkflowNode
        nodeData={nodeData}
        style={style}
        name={name}
        description={description}
        branches={branches}
        selected={selected}
      />
    )
  }

  return (
    <div
      className={cn(
        'relative flex min-h-[72px] min-w-[180px] max-w-[240px] flex-col rounded-lg border-2 px-3 py-2 shadow-sm transition-shadow',
        style.border,
        style.bg,
        selected && 'ring-2 ring-primary ring-offset-2',
      )}
    >
      {showTarget && (
        <Handle
          type="target"
          position={Position.Left}
          className="!h-2.5 !w-2.5 !border-2 !border-gray-400 !bg-white"
        />
      )}

      <div className="flex items-start gap-2">
        <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', style.iconColor)} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{name}</p>
          {description ? (
            <p className="mt-0.5 line-clamp-2 text-xs text-gray-600 dark:text-gray-300">
              {description}
            </p>
          ) : (
            <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {nodeType}
            </p>
          )}
        </div>
        {nodeData.onEdit && (
          <button
            type="button"
            className={actionButtonClass}
            title="Edit node"
            onClick={(event) => {
              event.stopPropagation()
              nodeData.onEdit?.()
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <WorkflowNodeReorderFooter nodeData={nodeData} />

      {showSource && (
        <Handle
          type="source"
          position={Position.Right}
          className="!h-2.5 !w-2.5 !border-2 !border-gray-400 !bg-white"
        />
      )}
    </div>
  )
}
