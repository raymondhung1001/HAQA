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
  nodeWidth: 180,
  nodeHeight: 88,
  minWidth: 280,
  minHeight: 140,
  bodyNodeHeight: 96,
  exitRailWidth: 64,
  exitLayout: {
    railTopPx: 32,
    railBottomPx: 8,
    breakHeaderPx: 24,
    doneZoneHeightPx: 52,
    doneZoneGapPx: 6,
  },
  breakRailWidth: 72,
  doneEdgeClearance: 36,
  doneEdgeRoutingSlack: 16,
  borderWidth: 4,
} as const

export const WORKFLOW_REORDER_FOOTER_HEIGHT = IF_ELSE_NODE_LAYOUT.footerHeight
export const WORKFLOW_CONNECTION_GAP = 120
export const WORKFLOW_HANDLE_LANE_STYLE = { top: '50%' } as const

const getLoopBodyExitBandBounds = (
  groupHeight: number,
): { breakBandTop: number; breakBandBottom: number; doneCenterY: number } => {
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

export const getLoopBodyBreakHandleCenterY = (
  groupHeight: number,
  index: number,
  total: number,
): number => {
  const { breakBandTop, breakBandBottom } = getLoopBodyExitBandBounds(groupHeight)
  const span = breakBandBottom - breakBandTop
  if (total <= 1) return breakBandTop + span / 2
  return breakBandTop + (index / (total - 1)) * span
}

export const clampLoopBodyBreakHandleCenterY = (
  groupHeight: number,
  centerY: number,
): number => {
  const { breakBandTop, breakBandBottom } = getLoopBodyExitBandBounds(groupHeight)
  return Math.min(breakBandBottom, Math.max(breakBandTop, centerY))
}

export const getLoopBodyDoneHandleCenterY = (groupHeight: number): number => {
  return getLoopBodyExitBandBounds(groupHeight).doneCenterY
}

export const getLoopBodyBreakHandleTopCalc = (index: number, total: number): string => {
  const { railTopPx, breakHeaderPx, railBottomPx, doneZoneHeightPx, doneZoneGapPx } =
    LOOP_BODY_GROUP.exitLayout
  const bandTop = railTopPx + breakHeaderPx
  const reservedBottom = railBottomPx + doneZoneHeightPx + doneZoneGapPx
  const bandSize = `(100% - ${bandTop + reservedBottom}px)`

  if (total <= 1) return `calc(${bandTop}px + ${bandSize} / 2)`
  const ratio = index / (total - 1)
  return `calc(${bandTop}px + ${ratio} * ${bandSize})`
}

export const getLoopBodyDoneHandleBottomPx = (): number => {
  const { railBottomPx, doneZoneHeightPx } = LOOP_BODY_GROUP.exitLayout
  return railBottomPx + doneZoneHeightPx / 2
}

export const getLoopBodyRowHeight = (bodyStepCount: number): number => {
  const { padding, stepHeight } = LOOP_BODY_WRAP
  const { branchRowHeight } = IF_ELSE_NODE_LAYOUT
  if (bodyStepCount <= 0) return branchRowHeight
  return padding * 2 + bodyStepCount * stepHeight
}
