export const IF_ELSE_NODE_LAYOUT = {
  paddingY: 8,
  headerHeight: 46,
  branchRowHeight: 28,
  footerHeight: 32,
  minWidth: 200,
} as const

export const LOOP_BODY_WRAP = {
  padding: 8,
  stepHeight: 24,
} as const

export const LOOP_BODY_GROUP = {
  padding: 20,
  labelHeight: 24,
  /** Matches workflow node min-width for layout math (origin is left-center). */
  nodeWidth: 180,
  nodeHeight: 88,
  minWidth: 280,
  minHeight: 140,
  /** Workflow node visual height used for vertical fit (min-h-[72px] + content). */
  bodyNodeHeight: 96,
  /** Right-side rail for Done + break exit handles on the loop body box. */
  exitRailWidth: 56,
  /** Pixel layout for exit rail (matches loop-body-group-node aside). */
  exitLayout: {
    railTopPx: 32,
    railBottomPx: 8,
    breakHeaderPx: 24,
    doneZoneHeightPx: 52,
    doneZoneGapPx: 6,
  },
  /** @deprecated Use exitRailWidth */
  breakRailWidth: 72,
  /** Gap between loop body bottom and the Done handle edge lane. */
  doneEdgeClearance: 36,
  /** Extra room for edge stroke and smooth-step routing below the body box. */
  doneEdgeRoutingSlack: 16,
  /** Dashed border width (border-2) counted in clearance math. */
  borderWidth: 4,
} as const

export const WORKFLOW_REORDER_FOOTER_HEIGHT = IF_ELSE_NODE_LAYOUT.footerHeight

function getLoopBodyExitBandBounds(groupHeight: number): {
  breakBandTop: number
  breakBandBottom: number
  doneCenterY: number
} {
  const { railTopPx, railBottomPx, breakHeaderPx, doneZoneHeightPx, doneZoneGapPx } =
    LOOP_BODY_GROUP.exitLayout

  const breakBandTop = railTopPx + breakHeaderPx
  const breakBandBottom =
    groupHeight - railBottomPx - doneZoneHeightPx - doneZoneGapPx
  const doneCenterY = groupHeight - railBottomPx - doneZoneHeightPx / 2

  return {
    breakBandTop,
    breakBandBottom: Math.max(breakBandTop + 28, breakBandBottom),
    doneCenterY,
  }
}

/** Center Y of a break exit handle inside the loop body group (px from top). */
export function getLoopBodyBreakHandleCenterY(
  groupHeight: number,
  index: number,
  total: number,
): number {
  const { breakBandTop, breakBandBottom } = getLoopBodyExitBandBounds(groupHeight)
  const span = breakBandBottom - breakBandTop

  if (total <= 1) return breakBandTop + span / 2

  return breakBandTop + (index / (total - 1)) * span
}

/** Center Y of the Done exit handle inside the loop body group (px from top). */
export function getLoopBodyDoneHandleCenterY(groupHeight: number): number {
  return getLoopBodyExitBandBounds(groupHeight).doneCenterY
}

/** CSS top for break handles — scales with loop body height. */
export function getLoopBodyBreakHandleTopCalc(index: number, total: number): string {
  const { railTopPx, breakHeaderPx, railBottomPx, doneZoneHeightPx, doneZoneGapPx } =
    LOOP_BODY_GROUP.exitLayout
  const bandTop = railTopPx + breakHeaderPx
  const reservedBottom = railBottomPx + doneZoneHeightPx + doneZoneGapPx
  const bandSize = `(100% - ${bandTop + reservedBottom}px)`

  if (total <= 1) return `calc(${bandTop}px + ${bandSize} / 2)`

  const ratio = index / (total - 1)
  return `calc(${bandTop}px + ${ratio} * ${bandSize})`
}

/** CSS bottom offset for Done handle — anchored in the Done rail zone. */
export function getLoopBodyDoneHandleBottomPx(): number {
  const { railBottomPx, doneZoneHeightPx } = LOOP_BODY_GROUP.exitLayout
  return railBottomPx + doneZoneHeightPx / 2
}

export function getLoopBodyRowHeight(bodyStepCount: number): number {
  const { padding, stepHeight } = LOOP_BODY_WRAP
  const { branchRowHeight } = IF_ELSE_NODE_LAYOUT

  if (bodyStepCount <= 0) return branchRowHeight

  return padding * 2 + bodyStepCount * stepHeight
}
