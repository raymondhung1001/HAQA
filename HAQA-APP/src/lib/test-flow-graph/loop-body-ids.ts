import type { Node } from '@xyflow/react'

import { LOOP_BODY_GROUP_NODE_TYPE } from './constants'

/** Parent loop that lists `loopNodeId` in its body (for nested loop exit wiring). */
export function getLoopBodyGroupId(loopNodeId: string): string {
  return `${loopNodeId}-loop-body`
}

export function isLoopBodyGroupNode(node: Node): boolean {
  return node.type === LOOP_BODY_GROUP_NODE_TYPE
}
