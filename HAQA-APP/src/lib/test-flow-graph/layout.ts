import type { Connection, Edge, Node } from '@xyflow/react'
import { Position } from '@xyflow/react'
import type { IfElseBranch, TestFlowNodeType, WorkflowNodeData } from './types'
import {
  HORIZONTAL_NODE_GAP,
  VERTICAL_BRANCH_OFFSET,
  WORKFLOW_NODE_ORIGIN,
  FLOW_BOARD_START_X,
  FLOW_BOARD_Y,
  POSITION_TOLERANCE,
  LOOP_BODY_BRANCH_ID,
  LOOP_DONE_BRANCH_ID,
  BRANCH_HANDLE_COLORS,
} from './constants'
import {
  IF_ELSE_NODE_LAYOUT,
  LOOP_BODY_GROUP,
  getLoopBodyDoneHandleCenterY,
} from '@/components/test-flow/workflow-node-layout'
import {
  getIfElseBranches,
  getNodeOutputBranches,
  isBranchingNodeType,
  isLoopNodeType,
  readLoopBreakExits,
  isElseBranchIndex,
} from './branch-config'
import {
  getLoopBodyGroupId,
  isLoopBodyGroupNode,
  isCanvasLayoutNode,
  getLoopDoneOutputPosition,
  getLoopBreakOutputPosition,
  resolveBreakHandleCenterYForGroup,
} from './loop-body'
import { syncAllLoopBodyGroups } from './loop-body'

export function getWorkflowNodeLayoutWidth(node: Node): number {
  if (isLoopBodyGroupNode(node)) {
    return Number(node.style?.width ?? LOOP_BODY_GROUP.minWidth)
  }

  const data = node.data as WorkflowNodeData
  const nodeType = data.nodeType ?? 'script'

  if (nodeType === 'if-else' || isLoopNodeType(nodeType)) {
    return IF_ELSE_NODE_LAYOUT.minWidth
  }

  return LOOP_BODY_GROUP.nodeWidth
}

/** Main-flow footprint from node left edge through any attached loop body group. */
export function getCanvasNodeLayoutSpan(node: Node, nodes: Node[]): number {
  const baseWidth = getWorkflowNodeLayoutWidth(node)
  const data = node.data as WorkflowNodeData

  if (!isLoopNodeType(data.nodeType ?? '')) {
    return baseWidth
  }

  const group = nodes.find((candidate) => candidate.id === getLoopBodyGroupId(node.id))
  if (!group) {
    return baseWidth
  }

  const groupWidth = Number(group.style?.width ?? LOOP_BODY_GROUP.minWidth)
  return baseWidth + HORIZONTAL_NODE_GAP - LOOP_BODY_GROUP.padding + groupWidth
}

function getTargetPositionAfterNode(
  sourceNode: Node,
  nodes: Node[],
  offsetY = 0,
  options?: { useCanvasSpan?: boolean },
): { x: number; y: number } {
  const width =
    options?.useCanvasSpan === false
      ? getWorkflowNodeLayoutWidth(sourceNode)
      : getCanvasNodeLayoutSpan(sourceNode, nodes)

  return {
    x: sourceNode.position.x + width + HORIZONTAL_NODE_GAP,
    y: sourceNode.position.y + offsetY,
  }
}

function getBranchOutputPositionForConnection(
  sourceNode: Node,
  handleId: string,
  branches: IfElseBranch[],
  targetNode: Node,
  nodes: Node[],
): { x: number; y: number } {
  const index = branches.findIndex((branch) => branch.id === handleId)
  const offsetY = index === -1 ? 0 : getBranchOffsetY(index, branches.length)

  if (sourceNode.parentId && targetNode.parentId === sourceNode.parentId) {
    return getTargetPositionAfterNode(sourceNode, nodes, offsetY, { useCanvasSpan: false })
  }

  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  const flatSource = flattenNodePosition(sourceNode, nodeMap)
  const width =
    isCanvasLayoutNode(sourceNode, nodes)
      ? getCanvasNodeLayoutSpan(sourceNode, nodes)
      : getWorkflowNodeLayoutWidth(sourceNode)

  return {
    x: flatSource.x + width + HORIZONTAL_NODE_GAP,
    y: flatSource.y + offsetY,
  }
}

export function getBranchHandleTopPercent(
  index: number,
  count: number,
  reserveHeader = false,
): string {
  if (count <= 1) return reserveHeader ? '58%' : '50%'

  const topPadding = reserveHeader ? 38 : 18
  const bottomPadding = reserveHeader ? 22 : 18
  const range = 100 - topPadding - bottomPadding

  return `${topPadding + (index / (count - 1)) * range}%`
}

export function getBranchHandleColorClass(
  index: number,
  count?: number,
  layout: 'if-else' | 'loop' = 'if-else',
): string {
  if (count !== undefined) {
    if (layout === 'loop') {
      if (index === 0) return '!border-green-500'
      if (index === count - 1) return '!border-blue-500'
      return BRANCH_HANDLE_COLORS[(index - 1) % BRANCH_HANDLE_COLORS.length]
    }

    if (isElseBranchIndex(index, count)) {
      return '!border-red-500'
    }
  }

  return BRANCH_HANDLE_COLORS[index % BRANCH_HANDLE_COLORS.length]
}

export { IF_ELSE_NODE_LAYOUT } from '@/components/test-flow/workflow-node-layout'

export function getIfElseNodeHeight(branchCount: number, showFooter: boolean): number {
  const { paddingY, headerHeight, branchRowHeight, footerHeight } = IF_ELSE_NODE_LAYOUT

  return (
    paddingY * 2 +
    headerHeight +
    branchCount * branchRowHeight +
    (showFooter ? footerHeight : 0)
  )
}

export function getIfElseBranchHandleTopPercent(
  rowIndex: number,
  branchCount: number,
  showFooter: boolean,
): string {
  const nodeHeight = getIfElseNodeHeight(branchCount, showFooter)
  const { paddingY, headerHeight, branchRowHeight } = IF_ELSE_NODE_LAYOUT
  const centerY = paddingY + headerHeight + rowIndex * branchRowHeight + branchRowHeight / 2

  return `${(centerY / nodeHeight) * 100}%`
}


export function getBranchOutputPosition(
  sourceNode: Node,
  handleId: string,
  branches?: IfElseBranch[],
  nodes: Node[] = [],
): { x: number; y: number } {
  const data = sourceNode.data as WorkflowNodeData
  const nodeType = data.nodeType ?? ''
  const branchList =
    branches ??
    (isBranchingNodeType(nodeType) ? getNodeOutputBranches(data) : [])
  const index = branchList.findIndex((branch) => branch.id === handleId)
  const offsetY = index === -1 ? 0 : getBranchOffsetY(index, branchList.length)

  return getTargetPositionAfterNode(sourceNode, nodes, offsetY)
}

/** @deprecated Use getBranchOutputPosition */
export function getIfElseBranchPosition(
  sourceNode: Node,
  handleId: string,
  branches?: IfElseBranch[],
): { x: number; y: number } {
  return getBranchOutputPosition(sourceNode, handleId, branches)
}

function branchHasTarget(
  branchNode: Node,
  branchId: string,
  nodes: Node[],
  edges: Edge[],
): boolean {
  const position = getBranchOutputPosition(branchNode, branchId, undefined, nodes)
  const outgoing = edges.filter((edge) => edge.source === branchNode.id)

  return (
    outgoing.some((edge) => edge.sourceHandle === branchId) ||
    nodes.some((node) => isNearPosition(node, position, branchNode.id))
  )
}

function getNextBranchSlot(
  nodes: Node[],
  edges: Edge[],
): { x: number; y: number } | null {
  const branchingNodes = [...nodes]
    .filter((node) => isBranchingNodeType((node.data as WorkflowNodeData)?.nodeType ?? ''))
    .sort((a, b) => b.position.x - a.position.x)

  for (const branchNode of branchingNodes) {
    const data = branchNode.data as WorkflowNodeData
    const nodeType = data.nodeType ?? ''
    const branches = getNodeOutputBranches(data)

    for (const branch of branches) {
      if (isLoopNodeType(nodeType) && branch.id === LOOP_BODY_BRANCH_ID) continue

      if (!branchHasTarget(branchNode, branch.id, nodes, edges)) {
        return getBranchOutputPosition(branchNode, branch.id, branches, nodes)
      }
    }
  }

  for (const loopNode of nodes) {
    const data = loopNode.data as WorkflowNodeData
    if (!isLoopNodeType(data.nodeType ?? '')) continue

    const groupId = getLoopBodyGroupId(loopNode.id)
    const groupNode = nodes.find((node) => node.id === groupId)
    if (!groupNode) continue

    const donePosition = getLoopDoneOutputPosition(groupNode)
    const doneHasTarget =
      edges.some(
        (edge) => edge.source === groupId && edge.sourceHandle === LOOP_DONE_BRANCH_ID,
      ) || nodes.some((node) => isNearPosition(node, donePosition, groupId))

    if (!doneHasTarget) return donePosition

    const breakExits = readLoopBreakExits(data.config)
    for (const breakExit of breakExits) {
      const position = getLoopBreakOutputPosition(groupNode, breakExit.id, breakExits)
      const hasTarget =
        edges.some(
          (edge) => edge.source === groupId && edge.sourceHandle === breakExit.id,
        ) || nodes.some((node) => isNearPosition(node, position, groupId))

      if (!hasTarget) return position
    }
  }

  return null
}

export function getNextNodePosition(
  existingNodes: Node[],
  edges: Edge[] = [],
): { x: number; y: number } {
  const canvasNodes = existingNodes.filter((node) => isCanvasLayoutNode(node, existingNodes))

  if (canvasNodes.length === 0) {
    return { x: FLOW_BOARD_START_X, y: FLOW_BOARD_Y }
  }

  const branchSlot = getNextBranchSlot(canvasNodes, edges)
  if (branchSlot) return branchSlot

  const rightmostEdge = canvasNodes.reduce(
    (maxRight, node) =>
      Math.max(maxRight, node.position.x + getCanvasNodeLayoutSpan(node, existingNodes)),
    FLOW_BOARD_START_X,
  )

  return {
    x: rightmostEdge + HORIZONTAL_NODE_GAP,
    y: FLOW_BOARD_Y,
  }
}

export function repositionNodeForBranchConnection(
  nodes: Node[],
  connection: Connection,
): Node[] {
  if (!connection.source || !connection.target) return nodes

  const sourceNode = nodes.find((node) => node.id === connection.source)
  const targetNode = nodes.find((node) => node.id === connection.target)
  if (!sourceNode || !targetNode) return nodes

  // Never move the loop body shell when wiring branches to Break / Done handles.
  if (isLoopBodyGroupNode(targetNode)) return nodes

  const handle = connection.sourceHandle
  if (!handle) return nodes

  if (isLoopBodyGroupNode(sourceNode)) {
    const targetNode = nodes.find((node) => node.id === connection.target)
    if (!targetNode) return nodes

    const groupWidth = Number(sourceNode.style?.width ?? LOOP_BODY_GROUP.minWidth)
    const groupHeight = Number(sourceNode.style?.height ?? LOOP_BODY_GROUP.minHeight)
    const sharedParent =
      Boolean(sourceNode.parentId) && sourceNode.parentId === targetNode.parentId

    if (handle === LOOP_DONE_BRANCH_ID) {
      const position = sharedParent
        ? {
            x: sourceNode.position.x + groupWidth + HORIZONTAL_NODE_GAP,
            y: sourceNode.position.y + getLoopBodyDoneHandleCenterY(groupHeight),
          }
        : getLoopDoneOutputPosition(sourceNode)
      return nodes.map((node) =>
        node.id === connection.target
          ? { ...node, origin: WORKFLOW_NODE_ORIGIN, position }
          : node,
      )
    }

    const breakExits = Array.isArray(sourceNode.data?.breakExits)
      ? (sourceNode.data.breakExits as IfElseBranch[])
      : []
    if (!breakExits.some((branch) => branch.id === handle)) return nodes

    const breakIndex = breakExits.findIndex((branch) => branch.id === handle)
    const breakCenterY = resolveBreakHandleCenterYForGroup(
      sourceNode,
      handle,
      Math.max(breakIndex, 0),
      breakExits.length,
    )
    const position = sharedParent
      ? {
          x: sourceNode.position.x + groupWidth + HORIZONTAL_NODE_GAP,
          y: sourceNode.position.y + breakCenterY,
        }
      : getLoopBreakOutputPosition(sourceNode, handle, breakExits)
    return nodes.map((node) =>
      node.id === connection.target
        ? { ...node, origin: WORKFLOW_NODE_ORIGIN, position }
        : node,
    )
  }

  const nodeType = (sourceNode.data as WorkflowNodeData)?.nodeType ?? ''
  if (!isBranchingNodeType(nodeType)) return nodes

  if (isLoopNodeType(nodeType) && handle === LOOP_BODY_BRANCH_ID) return nodes

  const branches = getNodeOutputBranches(sourceNode.data as WorkflowNodeData)
  if (!branches.some((branch) => branch.id === handle)) return nodes

  const position = getBranchOutputPositionForConnection(
    sourceNode,
    handle,
    branches,
    targetNode,
    nodes,
  )

  return nodes.map((node) =>
    node.id === connection.target
      ? {
          ...node,
          origin: WORKFLOW_NODE_ORIGIN,
          position,
        }
      : node,
  )
}


export function getWorkflowNodeOrder(nodes: Node[]): Node[] {
  return [...nodes]
    .filter((node) => isCanvasLayoutNode(node, nodes))
    .sort(
      (a, b) => a.position.x - b.position.x || a.id.localeCompare(b.id),
    )
}

function mergeMainFlowRelayout(allNodes: Node[], relayoutedMain: Node[]): Node[] {
  const relayoutedIds = new Set(relayoutedMain.map((node) => node.id))
  const preserved = allNodes.filter((node) => !relayoutedIds.has(node.id))
  return syncAllLoopBodyGroups([...relayoutedMain, ...preserved], [])
}

export function canSwapWorkflowNode(
  nodes: Node[],
  nodeId: string,
  direction: 'left' | 'right',
): boolean {
  const ordered = getWorkflowNodeOrder(nodes)
  const index = ordered.findIndex((node) => node.id === nodeId)
  if (index === -1) return false

  const neighborIndex = direction === 'left' ? index - 1 : index + 1
  if (neighborIndex < 0 || neighborIndex >= ordered.length) return false

  const node = ordered[index]
  const neighbor = ordered[neighborIndex]

  if (node.data?.nodeType === 'start' || neighbor.data?.nodeType === 'start') {
    return false
  }

  return true
}

function relayoutOrderedNodes(ordered: Node[], allNodes: Node[]): Node[] {
  let nextX = FLOW_BOARD_START_X

  return ordered.map((node) => {
    const positioned = {
      ...node,
      origin: WORKFLOW_NODE_ORIGIN,
      position: {
        x: nextX,
        y: FLOW_BOARD_Y,
      },
    }

    nextX += getCanvasNodeLayoutSpan(positioned, allNodes) + HORIZONTAL_NODE_GAP
    return positioned
  })
}

export function alignWorkflowNodePositions(nodes: Node[]): Node[] {
  return nodes.map((node) => ({
    ...node,
    origin: WORKFLOW_NODE_ORIGIN,
    position: {
      x: node.position.x,
      y: FLOW_BOARD_Y,
    },
  }))
}

function remapEdgesAfterAdjacentSwap(
  edges: Edge[],
  leftNodeId: string,
  rightNodeId: string,
): Edge[] {
  return edges.map((edge) => {
    if (edge.source === leftNodeId && edge.target === rightNodeId) {
      return { ...edge, source: rightNodeId, target: leftNodeId }
    }

    let source = edge.source
    let target = edge.target

    if (source === leftNodeId) source = rightNodeId
    else if (source === rightNodeId) source = leftNodeId

    if (target === leftNodeId) target = rightNodeId
    else if (target === rightNodeId) target = leftNodeId

    if (source === edge.source && target === edge.target) {
      return edge
    }

    return { ...edge, source, target }
  })
}

export function swapAdjacentWorkflowNode(
  nodes: Node[],
  edges: Edge[],
  nodeId: string,
  direction: 'left' | 'right',
): { nodes: Node[]; edges: Edge[] } {
  if (!canSwapWorkflowNode(nodes, nodeId, direction)) {
    return { nodes, edges }
  }

  const ordered = getWorkflowNodeOrder(nodes)
  const index = ordered.findIndex((node) => node.id === nodeId)
  const neighborIndex = direction === 'left' ? index - 1 : index + 1

  const nodeA = ordered[index]
  const nodeB = ordered[neighborIndex]

  const nextOrdered = [...ordered]
  nextOrdered[index] = nodeB
  nextOrdered[neighborIndex] = nodeA

  const leftNodeId = direction === 'left' ? nodeB.id : nodeA.id
  const rightNodeId = direction === 'left' ? nodeA.id : nodeB.id

  return {
    nodes: mergeMainFlowRelayout(nodes, relayoutOrderedNodes(nextOrdered, nodes)),
    edges: remapEdgesAfterAdjacentSwap(edges, leftNodeId, rightNodeId),
  }
}
