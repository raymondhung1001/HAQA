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
  /** Right-side rail for break exit handles at end of body. */
  breakRailWidth: 72,
  /** Gap between loop body bottom and the Done handle edge lane. */
  doneEdgeClearance: 36,
  /** Extra room for edge stroke and smooth-step routing below the body box. */
  doneEdgeRoutingSlack: 16,
  /** Dashed border width (border-2) counted in clearance math. */
  borderWidth: 4,
} as const

export const WORKFLOW_REORDER_FOOTER_HEIGHT = IF_ELSE_NODE_LAYOUT.footerHeight

export function getLoopBodyRowHeight(bodyStepCount: number): number {
  const { padding, stepHeight } = LOOP_BODY_WRAP
  const { branchRowHeight } = IF_ELSE_NODE_LAYOUT

  if (bodyStepCount <= 0) return branchRowHeight

  return padding * 2 + bodyStepCount * stepHeight
}
