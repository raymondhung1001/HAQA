import type { Node } from '@xyflow/react'

import { WORKFLOW_NODE_ORIGIN } from '@/lib/test-flow-graph'

export const FLOW_BOARD_MIN_ZOOM = 0.5
export const FLOW_BOARD_MAX_ZOOM = 1.35
export const FLOW_BOARD_FIT_MIN_ZOOM = 0.5
export const FLOW_BOARD_FIT_MAX_ZOOM = 1

/** Keep a small margin before Start; allow pan room where the flow grows to the right. */
const BOARD_PAN_PADDING = {
  left: 48,
  right: 280,
  top: 120,
  bottom: 200,
} as const

const DEFAULT_BOARD_TRANSLATE_EXTENT: [[number, number], [number, number]] = [
  [-1000, -1000],
  [2000, 2000],
]

const getFlowNodeBounds = (node: Node) => {
  const width = Number(node.width ?? node.style?.width ?? 220)
  const height = Number(node.height ?? node.style?.height ?? 120)
  const origin = (node.origin as [number, number] | undefined) ?? WORKFLOW_NODE_ORIGIN
  const left = node.position.x - width * origin[0]
  const top = node.position.y - height * origin[1]

  return {
    left,
    right: left + width,
    top,
    bottom: top + height,
  }
}

export const getBoardTranslateExtent = (
  flowNodes: Node[],
): [[number, number], [number, number]] => {
  if (flowNodes.length === 0) return DEFAULT_BOARD_TRANSLATE_EXTENT

  const bounds = flowNodes.map(getFlowNodeBounds)
  const minX = Math.min(...bounds.map((bound) => bound.left))
  const maxX = Math.max(...bounds.map((bound) => bound.right))
  const minY = Math.min(...bounds.map((bound) => bound.top))
  const maxY = Math.max(...bounds.map((bound) => bound.bottom))

  return [
    [minX - BOARD_PAN_PADDING.left, minY - BOARD_PAN_PADDING.top],
    [maxX + BOARD_PAN_PADDING.right, maxY + BOARD_PAN_PADDING.bottom],
  ]
}
