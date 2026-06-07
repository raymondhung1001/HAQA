import type { Connection, Node } from '@xyflow/react'

import type { IfElseBranch, WorkflowNodeData } from './types'
import { getIfElseBranches, readLoopBreakExits } from './branch-config'
import { isNodeInLoopBody } from './loop-body-selectors'
import { isLoopBodyGroupNode } from './loop-body-ids'

function isLoopBodyBreakIncomingConnection(
  connection: Connection,
  targetNode: Node,
  owningLoop: Node,
  nodes: Node[],
): boolean {
  if (!isLoopBodyGroupNode(targetNode)) return false

  const loopNodeId = (targetNode.data as { loopNodeId?: string })?.loopNodeId
  if (loopNodeId !== owningLoop.id) return false

  const breakExits = getBreakExitsForLoopBodyGroup(targetNode, nodes)
  if (breakExits.length === 0) return false

  return breakExits.some(
    (branch) =>
      connection.targetHandle === `${branch.id}-target` ||
      connection.targetHandle === branch.id,
  )
}

export function getBreakExitsForLoopBodyGroup(
  targetNode: Node,
  nodes: Node[],
): IfElseBranch[] {
  const loopNodeId = (targetNode.data as { loopNodeId?: string })?.loopNodeId
  const loopNode =
    typeof loopNodeId === 'string' && loopNodeId.length > 0
      ? nodes.find((node) => node.id === loopNodeId)
      : undefined
  const fromLoop = loopNode
    ? readLoopBreakExits((loopNode.data as WorkflowNodeData).config)
    : []

  if (fromLoop.length > 0) return fromLoop

  const fromGroup = Array.isArray(targetNode.data?.breakExits)
    ? (targetNode.data.breakExits as IfElseBranch[])
    : []

  return fromGroup
}

function getLoopNodeForBodyGroup(targetNode: Node, nodes: Node[]): Node | undefined {
  if (!isLoopBodyGroupNode(targetNode)) return undefined

  const loopNodeId = (targetNode.data as { loopNodeId?: string })?.loopNodeId
  if (typeof loopNodeId !== 'string' || loopNodeId.length === 0) return undefined

  return nodes.find((node) => node.id === loopNodeId)
}

export function canConnectBodyBranchToLoopBreak(
  connection: Connection,
  sourceNode: Node,
  targetNode: Node,
  nodes: Node[],
): boolean {
  const targetLoop = getLoopNodeForBodyGroup(targetNode, nodes)
  if (!targetLoop) return false

  if (!isLoopBodyBreakIncomingConnection(connection, targetNode, targetLoop, nodes)) {
    return false
  }

  const breakExits = getBreakExitsForLoopBodyGroup(targetNode, nodes)
  if (breakExits.length === 0) return false

  if (!isNodeInLoopBody(sourceNode.id, targetLoop, nodes)) return false

  const sourceType = (sourceNode.data as WorkflowNodeData)?.nodeType ?? ''
  const handle = connection.sourceHandle

  if (sourceType !== 'if-else') return false
  if (!handle) return false

  const branches = getIfElseBranches(sourceNode.data as WorkflowNodeData)
  return branches.some((branch) => branch.id === handle)
}
