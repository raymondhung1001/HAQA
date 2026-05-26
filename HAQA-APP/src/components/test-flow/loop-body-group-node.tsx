import { Fragment, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { Handle, Position, useStore, useUpdateNodeInternals, type Node, type NodeProps } from '@xyflow/react'
import {
  getBreakExitsForLoopBodyGroup,
  LOOP_DONE_BRANCH_ID,
  type IfElseBranch,
} from '@/lib/test-flow-graph'
import { getBranchHandleColorClass } from '@/lib/test-flow-graph'
import {
  clampLoopBodyBreakHandleCenterY,
  getLoopBodyBreakHandleCenterY,
  getLoopBodyDoneHandleBottomPx,
  LOOP_BODY_GROUP,
} from '@/components/test-flow/workflow-node-layout'
import { cn } from '@/lib/utils'

export const LOOP_BODY_GROUP_NODE_TYPE = 'loop-body-group' as const

export interface LoopBodyGroupNodeData {
  loopNodeId?: string
  breakExits?: IfElseBranch[]
  breakHandleCenterYs?: Record<string, number>
  entryCenterY?: number
  isNested?: boolean
}

const exitHandleClass =
  'pointer-events-auto !h-3 !w-3 !border-2 !bg-white shadow-sm transition-shadow hover:!shadow-md'

const breakTargetHandleClass =
  'pointer-events-auto !h-4 !w-4 !border-2 !bg-white shadow-sm transition-shadow hover:!shadow-md'

const HANDLE_SIZE_PX = 12
const BREAK_TARGET_HANDLE_SIZE_PX = 16

/** Shared vertical anchor for break in/out handles on the right border. */
const breakHandleRowStyle = (topPx: number): Pick<CSSProperties, 'top' | 'transform'> => ({
  top: topPx,
  transform: 'translateY(-50%)',
})

/** Incoming from body: Left position on the right border (edge approaches from the left, no U-turn). */
const breakExitTargetHandleStyle = (topPx: number): CSSProperties => ({
  ...breakHandleRowStyle(topPx),
  left: '100%',
  marginLeft: -BREAK_TARGET_HANDLE_SIZE_PX / 2,
})

/** Outgoing to main flow: Right position on the same border row. */
const breakExitSourceHandleStyle = (topPx: number): CSSProperties => ({
  ...breakHandleRowStyle(topPx),
  right: -HANDLE_SIZE_PX / 2,
})

const doneExitHandleStyle: CSSProperties = {
  top: 'auto',
  bottom: getLoopBodyDoneHandleBottomPx() - HANDLE_SIZE_PX / 2,
  right: -HANDLE_SIZE_PX / 2,
  transform: 'translateY(50%)',
}

/** Default: label in the rail beside the handle. Connected: shift above the incoming edge. */
const getBreakExitLabelStyle = (
  topPx: number,
  isConnected: boolean,
  exitRailWidth: number,
): CSSProperties => {
  if (!isConnected) {
    return {
      top: topPx,
      right: 10,
      transform: 'translateY(-50%)',
      maxWidth: exitRailWidth - 8,
    }
  }

  return {
    top: topPx - 8,
    right: 6,
    transform: 'translateY(-100%)',
    maxWidth: exitRailWidth - 6,
    textAlign: 'right',
  }
}

const resolveBreakHandleTopPx = (
  nodeHeight: number,
  breakId: string,
  index: number,
  total: number,
  overrides?: Record<string, number>,
): number => {
  const override = overrides?.[breakId]
  if (typeof override === 'number') {
    return clampLoopBodyBreakHandleCenterY(nodeHeight, override)
  }

  return getLoopBodyBreakHandleCenterY(nodeHeight, index, total)
}

export const LoopBodyGroupNode = ({ id, selected, data, height }: NodeProps) => {
  const groupData = (data ?? {}) as LoopBodyGroupNodeData
  const breakHandleCenterYs = groupData.breakHandleCenterYs
  const entryCenterY = groupData.entryCenterY
  const isNested = Boolean(groupData.isNested)
  const { exitRailWidth, minHeight } = LOOP_BODY_GROUP
  const updateNodeInternals = useUpdateNodeInternals()
  const rootRef = useRef<HTMLDivElement>(null)
  const [measuredHeight, setMeasuredHeight] = useState(minHeight)

  const breakExits = useStore(
    useCallback(
      (state) => {
        const groupNode = state.nodes.find((node) => node.id === id)
        if (!groupNode) {
          return Array.isArray(groupData.breakExits) ? groupData.breakExits : []
        }

        return getBreakExitsForLoopBodyGroup(groupNode as Node, state.nodes as Node[])
      },
      [id, groupData.breakExits],
    ),
  )

  const hasBreaks = breakExits.length > 0

  const nodeHeight =
    typeof height === 'number' && height > 0 ? height : measuredHeight

  const breakExitKey = breakExits.map((b) => b.id).join(',')

  const connectedBreakIds = useStore(
    useCallback(
      (state) => {
        const connected = new Set<string>()
        for (const edge of state.edges) {
          if (edge.target !== id || !edge.targetHandle) continue
          for (const exit of breakExits) {
            if (
              edge.targetHandle === `${exit.id}-target` ||
              edge.targetHandle === exit.id
            ) {
              connected.add(exit.id)
            }
          }
        }
        return connected
      },
      [id, breakExitKey],
    ),
  )

  const refreshHandleBounds = useCallback(() => {
    const el = rootRef.current
    if (el) {
      const nextHeight = el.offsetHeight
      if (nextHeight > 0) setMeasuredHeight(nextHeight)
    }
    updateNodeInternals(id)
  }, [id, updateNodeInternals])

  useEffect(() => {
    refreshHandleBounds()
  }, [refreshHandleBounds, breakExitKey, height, entryCenterY, breakHandleCenterYs])

  useEffect(() => {
    const el = rootRef.current
    if (!el) return

    const observer = new ResizeObserver(() => refreshHandleBounds())
    observer.observe(el)
    return () => observer.disconnect()
  }, [refreshHandleBounds])

  return (
    <div
      ref={rootRef}
      className={cn(
        'relative box-border overflow-visible rounded-xl border-2 border-dashed shadow-sm transition-shadow',
        isNested
          ? 'border-green-400/55 bg-green-50/15 dark:border-green-700/55 dark:bg-green-950/10'
          : 'border-green-400/80 bg-green-50/25 dark:border-green-600/70 dark:bg-green-950/15',
        selected && 'ring-2 ring-green-400/40 ring-offset-2',
      )}
      style={{
        width: '100%',
        height: '100%',
        minWidth: '100%',
        minHeight: '100%',
        boxSizing: 'border-box',
      }}
    >
      <span
        className={cn(
          'pointer-events-none absolute left-3 top-2 z-10 font-semibold uppercase tracking-wide text-green-700/90 dark:text-green-300/90',
          isNested ? 'text-[9px]' : 'text-[10px]',
        )}
      >
        {isNested ? 'Inner loop body' : 'Loop body'}
      </span>

      {typeof entryCenterY === 'number' ? (
        <span
          className="pointer-events-none absolute left-0 z-10 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-green-500 shadow-sm"
          style={{ top: entryCenterY }}
          title="Loop entry lane"
          aria-hidden
        />
      ) : null}

      <aside
        className="pointer-events-none absolute bottom-2 right-0 top-8 z-0 flex flex-col rounded-tr-lg border-l border-dashed border-green-500/35 bg-gradient-to-b from-orange-50/50 via-transparent to-blue-50/60 dark:from-orange-950/25 dark:to-blue-950/30"
        style={{ width: exitRailWidth }}
        aria-hidden
      >
        {hasBreaks ? (
          <div className="flex min-h-0 flex-1 flex-col items-stretch px-1.5 pt-1">
            <span className="mb-1 shrink-0 text-center text-[8px] font-bold uppercase tracking-wider text-orange-600/90 dark:text-orange-400/90">
              Break
            </span>
            <span className="mb-1 shrink-0 text-center text-[7px] leading-tight text-orange-700/70 dark:text-orange-300/70">
              Wire If / Else branches here
            </span>
            <div className="min-h-0 flex-1" />
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
            Continue flow
          </span>
        </div>
      </aside>

      {breakExits.map((breakExit, index) => {
        const topPx = resolveBreakHandleTopPx(
          nodeHeight,
          breakExit.id,
          index,
          breakExits.length,
          breakHandleCenterYs,
        )
        const isConnected = connectedBreakIds.has(breakExit.id)

        return (
          <span
            key={`label-${breakExit.id}`}
            className="pointer-events-none absolute z-10 truncate text-right text-[8px] font-medium leading-tight text-orange-700/80 transition-[top,transform] duration-150 dark:text-orange-300/80"
            style={getBreakExitLabelStyle(topPx, isConnected, exitRailWidth)}
            title={breakExit.label}
          >
            {breakExit.label}
          </span>
        )
      })}

      {breakExits.map((breakExit, index) => {
        const topPx = resolveBreakHandleTopPx(
          nodeHeight,
          breakExit.id,
          index,
          breakExits.length,
          breakHandleCenterYs,
        )
        const handleClass = cn(
          breakTargetHandleClass,
          getBranchHandleColorClass(index, breakExits.length, 'if-else'),
        )
        const sourceHandleClass = cn(
          exitHandleClass,
          getBranchHandleColorClass(index, breakExits.length, 'if-else'),
        )

        return (
          <Fragment key={breakExit.id}>
            <Handle
              id={`${breakExit.id}-target`}
              type="target"
              position={Position.Left}
              style={breakExitTargetHandleStyle(topPx)}
              className={handleClass}
              title={`${breakExit.label} — connect an If / Else branch here`}
            />
            <Handle
              id={breakExit.id}
              type="source"
              position={Position.Right}
              style={breakExitSourceHandleStyle(topPx)}
              className={cn(sourceHandleClass, '!pointer-events-auto')}
              title={`${breakExit.label} — continue main flow after break`}
            />
          </Fragment>
        )
      })}

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
