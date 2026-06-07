import type { Edge, Node } from '@xyflow/react'

import { LOOP_BODY_BRANCH_ID, LOOP_BODY_GROUP_NODE_TYPE } from './constants'
import type { WorkflowNodeData } from './types'
import { isLoopNodeType, readLoopBodyNodeIds } from './branch-config'
import { isLoopBackEdge } from './edge-helpers'

function getLoopBodyMemberSet(bodyNodeIds: string[]): Set<string> {
  return new Set(bodyNodeIds)
}

function getLoopBodyMemberEdges(edges: Edge[], bodySet: Set<string>): Edge[] {
  return edges.filter((edge) => bodySet.has(edge.source) && bodySet.has(edge.target))
}

function isNodeInAnyLoopBody(nodeId: string, nodes: Node[]): boolean {
  return nodes.some((node) => {
    const data = node.data as WorkflowNodeData
    if (!isLoopNodeType(data.nodeType ?? '')) return false
    return readLoopBodyNodeIds(data.config).includes(nodeId)
  })
}

function findParentLoopNode(loopNodeId: string, nodes: Node[]): Node | undefined {
  return nodes.find((node) => {
    const data = node.data as WorkflowNodeData
    if (!isLoopNodeType(data.nodeType ?? '')) return false
    return readLoopBodyNodeIds(data.config).includes(loopNodeId)
  })
}

export function isBranchingWorkNodeType(nodeType: string): boolean {
  return nodeType === 'if-else' || isLoopNodeType(nodeType)
}

/** Roots of the loop body work graph (no incoming edges from other body steps). */
export function findLoopBodyEntryNodeIds(
  bodyNodeIds: string[],
  edges: Edge[],
  loopNodeId: string,
): string[] {
  const bodySet = getLoopBodyMemberSet(bodyNodeIds)
  const incomingFromBody = new Set<string>()

  for (const edge of getLoopBodyMemberEdges(edges, bodySet)) {
    incomingFromBody.add(edge.target)
  }

  const entries = bodyNodeIds.filter((id) => !incomingFromBody.has(id))
  if (entries.length > 0) return entries

  const fromLoop = edges
    .filter(
      (edge) =>
        edge.source === loopNodeId &&
        edge.sourceHandle === LOOP_BODY_BRANCH_ID &&
        bodySet.has(edge.target),
    )
    .map((edge) => edge.target)

  return fromLoop.length > 0 ? fromLoop : bodyNodeIds.slice(0, 1)
}

/** Steps with no further body successors — iteration paths end here before continue-back. */
export function findLoopBodyLeafNodeIds(bodyNodeIds: string[], edges: Edge[]): string[] {
  const bodySet = getLoopBodyMemberSet(bodyNodeIds)
  const outgoingToBodyOrOutside = new Set<string>()

  for (const edge of edges) {
    if (bodySet.has(edge.source) && !isLoopBackEdge(edge)) {
      outgoingToBodyOrOutside.add(edge.source)
    }
  }

  return bodyNodeIds.filter((id) => !outgoingToBodyOrOutside.has(id))
}

/** BFS order from entry nodes for layout; disconnected members follow bodyNodeIds order. */
export function deriveLoopBodyLayoutOrder(
  bodyNodeIds: string[],
  edges: Edge[],
  loopNodeId: string,
): string[] {
  const bodySet = getLoopBodyMemberSet(bodyNodeIds)
  const entries = findLoopBodyEntryNodeIds(bodyNodeIds, edges, loopNodeId)
  const order: string[] = []
  const visited = new Set<string>()
  const queue = [...entries]

  while (queue.length > 0) {
    const id = queue.shift()
    if (!id || visited.has(id)) continue

    visited.add(id)
    order.push(id)

    for (const edge of edges) {
      if (edge.source !== id || !bodySet.has(edge.target) || visited.has(edge.target)) continue
      queue.push(edge.target)
    }
  }

  for (const id of bodyNodeIds) {
    if (!visited.has(id)) order.push(id)
  }

  return order
}

/** How many ancestor loop bodies contain this loop node (0 = main-flow loop). */
export function getLoopNestingDepth(loopNodeId: string, nodes: Node[]): number {
  let depth = 0
  let memberId: string | null = loopNodeId

  while (memberId) {
    const parentLoop = findParentLoopNode(memberId, nodes)
    if (!parentLoop) break

    depth += 1
    memberId = parentLoop.id
  }

  return depth
}

export function isNodeInLoopBody(nodeId: string, loopNode: Node, nodes: Node[]): boolean {
  const bodyIds = readLoopBodyNodeIds((loopNode.data as WorkflowNodeData).config)
  if (bodyIds.includes(nodeId)) return true

  const groupId = `${loopNode.id}-loop-body`
  let currentId: string | undefined = nodeId

  while (currentId) {
    if (currentId === groupId) return true

    const current = nodes.find((node) => node.id === currentId)
    if (!current?.parentId) return false

    if (current.parentId === groupId || current.parentId === loopNode.id) return true
    if (bodyIds.includes(current.parentId)) return true

    currentId = current.parentId
  }

  return false
}

export function findLoopNodeForBodyMember(nodeId: string, nodes: Node[]): Node | undefined {
  let deepestLoop: Node | undefined
  let maxDepth = -1

  for (const node of nodes) {
    const data = node.data as WorkflowNodeData
    if (!isLoopNodeType(data.nodeType ?? '')) continue
    if (!isNodeInLoopBody(nodeId, node, nodes)) continue

    const depth = getLoopNestingDepth(node.id, nodes)
    if (depth > maxDepth) {
      maxDepth = depth
      deepestLoop = node
    }
  }

  return deepestLoop
}

export function isCanvasLayoutNode(node: Node, nodes: Node[] = []): boolean {
  if (node.type === LOOP_BODY_GROUP_NODE_TYPE) return false
  if (node.parentId && node.parentId.endsWith('-loop-body')) return false
  if (isNodeInAnyLoopBody(node.id, nodes)) return false
  return true
}
