import type { CSSProperties } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { LOOP_DONE_BRANCH_ID, type IfElseBranch } from '@/lib/test-flow-graph'
import { getBranchHandleColorClass } from '@/lib/test-flow-graph'
import {
  getLoopBodyBreakHandleTopCalc,
  getLoopBodyDoneHandleBottomPx,
  LOOP_BODY_GROUP,
} from '@/components/test-flow/workflow-node-layout'
import { cn } from '@/lib/utils'

export const LOOP_BODY_GROUP_NODE_TYPE = 'loop-body-group' as const

export interface LoopBodyGroupNodeData {
  loopNodeId?: string
  breakExits?: IfElseBranch[]
}

const exitHandleClass =
  'pointer-events-auto !h-3 !w-3 !border-2 !bg-white shadow-sm transition-shadow hover:!shadow-md'

/** Half-on border (right edge). */
const breakExitHandleStyle = (top: string): CSSProperties => ({
  top,
  right: 0,
  transform: 'translate(50%, -50%)',
})

const doneExitHandleStyle: CSSProperties = {
  top: 'auto',
  bottom: getLoopBodyDoneHandleBottomPx(),
  right: 0,
  transform: 'translate(50%, 50%)',
}

export function LoopBodyGroupNode({ selected, data }: NodeProps) {
  const breakExits = Array.isArray(data?.breakExits) ? (data.breakExits as IfElseBranch[]) : []
  const { exitRailWidth } = LOOP_BODY_GROUP
  const hasBreaks = breakExits.length > 0

  return (
    <div
      className={cn(
        'relative box-border h-full w-full overflow-visible rounded-xl border-2 border-dashed border-green-400/80 bg-green-50/25 dark:border-green-600/70 dark:bg-green-950/15',
        selected && 'ring-2 ring-green-400/40 ring-offset-2',
      )}
    >
      <span className="pointer-events-none absolute left-3 top-2 z-10 text-[10px] font-semibold uppercase tracking-wide text-green-700/90 dark:text-green-300/90">
        Loop body
      </span>

      <aside
        className="pointer-events-none absolute bottom-2 right-0 top-8 z-0 flex flex-col border-l border-dashed border-green-500/35 bg-gradient-to-b from-orange-50/50 via-transparent to-blue-50/60 dark:from-orange-950/25 dark:to-blue-950/30"
        style={{ width: exitRailWidth }}
        aria-hidden
      >
        {hasBreaks ? (
          <div className="flex min-h-0 flex-1 flex-col items-stretch px-1.5 pt-1">
            <span className="mb-1 shrink-0 text-center text-[8px] font-bold uppercase tracking-wider text-orange-600/90 dark:text-orange-400/90">
              Break
            </span>
            <div className="flex min-h-0 flex-1 flex-col justify-evenly py-0.5">
              {breakExits.map((breakExit) => (
                <span
                  key={breakExit.id}
                  className="truncate text-right text-[8px] font-medium leading-tight text-orange-700/80 dark:text-orange-300/80"
                  title={breakExit.label}
                >
                  {breakExit.label}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1" />
        )}

        <div
          className={cn(
            'flex shrink-0 flex-col items-center border-t border-dashed border-green-500/35 px-1.5 py-2',
            hasBreaks ? 'mt-1' : 'mt-auto',
          )}
        >
          <span className="mb-1.5 text-[8px] font-bold uppercase tracking-wider text-blue-600/90 dark:text-blue-400/90">
            Done
          </span>
          <span className="text-center text-[7px] leading-tight text-blue-700/70 dark:text-blue-300/70">
            After loop
          </span>
        </div>
      </aside>

      {breakExits.map((breakExit, index) => (
        <Handle
          key={breakExit.id}
          id={breakExit.id}
          type="source"
          position={Position.Right}
          style={breakExitHandleStyle(
            getLoopBodyBreakHandleTopCalc(index, breakExits.length),
          )}
          className={cn(
            exitHandleClass,
            getBranchHandleColorClass(index, breakExits.length, 'if-else'),
          )}
          title={`Break: ${breakExit.label}`}
        />
      ))}

      <Handle
        id={LOOP_DONE_BRANCH_ID}
        type="source"
        position={Position.Right}
        style={doneExitHandleStyle}
        className={cn(exitHandleClass, '!border-blue-500')}
        title="Done — continue main flow after loop"
      />
    </div>
  )
}
