import type { Connection, Edge, Node } from '@xyflow/react'
import { addEdge } from '@xyflow/react'
import type {
  DeleteWorkflowNodesResult,
  IfElseBranch,
  TestFlowNodeType,
  WorkflowNodeData,
} from './types'
import {
  HORIZONTAL_NODE_GAP,
  WORKFLOW_EDGE_OPTIONS,
  WORKFLOW_NODE_ORIGIN,
  LOOP_BODY_GROUP_NODE_TYPE,
  LOOP_BODY_GROUP_ORIGIN,
  LOOP_BODY_BRANCH_ID,
  LOOP_DONE_BRANCH_ID,
  LOOP_CONTINUE_SOURCE_HANDLE,
} from './constants'
import {
  IF_ELSE_NODE_LAYOUT,
  LOOP_BODY_GROUP,
  getLoopBodyBreakHandleCenterY,
  getLoopBodyDoneHandleCenterY,
  clampLoopBodyBreakHandleCenterY,
} from '@/components/test-flow/workflow-node-layout'
import {
  getIfElseBranches,
  getLoopBranches,
  isLoopNodeType,
  readLoopBodyNodeIds,
  readLoopBreakExits,
  normalizeLoopBodyNodeIds,
  migrateLoopNodeConfig,
  getLoopBranchRowCount,
  getLoopNodeHeight,
} from './branch-config'
import { createWorkflowNode, createNodeId } from './nodes'
import { connectEdge, pruneEdgesForRemovedBranches, workflowEdgeExists } from './connections'
import { withWorkflowEdgeDefaults, isLoopBackEdge, isUiOnlyEdge } from './edge-helpers'
import {
  getIfElseNodeHeight,
  getWorkflowNodeLayoutWidth,
  getCanvasNodeLayoutSpan,
  canSwapWorkflowNode,
  getBranchOffsetY,
  flattenNodePosition,
} from './layout'
import { isTestFlowNodeType } from '@/components/test-flow/workflow-node-definitions'

function isNodeInAnyLoopBody(nodeId: string, nodes: Node[]): boolean {
  return nodes.some((node) => {
    const data = node.data as WorkflowNodeData
    if (!isLoopNodeType(data.nodeType ?? '')) return false
    return readLoopBodyNodeIds(data.config).includes(nodeId)
  })
}

/** Parent loop that lists `loopNodeId` in its body (for nested loop exit wiring). */
export function getLoopBodyGroupId(loopNodeId: string): string {
  return `${loopNodeId}-loop-body`
}

export function isLoopBodyGroupNode(node: Node): boolean {
  return node.type === LOOP_BODY_GROUP_NODE_TYPE
}

function findParentLoopNode(loopNodeId: string, nodes: Node[]): Node | undefined {
  return nodes.find((node) => {
    const data = node.data as WorkflowNodeData
    if (!isLoopNodeType(data.nodeType ?? '')) return false
    return readLoopBodyNodeIds(data.config).includes(loopNodeId)
  })
}

function isValidLoopGroupExitTarget(
  loopNodeId: string,
  targetNode: Node,
  nodes: Node[],
): boolean {
  if (isCanvasLayoutNode(targetNode, nodes)) return true

  const parentLoop = findParentLoopNode(loopNodeId, nodes)
  if (!parentLoop) return false

  if (!isNodeInLoopBody(targetNode.id, parentLoop, nodes)) return false

  const targetType = (targetNode.data as WorkflowNodeData)?.nodeType ?? ''
  return isLoopBodyWorkNodeType(targetType as TestFlowNodeType)
}

export function isCanvasLayoutNode(node: Node, nodes: Node[] = []): boolean {
  if (isLoopBodyGroupNode(node)) return false
  if (node.parentId && node.parentId.endsWith('-loop-body')) return false
  if (isNodeInAnyLoopBody(node.id, nodes)) return false
  return true
}

/** Work nodes that fan out to multiple outgoing paths (branch) vs a single default output (leaf path). */
export function isBranchingWorkNodeType(nodeType: string): boolean {
  return nodeType === 'if-else' || isLoopNodeType(nodeType)
}

function getLoopBodyMemberSet(bodyNodeIds: string[]): Set<string> {
  return new Set(bodyNodeIds)
}

function getLoopBodyMemberEdges(edges: Edge[], bodySet: Set<string>): Edge[] {
  return edges.filter((edge) => bodySet.has(edge.source) && bodySet.has(edge.target))
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

function workflowEdgeExists(
  edges: Edge[],
  source: string,
  target: string,
  sourceHandle?: string | null,
): boolean {
  return edges.some(
    (edge) =>
      edge.source === source &&
      edge.target === target &&
      (sourceHandle === undefined
        ? !edge.sourceHandle
        : edge.sourceHandle === sourceHandle),
  )
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

function getLoopBodyContentSpan(bodyCount: number): number {
  if (bodyCount <= 0) return 0

  const { nodeWidth } = LOOP_BODY_GROUP
  return (bodyCount - 1) * HORIZONTAL_NODE_GAP + nodeWidth
}

function getLoopBodyGroupSize(
  bodyCount: number,
  breakCount: number,
  contentHeight?: number,
): { width: number; height: number } {
  const { padding, nodeHeight, bodyNodeHeight, minWidth, minHeight, labelHeight } = LOOP_BODY_GROUP

  if (bodyCount <= 0) {
    return { width: minWidth, height: minHeight }
  }

  const contentSpan = getLoopBodyContentSpan(bodyCount)
  const railWidth = LOOP_BODY_GROUP.exitRailWidth
  const width = Math.max(minWidth, padding * 2 + contentSpan + railWidth)
  const stackHeight = Math.max(
    nodeHeight,
    bodyNodeHeight,
    contentHeight ?? bodyNodeHeight,
  )
  const height = Math.max(
    minHeight,
    padding * 2 + stackHeight,
    labelHeight + padding + stackHeight,
  )

  return { width, height }
}

/** How many ancestor loop bodies contain this loop node (0 = main-flow loop). */
export function getLoopNestingDepth(loopNodeId: string, nodes: Node[]): number {
  let depth = 0
  let memberId: string | null = loopNodeId

  while (memberId) {
    const parentLoop = nodes.find((node) => {
      const data = node.data as WorkflowNodeData
      if (!isLoopNodeType(data.nodeType ?? '')) return false
      return readLoopBodyNodeIds(data.config).includes(memberId!)
    })

    if (!parentLoop) break

    depth += 1
    memberId = parentLoop.id
  }

  return depth
}

function getNestedLoopBodyTopInset(): number {
  const { labelHeight, padding } = LOOP_BODY_GROUP
  return labelHeight + padding * 2 + 16
}

function getNestedLoopBodyLayoutMetrics(
  loopNode: Node,
  nodes: Node[],
  edges: Edge[],
): { width: number; height: number } | null {
  const data = loopNode.data as WorkflowNodeData
  const nodeType = data.nodeType ?? 'script'
  if (!isLoopNodeType(nodeType)) return null

  const bodyIds = readLoopBodyNodeIds(data.config)
  if (bodyIds.length === 0) return null

  const breakCount = readLoopBreakExits(data.config).length
  const metrics = computeLoopBodyLayoutMetrics(bodyIds, nodes, edges, breakCount, loopNode.id)
  return { width: metrics.width, height: metrics.height }
}

/** Full bounds for a nested loop card plus its inner loop-body group. */
function computeNestedLoopCompoundSize(
  loopNode: Node,
  nodes: Node[],
  edges: Edge[],
): { width: number; height: number; innerWidth: number; innerHeight: number } {
  const loopCardWidth = getLoopCardWidth(loopNode)
  const loopData = loopNode.data as WorkflowNodeData
  const loopCardHeight = getLoopNodeHeight(
    false,
    getLoopBranchRowCount(readLoopBodyNodeIds(loopData.config).length > 0),
  )
  const innerMetrics = getNestedLoopBodyLayoutMetrics(loopNode, nodes, edges)

  if (!innerMetrics) {
    return {
      width: loopCardWidth,
      height: loopCardHeight,
      innerWidth: 0,
      innerHeight: 0,
    }
  }

  const { padding } = LOOP_BODY_GROUP
  const width = loopCardWidth + HORIZONTAL_NODE_GAP + innerMetrics.width - padding
  const height = Math.max(loopCardHeight, getNestedLoopBodyTopInset() + innerMetrics.height)

  return {
    width,
    height,
    innerWidth: innerMetrics.width,
    innerHeight: innerMetrics.height,
  }
}

function getLoopBodyMemberVisualHeight(
  node: Node,
  nodes: Node[],
  edges: Edge[],
): number {
  const data = node.data as WorkflowNodeData
  const nodeType = data.nodeType ?? 'script'

  if (nodeType === 'if-else') {
    return getIfElseNodeHeight(getIfElseBranches(data).length, false)
  }

  if (isLoopNodeType(nodeType)) {
    return computeNestedLoopCompoundSize(node, nodes, edges).height
  }

  return LOOP_BODY_GROUP.bodyNodeHeight
}

function getLoopBodyMemberVisualWidth(
  node: Node,
  nodes: Node[],
  edges: Edge[],
): number {
  const data = node.data as WorkflowNodeData
  const nodeType = data.nodeType ?? 'script'

  if (nodeType === 'if-else') {
    return LOOP_BODY_GROUP.nodeWidth
  }

  if (isLoopNodeType(nodeType)) {
    return computeNestedLoopCompoundSize(node, nodes, edges).width
  }

  return LOOP_BODY_GROUP.nodeWidth
}

function computeLoopBodyDepths(
  bodyNodeIds: string[],
  edges: Edge[],
): Map<string, number> {
  const bodySet = new Set(bodyNodeIds)
  const depths = new Map<string, number>()

  for (const id of bodyNodeIds) {
    depths.set(id, 0)
  }

  for (let pass = 0; pass < bodyNodeIds.length; pass += 1) {
    let changed = false

    for (const edge of edges) {
      if (!bodySet.has(edge.source) || !bodySet.has(edge.target)) continue

      const nextDepth = (depths.get(edge.source) ?? 0) + 1
      if (nextDepth > (depths.get(edge.target) ?? 0)) {
        depths.set(edge.target, nextDepth)
        changed = true
      }
    }

    if (!changed) break
  }

  return depths
}

function computeLoopBodyMemberY(
  bodyNodeIds: string[],
  edges: Edge[],
  nodes: Node[],
  depths: Map<string, number>,
): Map<string, number> {
  const bodySet = new Set(bodyNodeIds)
  const y = new Map<string, number>()

  for (const id of bodyNodeIds) {
    y.set(id, 0)
  }

  const sortedIds = [...bodyNodeIds].sort(
    (left, right) => (depths.get(left) ?? 0) - (depths.get(right) ?? 0),
  )

  const bodyEdges = edges.filter(
    (edge) => bodySet.has(edge.source) && bodySet.has(edge.target),
  )

  for (const targetId of sortedIds) {
    const incoming = bodyEdges.filter((edge) => edge.target === targetId)
    if (incoming.length === 0) continue

    const branchEdge = incoming.find((edge) => {
      const sourceNode = nodes.find((node) => node.id === edge.source)
      return (
        (sourceNode?.data as WorkflowNodeData)?.nodeType === 'if-else' &&
        Boolean(edge.sourceHandle)
      )
    })
    const primary = branchEdge ?? incoming[incoming.length - 1]
    const sourceY = y.get(primary.source) ?? 0
    const sourceNode = nodes.find((node) => node.id === primary.source)
    const sourceType = (sourceNode?.data as WorkflowNodeData)?.nodeType ?? ''

    let targetY = sourceY
    if (sourceType === 'if-else' && primary.sourceHandle && sourceNode) {
      const branches = getIfElseBranches(sourceNode.data as WorkflowNodeData)
      const branchIndex = branches.findIndex((branch) => branch.id === primary.sourceHandle)
      if (branchIndex >= 0) {
        targetY = sourceY + getBranchOffsetY(branchIndex, branches.length)
      }
    }

    y.set(targetId, targetY)
  }

  return y
}

function isLoopBodyBranchEdge(edge: Edge, nodes: Node[]): boolean {
  if (!edge.sourceHandle) return false

  const sourceNode = nodes.find((node) => node.id === edge.source)
  if (!sourceNode) return false

  const sourceType = (sourceNode.data as WorkflowNodeData)?.nodeType ?? ''
  if (sourceType !== 'if-else') return false

  const branches = getIfElseBranches(sourceNode.data as WorkflowNodeData)
  return branches.some((branch) => branch.id === edge.sourceHandle)
}

const LOOP_BODY_BRANCH_STACK_GAP = 24

/** Horizontal columns: edge tree + editor step order so inserted steps do not overlap. */
function computeLoopBodyColumns(
  bodyNodeIds: string[],
  edges: Edge[],
  nodes: Node[],
): Map<string, number> {
  const bodySet = new Set(bodyNodeIds)
  const columns = new Map<string, number>()

  for (const id of bodyNodeIds) {
    columns.set(id, 0)
  }

  const bodyEdges = edges.filter(
    (edge) => bodySet.has(edge.source) && bodySet.has(edge.target),
  )
  const branchTargetIds = new Set<string>()
  for (const edge of bodyEdges) {
    if (isLoopBodyBranchEdge(edge, nodes)) {
      branchTargetIds.add(edge.target)
    }
  }

  const depths = computeLoopBodyDepths(bodyNodeIds, edges)
  const sortedEdges = [...bodyEdges].sort(
    (left, right) => (depths.get(left.target) ?? 0) - (depths.get(right.target) ?? 0),
  )

  for (const edge of sortedEdges) {
    const sourceCol = columns.get(edge.source) ?? 0
    // Branch siblings share the next column; only sequential edges advance further.
    const targetCol = sourceCol + 1

    columns.set(edge.target, Math.max(columns.get(edge.target) ?? 0, targetCol))
  }

  for (let index = 0; index < bodyNodeIds.length; index += 1) {
    const id = bodyNodeIds[index]
    if (branchTargetIds.has(id)) continue

    const listCol =
      index === 0
        ? 0
        : Math.max(
            ...bodyNodeIds
              .slice(0, index)
              .map((previousId) => (columns.get(previousId) ?? 0) + 1),
          )

    columns.set(id, Math.max(columns.get(id) ?? 0, listCol))
  }

  return columns
}

/** Stack If / Else branch targets vertically so later branches sit under earlier ones. */
function stackLoopBodyBranchTargetY(
  bodyNodeIds: string[],
  edges: Edge[],
  nodes: Node[],
  yById: Map<string, number>,
): void {
  const bodySet = new Set(bodyNodeIds)

  for (const sourceNode of nodes) {
    const data = sourceNode.data as WorkflowNodeData
    if ((data.nodeType ?? '') !== 'if-else') continue
    if (!bodySet.has(sourceNode.id)) continue

    const branches = getIfElseBranches(data)
    const branchTargets: { branchIndex: number; targetId: string }[] = []

    for (const edge of edges) {
      if (edge.source !== sourceNode.id || !bodySet.has(edge.target)) continue
      if (!edge.sourceHandle) continue

      const branchIndex = branches.findIndex((branch) => branch.id === edge.sourceHandle)
      if (branchIndex < 0) continue

      branchTargets.push({ branchIndex, targetId: edge.target })
    }

    if (branchTargets.length <= 1) continue

    branchTargets.sort((left, right) => left.branchIndex - right.branchIndex)

    let previousBottom: number | null = null

    for (const { targetId } of branchTargets) {
      const targetNode = nodes.find((node) => node.id === targetId)
      if (!targetNode) continue

      const targetHeight = getLoopBodyMemberVisualHeight(targetNode, nodes, edges)
      const currentY = yById.get(targetId) ?? 0

      if (previousBottom === null) {
        yById.set(targetId, currentY)
        previousBottom = currentY + targetHeight / 2
        continue
      }

      const minCenterY = previousBottom + LOOP_BODY_BRANCH_STACK_GAP + targetHeight / 2
      const nextY = Math.max(currentY, minCenterY)

      yById.set(targetId, nextY)
      previousBottom = nextY + targetHeight / 2
    }
  }
}

function connectNewLoopBodyMember(
  currentIds: string[],
  newNodeId: string,
  nodes: Node[],
  edges: Edge[],
): Edge[] {
  if (currentIds.length === 0) return edges

  const leaves = findLoopBodyLeafNodeIds(currentIds, edges)

  if (leaves.length === 1) {
    const leafId = leaves[0]
    const leafNode = nodes.find((node) => node.id === leafId)
    const leafType = (leafNode?.data as WorkflowNodeData)?.nodeType ?? ''

    if (!isBranchingWorkNodeType(leafType)) {
      if (!workflowEdgeExists(edges, leafId, newNodeId, undefined)) {
        return connectEdge({ source: leafId, target: newNodeId }, edges)
      }
    }
  }

  return edges
}

type LoopBodyLayoutMetrics = {
  width: number
  height: number
  positions: Map<string, { x: number; y: number }>
  entryCenterY: number
  breakHandleCenterYs: Record<string, number>
}

const getEmptyLoopBodyLayoutMetrics = (): LoopBodyLayoutMetrics => ({
  width: LOOP_BODY_GROUP.minWidth,
  height: LOOP_BODY_GROUP.minHeight,
  positions: new Map(),
  entryCenterY: LOOP_BODY_GROUP.minHeight / 2,
  breakHandleCenterYs: {},
})

const collectLoopBodyColumnWidths = (
  bodyNodeIds: string[],
  nodes: Node[],
  edges: Edge[],
  columnsById: Map<string, number>,
) => {
  const widthByColumn = new Map<number, number>()

  for (const id of bodyNodeIds) {
    const node = nodes.find((member) => member.id === id)
    const memberWidth = node
      ? getLoopBodyMemberVisualWidth(node, nodes, edges)
      : LOOP_BODY_GROUP.nodeWidth
    const column = columnsById.get(id) ?? 0
    widthByColumn.set(column, Math.max(widthByColumn.get(column) ?? 0, memberWidth))
  }

  return widthByColumn
}

const getLoopBodyColumnContentSpan = (
  widthByColumn: Map<number, number>,
  maxColumn: number,
): number => {
  let contentSpan = 0

  for (let column = 0; column <= maxColumn; column += 1) {
    const columnWidth = widthByColumn.get(column) ?? LOOP_BODY_GROUP.nodeWidth
    if (column > 0) contentSpan += HORIZONTAL_NODE_GAP
    contentSpan += columnWidth
  }

  return contentSpan
}

const getLoopBodyColumnStarts = (
  startX: number,
  maxColumn: number,
  widthByColumn: Map<number, number>,
): Map<number, number> => {
  const columnStartX = new Map<number, number>()
  let columnX = startX

  for (let column = 0; column <= maxColumn; column += 1) {
    columnStartX.set(column, columnX)
    columnX += (widthByColumn.get(column) ?? LOOP_BODY_GROUP.nodeWidth) + HORIZONTAL_NODE_GAP
  }

  return columnStartX
}

const buildLoopBodyMemberPositions = (
  bodyNodeIds: string[],
  nodes: Node[],
  edges: Edge[],
  columnsById: Map<string, number>,
  yById: Map<string, number>,
  columnStartX: Map<number, number>,
  startX: number,
) => {
  const positions = new Map<string, { x: number; y: number }>()
  let minEdge = Infinity
  let maxEdge = -Infinity

  for (const id of bodyNodeIds) {
    const node = nodes.find((member) => member.id === id)
    const memberHeight = node
      ? getLoopBodyMemberVisualHeight(node, nodes, edges)
      : LOOP_BODY_GROUP.bodyNodeHeight
    const column = columnsById.get(id) ?? 0
    const centerY = yById.get(id) ?? 0
    const columnLeft = columnStartX.get(column) ?? startX

    positions.set(id, {
      x: columnLeft,
      y: centerY,
    })

    minEdge = Math.min(minEdge, centerY - memberHeight / 2)
    maxEdge = Math.max(maxEdge, centerY + memberHeight / 2)
  }

  return { positions, minEdge, maxEdge }
}

const shiftLoopBodyPositions = (
  positions: Map<string, { x: number; y: number }>,
  yShift: number,
) => {
  for (const [id, position] of positions) {
    positions.set(id, { x: position.x, y: position.y + yShift })
  }
}

const alignNestedLoopEntryHandles = (
  bodyNodeIds: string[],
  entryIds: string[],
  nodes: Node[],
  positions: Map<string, { x: number; y: number }>,
) => {
  const entryIdSet = new Set(entryIds)

  for (const id of bodyNodeIds) {
    if (entryIdSet.has(id)) continue

    const node = nodes.find((member) => member.id === id)
    const nodeType = (node?.data as WorkflowNodeData | undefined)?.nodeType ?? ''
    if (!node || !isLoopNodeType(nodeType)) continue

    const position = positions.get(id)
    if (!position) continue

    const handleOffset = getLoopLoopBranchHandleOffsetFromConfig(
      (node.data as WorkflowNodeData).config,
      false,
    )
    positions.set(id, { x: position.x, y: position.y - handleOffset })
  }
}

const getLoopBodyEntryCenterY = (
  entryIds: string[],
  positions: Map<string, { x: number; y: number }>,
): number => {
  if (entryIds.length === 0) {
    return LOOP_BODY_GROUP.labelHeight + LOOP_BODY_GROUP.padding + LOOP_BODY_GROUP.bodyNodeHeight / 2
  }

  const entryYs = entryIds
    .map((id) => positions.get(id)?.y)
    .filter((y): y is number => typeof y === 'number')

  return Math.min(...entryYs)
}

function computeLoopBodyLayoutMetrics(
  bodyNodeIds: string[],
  nodes: Node[],
  edges: Edge[],
  breakCount: number,
  loopNodeId: string,
): LoopBodyLayoutMetrics {
  const { padding, labelHeight, minWidth, minHeight, bodyNodeHeight } = LOOP_BODY_GROUP

  if (bodyNodeIds.length === 0) {
    return getEmptyLoopBodyLayoutMetrics()
  }

  const depths = computeLoopBodyDepths(bodyNodeIds, edges)
  const yById = computeLoopBodyMemberY(bodyNodeIds, edges, nodes, depths)
  stackLoopBodyBranchTargetY(bodyNodeIds, edges, nodes, yById)
  const columnsById = computeLoopBodyColumns(bodyNodeIds, edges, nodes)
  const maxColumn = Math.max(0, ...bodyNodeIds.map((id) => columnsById.get(id) ?? 0))
  const widthByColumn = collectLoopBodyColumnWidths(bodyNodeIds, nodes, edges, columnsById)
  const contentSpan = getLoopBodyColumnContentSpan(widthByColumn, maxColumn)
  const railWidth = LOOP_BODY_GROUP.exitRailWidth
  const width = Math.max(minWidth, padding * 2 + contentSpan + railWidth)
  const loopNode = nodes.find((node) => node.id === loopNodeId)
  const leftAlignContent = Boolean(loopNode?.parentId?.endsWith('-loop-body'))
  const startX = leftAlignContent ? padding : (width - contentSpan - railWidth) / 2
  const columnStartX = getLoopBodyColumnStarts(startX, maxColumn, widthByColumn)
  const { positions, minEdge, maxEdge } = buildLoopBodyMemberPositions(
    bodyNodeIds,
    nodes,
    edges,
    columnsById,
    yById,
    columnStartX,
    startX,
  )

  const contentHeight = Math.max(bodyNodeHeight, maxEdge - minEdge)
  const height = Math.max(minHeight, labelHeight + padding + contentHeight + padding)
  const yShift = labelHeight + padding - minEdge
  shiftLoopBodyPositions(positions, yShift)

  const entryIds = findLoopBodyEntryNodeIds(bodyNodeIds, edges, loopNodeId)
  alignNestedLoopEntryHandles(bodyNodeIds, entryIds, nodes, positions)
  const entryCenterY = getLoopBodyEntryCenterY(entryIds, positions)

  const loopBreakExits = readLoopBreakExits((loopNode?.data as WorkflowNodeData | undefined)?.config)
  const breakHandleCenterYs = computeBreakHandleCenterYs(
    getLoopBodyGroupId(loopNodeId),
    height,
    loopBreakExits,
    bodyNodeIds,
    edges,
    nodes,
    positions,
  )

  return { width, height, positions, entryCenterY, breakHandleCenterYs }
}

export function getLoopDoneHandleCenterOffsetY(showFooter = false): number {
  const loopHeight = getLoopNodeHeight(showFooter)
  const { paddingY, headerHeight, branchRowHeight } = IF_ELSE_NODE_LAYOUT
  const doneRowCenterFromTop =
    paddingY + headerHeight + branchRowHeight + branchRowHeight / 2

  return doneRowCenterFromTop - loopHeight / 2
}

/** Lowest Done handle Y relative to loop center (footer shrinks the offset). */
function getLoopDoneHandleLaneOffsetY(): number {
  return Math.min(
    getLoopDoneHandleCenterOffsetY(false),
    getLoopDoneHandleCenterOffsetY(true),
  )
}

function getLoopCardWidth(loopNode: Node): number {
  const data = loopNode.data as WorkflowNodeData
  return isLoopNodeType(data.nodeType ?? '')
    ? IF_ELSE_NODE_LAYOUT.minWidth
    : LOOP_BODY_GROUP.nodeWidth
}

function isNestedLoopInParentBody(loopNode: Node): boolean {
  return Boolean(loopNode.parentId?.endsWith('-loop-body'))
}

function loopNodeShowsReorderFooter(loopNode: Node, nodes: Node[]): boolean {
  if (isNestedLoopInParentBody(loopNode)) return false

  return (
    canSwapWorkflowNode(nodes, loopNode.id, 'left') ||
    canSwapWorkflowNode(nodes, loopNode.id, 'right')
  )
}

/** Offset from loop node center (origin [0, 0.5]) to the Loop branch handle center. */
function getLoopLoopBranchHandleOffsetFromConfig(
  config: Record<string, unknown> | undefined,
  showFooter: boolean,
): number {
  const branchRowCount = getLoopBranchRowCount(readLoopBodyNodeIds(config).length > 0)
  const nodeHeight = getLoopNodeHeight(showFooter, branchRowCount)
  const { paddingY, headerHeight, branchRowHeight } = IF_ELSE_NODE_LAYOUT
  const handleCenterFromTop = paddingY + headerHeight + branchRowHeight / 2

  return handleCenterFromTop - nodeHeight / 2
}

function getLoopLoopBranchHandleOffsetY(loopNode: Node, nodes: Node[]): number {
  const data = loopNode.data as WorkflowNodeData
  const showFooter = loopNodeShowsReorderFooter(loopNode, nodes)

  return getLoopLoopBranchHandleOffsetFromConfig(data.config, showFooter)
}

function getLoopBodyGroupPosition(
  loopNode: Node,
  groupHeight: number,
  entryCenterYInGroup: number = groupHeight / 2,
  nodes: Node[] = [],
): { x: number; y: number } {
  const { padding } = LOOP_BODY_GROUP
  const loopCardWidth = getLoopCardWidth(loopNode)
  const handleOffsetY = getLoopLoopBranchHandleOffsetY(loopNode, nodes)
  const y = loopNode.position.y + handleOffsetY - entryCenterYInGroup

  return {
    x: loopNode.position.x + loopCardWidth + HORIZONTAL_NODE_GAP - padding,
    y,
  }
}

/** Preserve loop-handle ↔ entry-step alignment while respecting nested top inset. */
function resolveLoopBodyGroupLayout(
  loopNode: Node,
  groupHeight: number,
  entryCenterYInGroup: number,
  nodes: Node[],
): { groupPosition: { x: number; y: number }; adjustedLoopNode: Node | null } {
  const groupPosition = getLoopBodyGroupPosition(
    loopNode,
    groupHeight,
    entryCenterYInGroup,
    nodes,
  )

  if (!isNestedLoopInParentBody(loopNode)) {
    return { groupPosition, adjustedLoopNode: null }
  }

  const minY = getNestedLoopBodyTopInset()
  if (groupPosition.y >= minY) {
    return { groupPosition, adjustedLoopNode: null }
  }

  const delta = minY - groupPosition.y

  return {
    // Keep the nested loop card anchored to preserve incoming/outgoing edge lanes.
    // Only push the inner loop-body group down to satisfy top inset constraints.
    groupPosition: { ...groupPosition, y: groupPosition.y + delta },
    adjustedLoopNode: null,
  }
}

export function getLoopDoneOutputPosition(groupNode: Node): { x: number; y: number } {
  const width = Number(groupNode.style?.width ?? LOOP_BODY_GROUP.minWidth)
  const height = Number(groupNode.style?.height ?? LOOP_BODY_GROUP.minHeight)

  return {
    x: groupNode.position.x + width + HORIZONTAL_NODE_GAP,
    y: groupNode.position.y + getLoopBodyDoneHandleCenterY(height),
  }
}

export function getLoopBodyNodePosition(
  loopNode: Node,
  stepIndex: number,
  totalSteps: number,
  bodyNodeIds?: string[],
  nodes?: Node[],
  edges?: Edge[],
): { x: number; y: number } {
  const breakCount = readLoopBreakExits((loopNode.data as WorkflowNodeData).config).length
  const ids =
    bodyNodeIds ?? readLoopBodyNodeIds((loopNode.data as WorkflowNodeData).config)
  const layoutOrder = deriveLoopBodyLayoutOrder(ids, edges ?? [], loopNode.id)
  const targetId = layoutOrder[stepIndex]

  if (!targetId || !nodes) {
    const { height } = getLoopBodyGroupSize(totalSteps, breakCount)
    const groupPosition = getLoopBodyGroupPosition(loopNode, height, height / 2, nodes)
    return {
      x: groupPosition.x,
      y: groupPosition.y + height / 2,
    }
  }

  const { height, positions, entryCenterY } = computeLoopBodyLayoutMetrics(
    ids,
    nodes,
    edges ?? [],
    breakCount,
    loopNode.id,
  )
  const groupPosition = getLoopBodyGroupPosition(loopNode, height, entryCenterY, nodes)
  const childPosition = positions.get(targetId) ?? { x: 0, y: height / 2 }

  return {
    x: groupPosition.x + childPosition.x,
    y: groupPosition.y + childPosition.y,
  }
}

export function getLoopBreakOutputPosition(
  groupNode: Node,
  handleId: string,
  breakExits: IfElseBranch[],
): { x: number; y: number } {
  const width = Number(groupNode.style?.width ?? LOOP_BODY_GROUP.minWidth)
  const index = breakExits.findIndex((branch) => branch.id === handleId)

  return {
    x: groupNode.position.x + width + HORIZONTAL_NODE_GAP,
    y:
      groupNode.position.y +
      resolveBreakHandleCenterYForGroup(
        groupNode,
        handleId,
        Math.max(index, 0),
        breakExits.length,
      ),
  }
}

export function isNodeInLoopBody(nodeId: string, loopNode: Node, nodes: Node[]): boolean {
  const bodyIds = readLoopBodyNodeIds((loopNode.data as WorkflowNodeData).config)
  if (bodyIds.includes(nodeId)) return true

  const groupId = getLoopBodyGroupId(loopNode.id)
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

export function getBreakExitsForLoopBodyGroup(targetNode: Node, nodes: Node[]): IfElseBranch[] {
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

function loopBodyHasIfElseNode(
  loopNodeId: string,
  bodyNodeIds: string[],
  nodes: Node[],
): boolean {
  if (
    bodyNodeIds.some((id) => {
      const member = nodes.find((node) => node.id === id)
      return (member?.data as WorkflowNodeData)?.nodeType === 'if-else'
    })
  ) {
    return true
  }

  const groupId = getLoopBodyGroupId(loopNodeId)
  return nodes.some(
    (node) =>
      node.parentId === groupId &&
      (node.data as WorkflowNodeData)?.nodeType === 'if-else',
  )
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

function getIfElseBranchHandleLaneY(
  node: Node,
  branchId: string,
  positionInGroup: { x: number; y: number },
): number {
  const data = node.data as WorkflowNodeData
  if ((data.nodeType ?? '') !== 'if-else' || !branchId) return positionInGroup.y

  const branches = getIfElseBranches(data)
  const rowIndex = branches.findIndex((branch) => branch.id === branchId)
  if (rowIndex < 0) return positionInGroup.y

  const nodeHeight = getIfElseNodeHeight(branches.length, false)
  const { paddingY, headerHeight, branchRowHeight } = IF_ELSE_NODE_LAYOUT
  const handleCenterFromTop =
    paddingY + headerHeight + rowIndex * branchRowHeight + branchRowHeight / 2

  return positionInGroup.y + (handleCenterFromTop - nodeHeight / 2)
}

function resolveBreakHandleCenterYForGroup(
  groupNode: Node,
  breakId: string,
  index: number,
  total: number,
): number {
  const height = Number(groupNode.style?.height ?? LOOP_BODY_GROUP.minHeight)
  const override = (groupNode.data as { breakHandleCenterYs?: Record<string, number> })
    ?.breakHandleCenterYs?.[breakId]

  if (typeof override === 'number') {
    return clampLoopBodyBreakHandleCenterY(height, override)
  }

  return getLoopBodyBreakHandleCenterY(height, index, total)
}

function computeBreakHandleCenterYs(
  groupId: string,
  groupHeight: number,
  breakExits: IfElseBranch[],
  bodyNodeIds: string[],
  edges: Edge[],
  nodes: Node[],
  positions: Map<string, { x: number; y: number }>,
): Record<string, number> {
  const result: Record<string, number> = {}
  const bodySet = new Set(bodyNodeIds)
  const ifElseNodes = bodyNodeIds
    .map((id) => nodes.find((node) => node.id === id))
    .filter((node): node is Node => {
      if (!node) return false
      return (node.data as WorkflowNodeData)?.nodeType === 'if-else'
    })

  for (let index = 0; index < breakExits.length; index += 1) {
    const breakExit = breakExits[index]
    const incoming = edges.filter(
      (edge) =>
        edge.target === groupId &&
        (edge.targetHandle === `${breakExit.id}-target` ||
          edge.targetHandle === breakExit.id),
    )

    let centerY = getLoopBodyBreakHandleCenterY(groupHeight, index, breakExits.length)
    const wired = incoming.find((edge) => bodySet.has(edge.source))

    if (wired) {
      const sourcePosition = positions.get(wired.source)
      const sourceNode = nodes.find((node) => node.id === wired.source)
      if (sourcePosition && sourceNode) {
        centerY = getIfElseBranchHandleLaneY(
          sourceNode,
          wired.sourceHandle ?? '',
          sourcePosition,
        )
      }
    } else if (ifElseNodes.length > 0) {
      const ifElseNode = ifElseNodes[0]
      const ifElsePosition = positions.get(ifElseNode.id)
      const branches = getIfElseBranches(ifElseNode.data as WorkflowNodeData)
      const branchIndex = Math.min(index, Math.max(branches.length - 1, 0))
      if (ifElsePosition && branches[branchIndex]) {
        centerY = getIfElseBranchHandleLaneY(
          ifElseNode,
          branches[branchIndex].id,
          ifElsePosition,
        )
      }
    }

    result[breakExit.id] = clampLoopBodyBreakHandleCenterY(groupHeight, centerY)
  }

  return result
}

function sortNodesParentFirst(nodes: Node[]): Node[] {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  const result: Node[] = []
  const added = new Set<string>()

  function addNode(nodeId: string) {
    if (added.has(nodeId)) return
    const node = nodeMap.get(nodeId)
    if (!node) return
    if (node.parentId) addNode(node.parentId)
    result.push(node)
    added.add(nodeId)
  }

  for (const node of nodes) addNode(node.id)
  return result
}

export function layoutLoopBodyNodes(
  loopNode: Node,
  bodyNodeIds: string[],
  nodes: Node[],
  edges: Edge[] = [],
): Node[] {
  const layoutOrder = deriveLoopBodyLayoutOrder(bodyNodeIds, edges, loopNode.id)
  const groupId = getLoopBodyGroupId(loopNode.id)
  const withoutGroup = nodes.filter((node) => node.id !== groupId)
  const loopData = loopNode.data as WorkflowNodeData
  const breakExits = readLoopBreakExits(loopData.config)

  if (bodyNodeIds.length === 0) {
    return withoutGroup.map((node) =>
      node.parentId === groupId
        ? {
            ...node,
            parentId: undefined,
            extent: undefined,
            expandParent: undefined,
          }
        : node,
    )
  }

  const { width, height, positions, entryCenterY, breakHandleCenterYs } =
    computeLoopBodyLayoutMetrics(
    bodyNodeIds,
    nodes,
    edges,
    breakExits.length,
    loopNode.id,
  )
  const { groupPosition, adjustedLoopNode } = resolveLoopBodyGroupLayout(
    loopNode,
    height,
    entryCenterY,
    nodes,
  )

  const nestedInParentBody = isNestedLoopInParentBody(loopNode)

  const groupNode: Node = {
    id: groupId,
    type: LOOP_BODY_GROUP_NODE_TYPE,
    origin: LOOP_BODY_GROUP_ORIGIN,
    position: groupPosition,
    parentId: loopNode.parentId,
    extent: loopNode.parentId ? ('parent' as const) : undefined,
    data: {
      loopNodeId: loopNode.id,
      breakExits,
      breakHandleCenterYs,
      entryCenterY,
      isNested: nestedInParentBody,
    },
    style: {
      width,
      height,
      zIndex: nestedInParentBody ? 0 : -1,
      maxWidth: width,
      maxHeight: height,
    },
    draggable: false,
    selectable: false,
    focusable: false,
  }

  const updatedNodes = withoutGroup.map((node) => {
    if (adjustedLoopNode && node.id === adjustedLoopNode.id) {
      node = adjustedLoopNode
    }

    const stepIndex = layoutOrder.indexOf(node.id)
    if (stepIndex === -1) {
      if (node.parentId === groupId) {
        return {
          ...node,
          parentId: undefined,
          extent: undefined,
          expandParent: undefined,
        }
      }
      return node
    }

    const restStyle = { ...((node.style ?? {}) as Record<string, unknown>) }
    delete restStyle.width
    delete restStyle.height

    return {
      ...node,
      parentId: groupId,
      extent: 'parent' as const,
      expandParent: false,
      origin: WORKFLOW_NODE_ORIGIN,
      position: positions.get(node.id) ?? { x: 0, y: height / 2 },
      width: undefined,
      height: undefined,
      style: Object.keys(restStyle).length > 0 ? restStyle : undefined,
      draggable: false,
    }
  })

  return sortNodesParentFirst([...updatedNodes, groupNode])
}

export function syncAllLoopBodyGroups(nodes: Node[], edges: Edge[] = []): Node[] {
  let result = nodes.filter((node) => !isLoopBodyGroupNode(node))

  result = result.map((node) => {
    const data = node.data as WorkflowNodeData
    if (!isLoopNodeType(data.nodeType ?? '')) return node

    return {
      ...node,
      data: {
        ...data,
        config: migrateLoopNodeConfig(data.config as Record<string, unknown> | undefined),
      },
    }
  })

  result = result.map((node) =>
    node.parentId?.endsWith('-loop-body')
      ? {
          ...node,
          parentId: undefined,
          extent: undefined,
          expandParent: undefined,
        }
      : node,
  )

  const loopNodes = result.filter((node) => {
    const data = node.data as WorkflowNodeData
    return isLoopNodeType(data.nodeType ?? '')
  })

  const sortedLoopNodes = [...loopNodes].sort(
    (left, right) => getLoopNestingDepth(left.id, result) - getLoopNestingDepth(right.id, result),
  )

  for (const loopNode of sortedLoopNodes) {
    // Parent loop layout can change a nested loop's parentId and relative position.
    // Always use the latest node from `result`, not the stale object captured before layout.
    const latestLoopNode = result.find((node) => node.id === loopNode.id) ?? loopNode
    const data = latestLoopNode.data as WorkflowNodeData
    const bodyIds = readLoopBodyNodeIds(data.config)
    result = layoutLoopBodyNodes(latestLoopNode, bodyIds, result, edges)
  }

  return repositionNestedLoopBodyGroups(result, edges)
}

/** Keep nested inner loop body boxes aligned after parent loop members move. */
function repositionNestedLoopBodyGroups(nodes: Node[], edges: Edge[] = []): Node[] {
  const loopNodeAdjustments = new Map<string, Node>()

  const nextNodes = nodes.map((node) => {
    if (!isLoopBodyGroupNode(node)) return node

    const loopNodeId = (node.data as { loopNodeId?: string })?.loopNodeId
    if (typeof loopNodeId !== 'string') return node

    const loopNode = nodes.find((candidate) => candidate.id === loopNodeId)
    if (!loopNode || !isNestedLoopInParentBody(loopNode)) return node

    const groupHeight = Number(node.style?.height ?? LOOP_BODY_GROUP.minHeight)
    const groupWidth = Number(node.style?.width ?? LOOP_BODY_GROUP.minWidth)
    const loopData = loopNode.data as WorkflowNodeData
    const bodyIds = readLoopBodyNodeIds(loopData.config)
    const breakExits = readLoopBreakExits(loopData.config)
    const { entryCenterY, breakHandleCenterYs } = computeLoopBodyLayoutMetrics(
      bodyIds,
      nodes,
      edges,
      breakExits.length,
      loopNode.id,
    )
    const { groupPosition, adjustedLoopNode } = resolveLoopBodyGroupLayout(
      loopNode,
      groupHeight,
      entryCenterY,
      nodes,
    )

    if (adjustedLoopNode) {
      loopNodeAdjustments.set(adjustedLoopNode.id, adjustedLoopNode)
    }

    return {
      ...node,
      position: groupPosition,
      parentId: loopNode.parentId,
      extent: 'parent' as const,
      width: groupWidth,
      height: groupHeight,
      data: {
        ...(node.data ?? {}),
        loopNodeId: loopNode.id,
        breakExits,
        breakHandleCenterYs,
        entryCenterY,
        isNested: true,
      },
      style: {
        ...(node.style ?? {}),
        width: groupWidth,
        height: groupHeight,
        zIndex: 0,
      },
    }
  })

  if (loopNodeAdjustments.size === 0) return nextNodes

  return nextNodes.map((node) => loopNodeAdjustments.get(node.id) ?? node)
}

/** Recompute loop body size/position after graph edits (nodes, edges, or break handles). */
export function syncLoopBodyGraphLayout(
  nodes: Node[],
  edges: Edge[],
): { nodes: Node[]; edges: Edge[] } {
  const nodeIds = new Set(nodes.map((node) => node.id))

  let nextNodes = nodes.map((node) => {
    const data = node.data as WorkflowNodeData
    if (!isLoopNodeType(data.nodeType ?? '')) return node

    const validIds = normalizeLoopBodyNodeIds(readLoopBodyNodeIds(data.config), nodeIds)
    const hasIfElse = loopBodyHasIfElseNode(node.id, validIds, nodes)

    const nextConfig = {
      ...migrateLoopNodeConfig(data.config as Record<string, unknown> | undefined),
      bodyNodeIds: validIds,
      ...(hasIfElse ? {} : { breakExits: [] as IfElseBranch[] }),
    }

    return {
      ...node,
      data: {
        ...data,
        config: nextConfig,
      },
    }
  })

  let nextEdges = edges
  for (const node of nextNodes) {
    const data = node.data as WorkflowNodeData
    if (!isLoopNodeType(data.nodeType ?? '')) continue

    const groupId = getLoopBodyGroupId(node.id)
    const breakExits = readLoopBreakExits(data.config)
    nextEdges = pruneEdgesForRemovedBranches(nextEdges, groupId, breakExits)
  }

  nextEdges = syncAllLoopBodyEdges(nextNodes, nextEdges)
  nextNodes = syncAllLoopBodyGroups(nextNodes, nextEdges)

  return { nodes: nextNodes, edges: nextEdges }
}

/** Stable fingerprint to skip redundant loop-body relayout effect passes. */
export function getLoopBodyLayoutDigest(nodes: Node[], edges: Edge[]): string {
  const parts: string[] = [`edges:${edges.length}`]

  for (const edge of edges) {
    parts.push(`${edge.source}>${edge.target}:${edge.sourceHandle ?? ''}:${edge.targetHandle ?? ''}`)
  }

  for (const node of nodes) {
    if (node.type === LOOP_BODY_GROUP_NODE_TYPE) {
      const breakYs = (node.data as { breakHandleCenterYs?: Record<string, number> })
        ?.breakHandleCenterYs
      parts.push(
        `group:${node.id}:${String(node.style?.width ?? '')}x${String(node.style?.height ?? '')}:breakYs=${breakYs ? Object.values(breakYs).join(',') : ''}`,
      )
      continue
    }

    const data = node.data as WorkflowNodeData
    if (!isLoopNodeType(data.nodeType ?? '')) continue

    const bodyIds = readLoopBodyNodeIds(data.config)
    const breaks = readLoopBreakExits(data.config)
    parts.push(
      `loop:${node.id}:${bodyIds.join(',')}:breaks=${breaks.map((b) => b.id).join(',')}:parent=${node.parentId ?? ''}:size=${String(node.style?.width ?? node.width ?? '')}x${String(node.style?.height ?? node.height ?? '')}`,
    )
  }

  return parts.join('|')
}

function migrateLoopGroupSourceEdges(nodes: Node[], edges: Edge[]): Edge[] {
  return edges.map((edge) => {
    if (!edge.sourceHandle) return edge

    const sourceNode = nodes.find((node) => node.id === edge.source)
    if (!sourceNode) return edge

    const data = sourceNode.data as WorkflowNodeData
    if (!isLoopNodeType(data.nodeType ?? '')) return edge

    const loopNodeId = sourceNode.id
    const breakIds = new Set(readLoopBreakExits(data.config).map((branch) => branch.id))
    const isDone = edge.sourceHandle === LOOP_DONE_BRANCH_ID
    const isBreak = breakIds.has(edge.sourceHandle)

    if (!isDone && !isBreak) return edge

    const bodyIds = readLoopBodyNodeIds(data.config)
    if (bodyIds.length === 0) return edge

    return {
      ...edge,
      source: getLoopBodyGroupId(loopNodeId),
    }
  })
}

export function syncAllLoopBodyEdges(nodes: Node[], edges: Edge[]): Edge[] {
  let next = migrateLoopGroupSourceEdges(nodes, edges)

  for (const loopNode of nodes) {
    const data = loopNode.data as WorkflowNodeData
    if (!isLoopNodeType(data.nodeType ?? '')) continue

    const bodyIds = readLoopBodyNodeIds(data.config)
    next = syncLoopBodyEdges(loopNode.id, bodyIds, nodes, next)
  }

  return next
}

function reconstructLoopBodyBreakTargetEdges(nodes: Node[], edges: Edge[]): Edge[] {
  let next = edges

  for (const loopNode of nodes) {
    const data = loopNode.data as WorkflowNodeData
    if (!isLoopNodeType(data.nodeType ?? '')) continue

    const loopNodeId = loopNode.id
    const groupId = getLoopBodyGroupId(loopNodeId)
    const breakExits = readLoopBreakExits(data.config)
    const bodyIds = readLoopBodyNodeIds(data.config)
    if (breakExits.length === 0 || bodyIds.length === 0) continue

    const ifElseNodes = bodyIds
      .map((id) => nodes.find((node) => node.id === id))
      .filter((node): node is Node => {
        if (!node) return false
        return (node.data as WorkflowNodeData)?.nodeType === 'if-else'
      })

    if (ifElseNodes.length === 0) continue

    for (let index = 0; index < breakExits.length; index += 1) {
      const breakExit = breakExits[index]
      const hasBreakTarget = next.some(
        (edge) =>
          edge.target === groupId &&
          (edge.targetHandle === `${breakExit.id}-target` || edge.targetHandle === breakExit.id),
      )
      if (hasBreakTarget) continue

      const hasGroupBreakOut = next.some(
        (edge) => edge.source === groupId && edge.sourceHandle === breakExit.id,
      )
      if (!hasGroupBreakOut) continue

      const ifElseNode = ifElseNodes[0]
      const branches = getIfElseBranches(ifElseNode.data as WorkflowNodeData)
      const branchIndex = Math.min(index, Math.max(branches.length - 1, 0))
      const branch = branches[branchIndex]
      if (!branch) continue

      if (workflowEdgeExists(next, ifElseNode.id, groupId, branch.id)) continue

      next = connectEdge(
        {
          source: ifElseNode.id,
          target: groupId,
          sourceHandle: branch.id,
          targetHandle: `${breakExit.id}-target`,
        },
        next,
        nodes,
      )
    }
  }

  return next
}

export function relayoutMainFlowCanvasNodes({
  nodes,
  edges = [],
}: {
  nodes: Node[]
  edges?: Edge[]
}): { nodes: Node[]; edges: Edge[] } {
  const ordered = getWorkflowNodeOrder(nodes)
  if (ordered.length === 0) {
    return { nodes, edges }
  }

  return {
    nodes: mergeMainFlowRelayout(nodes, relayoutOrderedNodes(ordered, nodes)),
    edges,
  }
}

export function applyLoopNodeConfigUpdate(
  nodeId: string,
  config: Record<string, unknown>,
  nodes: Node[],
  edges: Edge[],
): { nodes: Node[]; edges: Edge[] } {
  let migratedConfig = migrateLoopNodeConfig(config)
  
  const bodyIds = readLoopBodyNodeIds(migratedConfig)
  const hasIfElse = loopBodyHasIfElseNode(nodeId, bodyIds, nodes)

  if (!hasIfElse && Array.isArray(migratedConfig.breakExits)) {
    migratedConfig = {
      ...migratedConfig,
      breakExits: [],
    }
  }

  const updatedNodes = nodes.map((node) =>
    node.id === nodeId
      ? {
          ...node,
          data: {
            ...(node.data as WorkflowNodeData),
            config: migratedConfig,
          },
        }
      : node,
  )

  const syncedNodes = syncAllLoopBodyGroups(updatedNodes, edges)
  const groupId = getLoopBodyGroupId(nodeId)
  const breakExits = readLoopBreakExits(migratedConfig)

  let nextEdges = pruneEdgesForRemovedBranches(edges, groupId, breakExits)
  nextEdges = syncAllLoopBodyEdges(syncedNodes, nextEdges)

  return { nodes: syncedNodes, edges: nextEdges }
}

export function syncLoopBodyEdges(
  loopNodeId: string,
  bodyNodeIds: string[],
  nodes: Node[],
  edges: Edge[],
): Edge[] {
  const bodySet = new Set(bodyNodeIds)

  let next = edges.filter((edge) => {
    if (edge.source === loopNodeId && edge.sourceHandle === LOOP_BODY_BRANCH_ID) {
      return false
    }

    if (isLoopBackEdge(edge) && (edge.target === loopNodeId || bodySet.has(edge.source))) {
      return false
    }

    return true
  })

  if (bodyNodeIds.length === 0) return next

  const entryIds = findLoopBodyEntryNodeIds(bodyNodeIds, next, loopNodeId)
  const entryTarget = entryIds[0] ?? bodyNodeIds[0]

  if (
    !workflowEdgeExists(next, loopNodeId, entryTarget, LOOP_BODY_BRANCH_ID)
  ) {
    next = connectEdge(
      {
        source: loopNodeId,
        target: entryTarget,
        sourceHandle: LOOP_BODY_BRANCH_ID,
      },
      next,
    )
  }

  const leafIds = findLoopBodyLeafNodeIds(bodyNodeIds, next)
  for (const leafId of leafIds) {
    if (workflowEdgeExists(next, leafId, loopNodeId, LOOP_CONTINUE_SOURCE_HANDLE)) {
      continue
    }

    next = connectEdge(
      {
        source: leafId,
        target: loopNodeId,
        sourceHandle: LOOP_CONTINUE_SOURCE_HANDLE,
      },
      next,
    )
  }

  return next.map((edge) => {
    if (isLoopBackEdge(edge)) {
      return {
        ...edge,
        animated: false,
        deletable: false,
        style: {
          ...WORKFLOW_EDGE_OPTIONS.style,
          ...(edge.style ?? {}),
          strokeDasharray: '6 4',
          opacity: 0.55,
        },
        data: { ...(edge.data ?? {}), loopBack: true, system: true },
      }
    }

    if (edge.source === loopNodeId && edge.sourceHandle === LOOP_BODY_BRANCH_ID) {
      return {
        ...edge,
        deletable: false,
        data: { ...(edge.data ?? {}), system: true },
      }
    }

    return edge
  })
}

export function applyLoopBodyUpdate(
  loopNodeId: string,
  bodyNodeIds: string[],
  nodes: Node[],
  edges: Edge[],
): { nodes: Node[]; edges: Edge[] } {
  const loopNode = nodes.find((node) => node.id === loopNodeId)
  if (!loopNode) return { nodes, edges }

  const validIds = normalizeLoopBodyNodeIds(
    bodyNodeIds,
    new Set(nodes.map((node) => node.id)),
  )

  const hasIfElse = loopBodyHasIfElseNode(loopNodeId, validIds, nodes)

  const nextLoopNode = { ...loopNode }
  if (!hasIfElse) {
    const currentConfig = (nextLoopNode.data as WorkflowNodeData).config ?? {}
    nextLoopNode.data = {
      ...nextLoopNode.data,
      config: {
        ...currentConfig,
        breakExits: [],
      },
    }
  }

  const positionedNodes = layoutLoopBodyNodes(nextLoopNode, validIds, nodes, edges).map((node) => {
    if (node.id !== loopNodeId) return node

    const currentConfig = (node.data as WorkflowNodeData).config ?? {}
    const nextConfig = {
      ...currentConfig,
      bodyNodeIds: validIds,
    }

    if (!hasIfElse && Array.isArray(nextConfig.breakExits)) {
      nextConfig.breakExits = []
    }

    return {
      ...node,
      data: {
        ...node.data,
        config: nextConfig,
      },
    }
  })

  let nextEdges = edges
  if (!hasIfElse) {
    const groupId = getLoopBodyGroupId(loopNodeId)
    nextEdges = pruneEdgesForRemovedBranches(edges, groupId, [])
  }

  return {
    nodes: positionedNodes,
    edges: syncLoopBodyEdges(loopNodeId, validIds, positionedNodes, nextEdges),
  }
}

export function addNodeToLoopBody(
  loopNodeId: string,
  nodeType: TestFlowNodeType,
  nodes: Node[],
  edges: Edge[],
): { nodes: Node[]; edges: Edge[] } | null {
  if (!isLoopBodyWorkNodeType(nodeType)) return null

  const loopNode = nodes.find((node) => node.id === loopNodeId)
  if (!loopNode) return null

  const currentIds = readLoopBodyNodeIds((loopNode.data as WorkflowNodeData).config)
  const newNode = createWorkflowNode(nodeType, loopNode.position)
  const nextEdges = connectNewLoopBodyMember(currentIds, newNode.id, nodes, edges)

  return applyLoopBodyUpdate(
    loopNodeId,
    [...currentIds, newNode.id],
    [...nodes, newNode],
    nextEdges,
  )
}

export function removeNodeFromLoopBody(
  loopNodeId: string,
  bodyNodeId: string,
  nodes: Node[],
  edges: Edge[],
): { nodes: Node[]; edges: Edge[] } {
  const loopNode = nodes.find((node) => node.id === loopNodeId)
  if (!loopNode) return { nodes, edges }

  const currentIds = readLoopBodyNodeIds((loopNode.data as WorkflowNodeData).config)
  const nextIds = currentIds.filter((id) => id !== bodyNodeId)
  const prunedEdges = edges.filter(
    (edge) => edge.source !== bodyNodeId && edge.target !== bodyNodeId,
  )
  const nextNodes = nodes.filter((node) => node.id !== bodyNodeId)

  return applyLoopBodyUpdate(loopNodeId, nextIds, nextNodes, prunedEdges)
}

function getWorkflowNodeType(node: Node): TestFlowNodeType | undefined {
  const nodeType = (node.data as WorkflowNodeData)?.nodeType
  return nodeType && isTestFlowNodeType(nodeType) ? nodeType : undefined
}

function isProtectedWorkflowNode(node: Node): 'group' | null {
  if (isLoopBodyGroupNode(node)) return 'group'
  return null
}

/** Collects a node id and all nested loop body members when deleting a loop. */
export function collectCascadeDeletionIds(nodeId: string, nodes: Node[]): string[] {
  const node = nodes.find((candidate) => candidate.id === nodeId)
  if (!node) return []

  const ids = new Set<string>([nodeId])
  const nodeType = getWorkflowNodeType(node) ?? 'script'

  if (!isLoopNodeType(nodeType)) return [nodeId]

  for (const bodyId of readLoopBodyNodeIds((node.data as WorkflowNodeData).config)) {
    for (const cascadeId of collectCascadeDeletionIds(bodyId, nodes)) {
      ids.add(cascadeId)
    }
  }

  return [...ids]
}

export function deleteWorkflowNodes(
  requestedIds: string[],
  nodes: Node[],
  edges: Edge[],
): DeleteWorkflowNodesResult {
  const blocked = { loopBodyGroup: false }
  const uniqueRequested = [...new Set(requestedIds)]

  const allowedIds = uniqueRequested.filter((id) => {
    const node = nodes.find((candidate) => candidate.id === id)
    if (!node) return false

    if (isProtectedWorkflowNode(node) === 'group') {
      blocked.loopBodyGroup = true
      return false
    }

    return true
  })

  if (allowedIds.length === 0) {
    return { nodes, edges, deletedNodeIds: [], blocked }
  }

  const directDeleteSet = new Set(allowedIds)
  const cascadeDeleteSet = new Set<string>()
  for (const id of allowedIds) {
    for (const cascadeId of collectCascadeDeletionIds(id, nodes)) {
      cascadeDeleteSet.add(cascadeId)
    }
  }

  let nextNodes = nodes
  let nextEdges = edges
  const deletedNodeIds: string[] = []

  for (const id of allowedIds) {
    const owningLoop = findLoopNodeForBodyMember(id, nodes)
    if (
      owningLoop &&
      !directDeleteSet.has(owningLoop.id) &&
      isNodeInLoopBody(id, owningLoop, nodes)
    ) {
      const result = removeNodeFromLoopBody(owningLoop.id, id, nextNodes, nextEdges)
      nextNodes = result.nodes
      nextEdges = result.edges
      deletedNodeIds.push(id)
    }
  }

  const hardDeleteIds = [...cascadeDeleteSet].filter((id) => !deletedNodeIds.includes(id))
  if (hardDeleteIds.length > 0) {
    const hardDeleteSet = new Set(hardDeleteIds)
    nextNodes = nextNodes.filter((node) => !hardDeleteSet.has(node.id))
    nextEdges = nextEdges.filter(
      (edge) => !hardDeleteSet.has(edge.source) && !hardDeleteSet.has(edge.target),
    )
    deletedNodeIds.push(...hardDeleteIds)
  }

  return {
    nodes: nextNodes,
    edges: nextEdges,
    deletedNodeIds: [...new Set(deletedNodeIds)],
    blocked,
  }
}

export function reorderLoopBodyNodeIds(
  bodyNodeIds: string[],
  fromIndex: number,
  toIndex: number,
): string[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= bodyNodeIds.length ||
    toIndex >= bodyNodeIds.length
  ) {
    return bodyNodeIds
  }

  const next = [...bodyNodeIds]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return next
}

export function reorderLoopBody(
  loopNodeId: string,
  fromIndex: number,
  toIndex: number,
  nodes: Node[],
  edges: Edge[],
): { nodes: Node[]; edges: Edge[] } {
  const loopNode = nodes.find((node) => node.id === loopNodeId)
  if (!loopNode) return { nodes, edges }

  const currentIds = readLoopBodyNodeIds((loopNode.data as WorkflowNodeData).config)
  const nextIds = reorderLoopBodyNodeIds(currentIds, fromIndex, toIndex)

  return applyLoopBodyUpdate(loopNodeId, nextIds, nodes, edges)
}

export function appendTargetToLoopBodyOnConnect(
  connection: Connection,
  nodes: Node[],
  edges: Edge[],
): { nodes: Node[]; edges: Edge[] } {
  if (!connection.source || !connection.target || connection.sourceHandle !== LOOP_BODY_BRANCH_ID) {
    return { nodes, edges }
  }

  const sourceNode = nodes.find((node) => node.id === connection.source)
  if (!sourceNode || !isLoopNodeType((sourceNode.data as WorkflowNodeData).nodeType ?? '')) {
    return { nodes, edges }
  }

  const targetNode = nodes.find((node) => node.id === connection.target)
  const targetType = (targetNode?.data as WorkflowNodeData | undefined)?.nodeType ?? 'script'
  if (!targetNode || !isLoopBodyWorkNodeType(targetType)) {
    return { nodes, edges }
  }

  const currentIds = readLoopBodyNodeIds((sourceNode.data as WorkflowNodeData).config)
  if (currentIds.includes(connection.target)) {
    return applyLoopBodyUpdate(connection.source, currentIds, nodes, edges)
  }

  return applyLoopBodyUpdate(connection.source, [...currentIds, connection.target], nodes, edges)
}
