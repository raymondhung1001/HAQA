import type { NodeProps } from '@xyflow/react'
import { cn } from '@/lib/utils'

export const LOOP_BODY_GROUP_NODE_TYPE = 'loop-body-group' as const

export function LoopBodyGroupNode({ selected }: NodeProps) {
  return (
    <div
      className={cn(
        'pointer-events-none h-full w-full rounded-xl border-2 border-dashed border-green-400/80 bg-green-50/25 dark:border-green-600/70 dark:bg-green-950/15',
        selected && 'ring-2 ring-green-400/40 ring-offset-2',
      )}
    >
      <span className="absolute left-3 top-2 text-[10px] font-semibold uppercase tracking-wide text-green-700/80 dark:text-green-300/80">
        Loop body
      </span>
    </div>
  )
}
