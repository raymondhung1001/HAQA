import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { IfElseBranch } from '@/lib/test-flow-graph'
import { getBranchHandleColorClass } from '@/lib/test-flow-graph'
import { cn } from '@/lib/utils'

export const LOOP_BODY_GROUP_NODE_TYPE = 'loop-body-group' as const

export interface LoopBodyGroupNodeData {
  loopNodeId?: string
  breakExits?: IfElseBranch[]
}

function getBreakHandleTopPercent(index: number, total: number): string {
  if (total <= 1) return '50%'
  const min = 32
  const max = 68
  const ratio = index / Math.max(total - 1, 1)
  return `${min + (max - min) * ratio}%`
}

export function LoopBodyGroupNode({ selected, data }: NodeProps) {
  const breakExits = Array.isArray(data?.breakExits) ? (data.breakExits as IfElseBranch[]) : []

  return (
    <div
      className={cn(
        'relative box-border h-full w-full overflow-visible rounded-xl border-2 border-dashed border-green-400/80 bg-green-50/25 dark:border-green-600/70 dark:bg-green-950/15',
        selected && 'ring-2 ring-green-400/40 ring-offset-2',
      )}
    >
      <span className="pointer-events-none absolute left-3 top-2 text-[10px] font-semibold uppercase tracking-wide text-green-700/80 dark:text-green-300/80">
        Loop body
      </span>

      {breakExits.length > 0 && (
        <span className="pointer-events-none absolute right-2 top-2 text-[9px] font-semibold uppercase tracking-wide text-orange-700/80 dark:text-orange-300/80">
          Break
        </span>
      )}

      {breakExits.map((breakExit, index) => (
        <Handle
          key={breakExit.id}
          id={breakExit.id}
          type="source"
          position={Position.Right}
          style={{ top: getBreakHandleTopPercent(index, breakExits.length) }}
          className={cn(
            'pointer-events-auto !h-2.5 !w-2.5 !border-2 !bg-white',
            getBranchHandleColorClass(index, breakExits.length, 'if-else'),
          )}
          title={breakExit.label}
        />
      ))}
    </div>
  )
}
