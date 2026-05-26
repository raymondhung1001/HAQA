import type { Connection, Edge, Node } from '@xyflow/react'
import type { ScriptLanguage } from '@/types/workflow'
import { addEdge, Position } from '@xyflow/react'
import {
  IF_ELSE_NODE_LAYOUT,
  LOOP_BODY_GROUP,
  WORKFLOW_CONNECTION_GAP,
  getLoopBodyBreakHandleCenterY,
  getLoopBodyDoneHandleCenterY,
} from '@/components/test-flow/workflow-node-layout'
import {
  getWorkflowNodeLabel,
  getWorkflowNodeTypeOrdinals,
  isLoopBodyWorkNodeType,
  isTestFlowNodeType,
  resolveWorkflowNodeDisplayLabel,
} from '@/components/test-flow/workflow-node-definitions'

const WORKFLOW_NODE_TYPE = 'workflow' as const

export type TestFlowNodeType =
  | 'start'
  | 'end'
  | 'script'
  | 'api-call'
  | 'if-else'
  | 'for-loop'
  | 'do-while'
  | 'wait'

export interface WorkflowNodeData {
  nodeType: TestFlowNodeType
  label: string
  description?: string
  scriptLanguage?: ScriptLanguage
  scriptContent?: string
  scriptDependencies?: Record<string, unknown>
  config?: Record<string, unknown>
  loopBodySteps?: LoopBodyStep[]
  onEdit?: () => void
  onSwapLeft?: () => void
  onSwapRight?: () => void
  canSwapLeft?: boolean
  canSwapRight?: boolean
  /** Canvas display name; computed when duplicate types need disambiguation. */
  displayLabel?: string
}

export interface TestFlowGraphNode {
  id: string
  nodeType: TestFlowNodeType
  label?: string
  scriptLanguage?: ScriptLanguage
  scriptContent?: string
  scriptDependencies?: Record<string, unknown>
  config?: Record<string, unknown>
  positionX?: number
  positionY?: number
}

const HORIZONTAL_NODE_GAP = WORKFLOW_CONNECTION_GAP
const VERTICAL_BRANCH_OFFSET = 120
export const LOOP_BODY_GROUP_NODE_TYPE = 'loop-body-group' as const
const FLOW_BOARD_Y = 200
const FLOW_BOARD_START_X = 40
const POSITION_TOLERANCE = 10
/** Vertical center anchor — position.y aligns handle line without custom handle offsets. */
export const WORKFLOW_NODE_ORIGIN: [number, number] = [0, 0.5]

/** Loop body container uses top-left anchoring; layout math is from the box top edge. */
export const LOOP_BODY_GROUP_ORIGIN: [number, number] = [0, 0]

/** Shared React Flow edge styling for workflow connections. */
export const WORKFLOW_EDGE_OPTIONS = {
  type: 'smoothstep' as const,
  animated: true,
  pathOptions: {
    borderRadius: 10,
    offset: 10,
  },
  style: {
    strokeWidth: 2,
  },
} as const

export { WORKFLOW_CONNECTION_GAP } from '@/components/test-flow/workflow-node-layout'

function getWorkflowNodeLayoutWidth(node: Node): number {
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
function getCanvasNodeLayoutSpan(node: Node, nodes: Node[]): number {
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

function isLoopBodyBreakTargetEdge(edge: Edge): boolean {
  return (
    typeof edge.target === 'string' &&
    edge.target.endsWith('-loop-body') &&
    typeof edge.targetHandle === 'string' &&
    edge.targetHandle.endsWith('-target')
  )
}

function isLoopToBodyEntryEdge(edge: Edge): boolean {
  return (
    edge.sourceHandle === LOOP_BODY_BRANCH_ID &&
    typeof edge.target === 'string' &&
    !edge.target.endsWith('-loop-body')
  )
}

/** Map drops on the visible break source dot to the target handle id. */
export function normalizeLoopBodyBreakTargetConnection(
  connection: Connection,
  nodes: Node[],
): Connection {
  if (!connection.target || !connection.targetHandle) return connection

  const targetNode = nodes.find((node) => node.id === connection.target)
  if (!targetNode || !isLoopBodyGroupNode(targetNode)) return connection

  const breakExits = Array.isArray(targetNode.data?.breakExits)
    ? (targetNode.data.breakExits as IfElseBranch[])
    : []

  if (connection.targetHandle.endsWith('-target')) return connection

  const branch = breakExits.find((exit) => exit.id === connection.targetHandle)
  if (!branch) return connection

  return { ...connection, targetHandle: `${branch.id}-target` }
}

export function withWorkflowEdgeDefaults(edge: Edge): Edge {
  const isBreakTarget = isLoopBodyBreakTargetEdge(edge)
  const isLoopToBodyEntry = isLoopToBodyEntryEdge(edge)
  const isLoopBack =
    edge.sourceHandle === LOOP_CONTINUE_SOURCE_HANDLE || edge.data?.loopBack === true

  return {
    ...edge,
    ...WORKFLOW_EDGE_OPTIONS,
    ...(isBreakTarget
      ? { targetPosition: Position.Left, sourcePosition: Position.Right }
      : {}),
    ...(isLoopToBodyEntry
      ? { targetPosition: Position.Left, sourcePosition: Position.Right }
      : {}),
    ...(isLoopBack
      ? { targetPosition: Position.Left, sourcePosition: Position.Right, zIndex: -1 }
      : {}),
    pathOptions: {
      ...WORKFLOW_EDGE_OPTIONS.pathOptions,
      ...(edge.pathOptions ?? {}),
      ...(isLoopToBodyEntry ? { borderRadius: 0 } : {}),
      ...(isLoopBack ? { borderRadius: 10 } : {}),
    },
    style: {
      ...WORKFLOW_EDGE_OPTIONS.style,
      ...(edge.style ?? {}),
      ...(isLoopBack ? { strokeDasharray: '6 4', opacity: 0.45 } : {}),
    },
  }
}


export interface IfElseBranch {
  id: string
  label: string
}

export const IF_ELSE_ELSE_BRANCH_ID = 'false'

export const DEFAULT_IF_ELSE_BRANCHES: IfElseBranch[] = [
  { id: 'true', label: 'Yes' },
  { id: IF_ELSE_ELSE_BRANCH_ID, label: 'Else' },
]

const MIN_IF_ELSE_BRANCHES = 2
const IF_ELSE_ELSE_BRANCH_LABEL = 'Else'
const BRANCH_HANDLE_COLORS = [
  '!border-green-500',
  '!border-red-500',
  '!border-blue-500',
  '!border-violet-500',
  '!border-orange-500',
  '!border-cyan-500',
]

function isIfElseBranch(value: unknown): value is IfElseBranch {
  if (!value || typeof value !== 'object') return false
  const branch = value as IfElseBranch
  return typeof branch.id === 'string' && branch.id.length > 0 && typeof branch.label === 'string'
}

export function readIfElseBranches(config?: Record<string, unknown> | null): IfElseBranch[] {
  const raw = config?.branches
  if (!Array.isArray(raw)) return [...DEFAULT_IF_ELSE_BRANCHES]

  const branches = raw.filter(isIfElseBranch).map((branch) => ({
    id: branch.id,
    label: branch.label.trim() || branch.id,
  }))

  if (branches.length < MIN_IF_ELSE_BRANCHES) return [...DEFAULT_IF_ELSE_BRANCHES]

  return normalizeIfElseBranches(branches)
}

export function isElseBranchIndex(index: number, count: number): boolean {
  return count > 0 && index === count - 1
}

export function normalizeIfElseBranches(branches: IfElseBranch[]): IfElseBranch[] {
  if (branches.length < MIN_IF_ELSE_BRANCHES) return [...DEFAULT_IF_ELSE_BRANCHES]

  const normalized = branches.map((branch) => ({ ...branch }))
  const lastIndex = normalized.length - 1

  for (let index = 0; index < lastIndex; index += 1) {
    if (normalized[index].id === IF_ELSE_ELSE_BRANCH_ID) {
      normalized[index] = { ...normalized[index], id: createNodeId() }
    }
  }

  normalized[lastIndex] = {
    id: IF_ELSE_ELSE_BRANCH_ID,
    label: IF_ELSE_ELSE_BRANCH_LABEL,
  }

  return normalized
}

export function addIfElseBranch(branches: IfElseBranch[], label?: string): IfElseBranch[] {
  const normalized = normalizeIfElseBranches(branches)
  const elseBranch = normalized[normalized.length - 1]
  const newBranch = createIfElseBranch(label ?? `Branch ${normalized.length}`)

  return normalizeIfElseBranches([
    ...normalized.slice(0, normalized.length - 1),
    newBranch,
    elseBranch,
  ])
}

export function removeIfElseBranch(branches: IfElseBranch[], branchId: string): IfElseBranch[] {
  const normalized = normalizeIfElseBranches(branches)
  if (normalized.length <= MIN_IF_ELSE_BRANCHES) return normalized

  const branchIndex = normalized.findIndex((branch) => branch.id === branchId)
  if (branchIndex === -1 || isElseBranchIndex(branchIndex, normalized.length)) {
    return normalized
  }

  return normalizeIfElseBranches(normalized.filter((branch) => branch.id !== branchId))
}

export function getIfElseBranches(data: WorkflowNodeData): IfElseBranch[] {
  return readIfElseBranches(data.config)
}

export const LOOP_BODY_BRANCH_ID = 'loop'
export const LOOP_DONE_BRANCH_ID = 'done'
/** Auto-synced back-edge from last body step to loop node (next iteration). */
export const LOOP_CONTINUE_SOURCE_HANDLE = 'continue'

export const DEFAULT_LOOP_BRANCHES: IfElseBranch[] = [
  { id: LOOP_BODY_BRANCH_ID, label: 'Loop' },
  { id: LOOP_DONE_BRANCH_ID, label: 'Done' },
]

const MIN_LOOP_BRANCHES = 2
const LOOP_BODY_BRANCH_LABEL = 'Loop'
const LOOP_DONE_BRANCH_LABEL = 'Done'
const LOOP_CONFIG_VERSION = 2

export function readLoopBreakExits(config?: Record<string, unknown> | null): IfElseBranch[] {
  const raw = config?.breakExits
  if (Array.isArray(raw)) {
    return raw
      .filter(isIfElseBranch)
      .map((branch) => ({ id: branch.id, label: branch.label.trim() || branch.id }))
  }

  return extractLegacyLoopBreakExits(config)
}

function extractLegacyLoopBreakExits(config?: Record<string, unknown> | null): IfElseBranch[] {
  const raw = config?.branches
  if (!Array.isArray(raw)) return []

  const branches = raw.filter(isIfElseBranch)
  if (branches.length <= MIN_LOOP_BRANCHES) return []

  return branches.slice(1, -1).map((branch) => ({
    id: branch.id,
    label: branch.label.trim() || branch.id,
  }))
}

export function normalizeLoopBreakExits(breakExits: IfElseBranch[]): IfElseBranch[] {
  return breakExits.map((branch) => ({
    id: branch.id,
    label: branch.label.trim() || branch.id,
  }))
}

export function addLoopBreakExit(breakExits: IfElseBranch[], label?: string): IfElseBranch[] {
  const count = breakExits.length
  return normalizeLoopBreakExits([
    ...breakExits,
    createIfElseBranch(label ?? `Break ${count + 1}`),
  ])
}

export function removeLoopBreakExit(breakExits: IfElseBranch[], branchId: string): IfElseBranch[] {
  return normalizeLoopBreakExits(breakExits.filter((branch) => branch.id !== branchId))
}

/** @deprecated Use addLoopBreakExit on breakExits */
export function addLoopBreakCondition(_branches: IfElseBranch[], label?: string): IfElseBranch[] {
  return addLoopBreakExit([], label)
}

export function isLoopNodeType(nodeType: string): nodeType is 'for-loop' | 'do-while' {
  return nodeType === 'for-loop' || nodeType === 'do-while'
}

export function isBranchingNodeType(nodeType: string): boolean {
  return nodeType === 'if-else' || isLoopNodeType(nodeType)
}

export function readLoopBranches(_config?: Record<string, unknown> | null): IfElseBranch[] {
  return [...DEFAULT_LOOP_BRANCHES]
}

export function isLoopBodyBranchIndex(index: number): boolean {
  return index === 0
}

export function isLoopDoneBranchIndex(index: number, count: number): boolean {
  return count > 0 && index === count - 1
}

export function normalizeLoopBranches(_branches: IfElseBranch[]): IfElseBranch[] {
  return [...DEFAULT_LOOP_BRANCHES]
}

/** @deprecated Use removeLoopBreakExit on breakExits */
export function removeLoopBreakCondition(breakExits: IfElseBranch[], branchId: string): IfElseBranch[] {
  return removeLoopBreakExit(breakExits, branchId)
}

export function migrateLoopNodeConfig(
  config?: Record<string, unknown> | null,
): Record<string, unknown> {
  const next = { ...(config ?? {}) }
  const legacyBreaks = extractLegacyLoopBreakExits(next)
  const existingBreaks = Array.isArray(next.breakExits)
    ? (next.breakExits as IfElseBranch[]).filter(isIfElseBranch)
    : []

  next.breakExits = normalizeLoopBreakExits(
    existingBreaks.length > 0 ? existingBreaks : legacyBreaks,
  )
  next.branches = [...DEFAULT_LOOP_BRANCHES]
  next.loopConfigVersion = LOOP_CONFIG_VERSION
  return next
}

export function getLoopBranches(data: WorkflowNodeData): IfElseBranch[] {
  return readLoopBranches(data.config)
}

export function getNodeOutputBranches(data: WorkflowNodeData): IfElseBranch[] {
  const nodeType = data.nodeType ?? 'script'
  if (nodeType === 'if-else') return getIfElseBranches(data)
  if (isLoopNodeType(nodeType)) return getLoopBranches(data)
  return []
}

export interface LoopBodyStep {
  id: string
  label: string
  /** Type label with optional ordinal when duplicates exist (e.g. "Script 1"). */
  displayLabel: string
  nodeType: TestFlowNodeType
  typeOrdinal?: number
}

export function readLoopBodyNodeIds(config?: Record<string, unknown> | null): string[] {
  const raw = config?.bodyNodeIds
  if (!Array.isArray(raw)) return []

  return raw.filter((value): value is string => typeof value === 'string' && value.length > 0)
}

export function normalizeLoopBodyNodeIds(
  bodyNodeIds: string[],
  validNodeIds: Set<string>,
): string[] {
  const seen = new Set<string>()

  return bodyNodeIds.filter((id) => {
    if (!validNodeIds.has(id) || seen.has(id)) return false
    seen.add(id)
    return true
  })
}

function getNodeTypeFromMap(
  nodeMap: Map<string, Node>,
  nodeId: string,
): TestFlowNodeType | undefined {
  const node = nodeMap.get(nodeId)
  if (!node) return undefined
  return (node.data as WorkflowNodeData).nodeType ?? 'script'
}

/** Main-flow workflow nodes in canvas order (left to right), excluding start/end. */
export function collectMainFlowOrderedNodeIds(nodes: Node[]): string[] {
  return nodes
    .filter((node) => {
      if (node.type === LOOP_BODY_GROUP_NODE_TYPE) return false
      if (node.parentId?.endsWith('-loop-body')) return false

      const data = node.data as WorkflowNodeData
      const nodeType = data.nodeType ?? 'script'
      if (nodeType === 'start' || nodeType === 'end') return false

      return node.type === WORKFLOW_NODE_TYPE
    })
    .sort(
      (left, right) =>
        left.position.x - right.position.x || left.position.y - right.position.y,
    )
    .map((node) => node.id)
}

export function buildWorkflowNodeDisplayLabels(nodes: Node[]): Map<string, string> {
  const labels = new Map<string, string>()
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  const getNodeType = (nodeId: string) => getNodeTypeFromMap(nodeMap, nodeId)

  const applyForOrderedIds = (orderedIds: string[]) => {
    const ordinals = getWorkflowNodeTypeOrdinals(orderedIds, getNodeType)
    for (const id of orderedIds) {
      const node = nodeMap.get(id)
      if (!node) continue
      const data = node.data as WorkflowNodeData
      const nodeType = data.nodeType ?? 'script'
      labels.set(
        id,
        resolveWorkflowNodeDisplayLabel(nodeType, data.label, ordinals.get(id)),
      )
    }
  }

  for (const node of nodes) {
    const data = node.data as WorkflowNodeData
    if (!isLoopNodeType(data.nodeType ?? '')) continue
    applyForOrderedIds(readLoopBodyNodeIds(data.config))
  }

  applyForOrderedIds(collectMainFlowOrderedNodeIds(nodes))

  return labels
}

export function resolveLoopBodySteps(
  bodyNodeIds: string[] | undefined | null,
  nodes: Node[] | undefined | null,
): LoopBodyStep[] {
  const ids = Array.isArray(bodyNodeIds) ? bodyNodeIds : []
  const nodeList = Array.isArray(nodes) ? nodes : []
  const nodeMap = new Map(nodeList.map((node) => [node.id, node]))
  const ordinals = getWorkflowNodeTypeOrdinals(ids, (nodeId) => getNodeTypeFromMap(nodeMap, nodeId))

  return ids
    .map((id) => nodeMap.get(id))
    .filter((node): node is Node => Boolean(node))
    .map((node) => {
      const data = node.data as WorkflowNodeData
      const nodeType = data.nodeType ?? 'script'
      const typeOrdinal = ordinals.get(node.id)
      const label = data.label?.trim() || getWorkflowNodeLabel(nodeType)
      const displayLabel = resolveWorkflowNodeDisplayLabel(nodeType, data.label, typeOrdinal)

      return {
        id: node.id,
        label,
        displayLabel,
        nodeType,
        typeOrdinal,
      }
    })
}

export function getLoopBranchRowCount(hasLoopBody: boolean): number {
  return hasLoopBody ? 1 : 2
}

export function getLoopNodeHeight(showFooter: boolean, branchRowCount = 2): number {
  const { paddingY, headerHeight, branchRowHeight, footerHeight } = IF_ELSE_NODE_LAYOUT

  return (
    paddingY * 2 +
    headerHeight +
    branchRowHeight * branchRowCount +
    (showFooter ? footerHeight : 0)
  )
}

export function getLoopBranchHandleTopPercent(
  rowIndex: number,
  showFooter: boolean,
  branchRowCount = 2,
): string {
  const nodeHeight = getLoopNodeHeight(showFooter, branchRowCount)
  const { paddingY, headerHeight, branchRowHeight } = IF_ELSE_NODE_LAYOUT

  const centerY =
    paddingY +
    headerHeight +
    rowIndex * branchRowHeight +
    branchRowHeight / 2

  return `${(centerY / nodeHeight) * 100}%`
}

export function getLoopBodyGroupId(loopNodeId: string): string {
  return `${loopNodeId}-loop-body`
}

export function isLoopBodyGroupNode(node: Node): boolean {
  return node.type === LOOP_BODY_GROUP_NODE_TYPE
}

function isNodeInAnyLoopBody(nodeId: string, nodes: Node[]): boolean {
  return nodes.some((node) => {
    const data = node.data as WorkflowNodeData
    if (!isLoopNodeType(data.nodeType ?? '')) return false
    return readLoopBodyNodeIds(data.config).includes(nodeId)
  })
}

/** Parent loop that lists `loopNodeId` in its body (for nested loop exit wiring). */
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

function computeLoopBodyLayoutMetrics(
  bodyNodeIds: string[],
  nodes: Node[],
  edges: Edge[],
  breakCount: number,
  loopNodeId: string,
): {
  width: number
  height: number
  positions: Map<string, { x: number; y: number }>
  entryCenterY: number
} {
  const { padding, labelHeight, minWidth, minHeight, nodeWidth, bodyNodeHeight } = LOOP_BODY_GROUP

  if (bodyNodeIds.length === 0) {
    return {
      width: minWidth,
      height: minHeight,
      positions: new Map(),
      entryCenterY: minHeight / 2,
    }
  }

  const depths = computeLoopBodyDepths(bodyNodeIds, edges)
  const yById = computeLoopBodyMemberY(bodyNodeIds, edges, nodes, depths)
  stackLoopBodyBranchTargetY(bodyNodeIds, edges, nodes, yById)
  const columnsById = computeLoopBodyColumns(bodyNodeIds, edges, nodes)
  const maxColumn = Math.max(0, ...bodyNodeIds.map((id) => columnsById.get(id) ?? 0))

  const widthById = new Map<string, number>()
  const widthByColumn = new Map<number, number>()
  for (const id of bodyNodeIds) {
    const node = nodes.find((member) => member.id === id)
    const memberWidth = node
      ? getLoopBodyMemberVisualWidth(node, nodes, edges)
      : nodeWidth
    widthById.set(id, memberWidth)
    const column = columnsById.get(id) ?? 0
    widthByColumn.set(column, Math.max(widthByColumn.get(column) ?? 0, memberWidth))
  }

  let contentSpan = 0
  for (let column = 0; column <= maxColumn; column += 1) {
    const columnWidth = widthByColumn.get(column) ?? nodeWidth
    if (column > 0) contentSpan += HORIZONTAL_NODE_GAP
    contentSpan += columnWidth
  }

  const railWidth = LOOP_BODY_GROUP.exitRailWidth
  const width = Math.max(minWidth, padding * 2 + contentSpan + railWidth)
  const loopNode = nodes.find((node) => node.id === loopNodeId)
  const leftAlignContent = Boolean(loopNode?.parentId?.endsWith('-loop-body'))
  const startX = leftAlignContent ? padding : (width - contentSpan - railWidth) / 2

  const columnStartX = new Map<number, number>()
  let columnX = startX
  for (let column = 0; column <= maxColumn; column += 1) {
    columnStartX.set(column, columnX)
    columnX += (widthByColumn.get(column) ?? nodeWidth) + HORIZONTAL_NODE_GAP
  }

  const positions = new Map<string, { x: number; y: number }>()
  let minEdge = Infinity
  let maxEdge = -Infinity

  for (const id of bodyNodeIds) {
    const node = nodes.find((member) => member.id === id)
    const memberHeight = node
      ? getLoopBodyMemberVisualHeight(node, nodes, edges)
      : bodyNodeHeight
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

  const contentHeight = Math.max(bodyNodeHeight, maxEdge - minEdge)
  const height = Math.max(minHeight, labelHeight + padding + contentHeight + padding)
  const yShift = labelHeight + padding - minEdge

  for (const [id, position] of positions) {
    positions.set(id, { x: position.x, y: position.y + yShift })
  }

  const entryIds = findLoopBodyEntryNodeIds(bodyNodeIds, edges, loopNodeId)
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

  const entryCenterY =
    entryIds.length > 0
      ? Math.min(
          ...entryIds
            .map((id) => positions.get(id)?.y)
            .filter((y): y is number => typeof y === 'number'),
        )
      : labelHeight + padding + bodyNodeHeight / 2

  return { width, height, positions, entryCenterY }
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
    groupPosition: { ...groupPosition, y: groupPosition.y + delta },
    adjustedLoopNode: {
      ...loopNode,
      position: {
        ...loopNode.position,
        y: loopNode.position.y + delta,
      },
    },
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
  const height = Number(groupNode.style?.height ?? LOOP_BODY_GROUP.minHeight)
  const index = breakExits.findIndex((branch) => branch.id === handleId)

  return {
    x: groupNode.position.x + width + HORIZONTAL_NODE_GAP,
    y:
      groupNode.position.y +
      getLoopBodyBreakHandleCenterY(height, Math.max(index, 0), breakExits.length),
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
): boolean {
  if (!isLoopBodyGroupNode(targetNode)) return false

  const loopNodeId = (targetNode.data as { loopNodeId?: string })?.loopNodeId
  if (loopNodeId !== owningLoop.id) return false

  const breakExits = Array.isArray(targetNode.data?.breakExits)
    ? (targetNode.data.breakExits as IfElseBranch[])
    : []

  return breakExits.some(
    (branch) =>
      connection.targetHandle === `${branch.id}-target` ||
      connection.targetHandle === branch.id,
  )
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

  const { width, height, positions, entryCenterY } = computeLoopBodyLayoutMetrics(
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
    data: { loopNodeId: loopNode.id, breakExits },
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
    const breakCount = readLoopBreakExits(loopData.config).length
    const { entryCenterY } = computeLoopBodyLayoutMetrics(
      bodyIds,
      nodes,
      edges,
      breakCount,
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
    const hasIfElse = validIds.some((id) => {
      const member = nodes.find((member) => member.id === id)
      return (member?.data as WorkflowNodeData)?.nodeType === 'if-else'
    })

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
      parts.push(
        `group:${node.id}:${String(node.style?.width ?? '')}x${String(node.style?.height ?? '')}`,
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

export function prepareLoadedFlowGraph(
  nodes: Node[],
  edges: Edge[],
): { nodes: Node[]; edges: Edge[] } {
  const syncedNodes = syncAllLoopBodyGroups(nodes, edges)
  const syncedEdges = syncAllLoopBodyEdges(syncedNodes, edges)

  return relayoutMainFlowCanvasNodes({ nodes: syncedNodes, edges: syncedEdges })
}

/** Re-space main-flow canvas nodes using uniform handle-to-handle gaps. */
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
  const hasIfElse = bodyIds.some((id) => {
    const node = nodes.find((n) => n.id === id)
    return (node?.data as WorkflowNodeData)?.nodeType === 'if-else'
  })

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

function isLoopBackEdge(edge: Edge): boolean {
  return edge.sourceHandle === LOOP_CONTINUE_SOURCE_HANDLE || edge.data?.loopBack === true
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

  return next.map((edge) =>
    isLoopBackEdge(edge)
      ? {
          ...edge,
          animated: false,
          style: {
            ...WORKFLOW_EDGE_OPTIONS.style,
            ...(edge.style ?? {}),
            strokeDasharray: '6 4',
            opacity: 0.55,
          },
          data: { ...(edge.data ?? {}), loopBack: true, system: true },
        }
      : edge,
  )
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

  const hasIfElse = validIds.some((id) => {
    const node = nodes.find((n) => n.id === id)
    return (node?.data as WorkflowNodeData)?.nodeType === 'if-else'
  })

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

export { isLoopBodyWorkNodeType }

export function createIfElseBranch(label?: string): IfElseBranch {
  return {
    id: createNodeId(),
    label: label?.trim() || `Branch`,
  }
}

function getBranchOffsetY(index: number, count: number): number {
  if (count <= 1) return 0
  const step = (VERTICAL_BRANCH_OFFSET * 2) / (count - 1)
  return (index - (count - 1) / 2) * step
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

export interface TestFlowGraphEdge {
  id: string
  sourceNodeId: string
  targetNodeId: string
  sourceHandle?: string
  targetHandle?: string
  label?: string
}

export interface TestFlowGraph {
  uiLayoutJson?: Record<string, unknown> | null
  nodes: TestFlowGraphNode[]
  edges: TestFlowGraphEdge[]
}

export interface TestFlowVersionGraph {
  id: string
  testFlowId: string
  versionNumber: number
  uiLayoutJson: Record<string, unknown> | null
  nodes: TestFlowGraphNode[]
  edges: TestFlowGraphEdge[]
}

export interface TestFlowDetail {
  id: string
  name: string
  description?: string | null
  isActive?: boolean | null
  userId?: number
  createdAt?: string | null
  updatedAt?: string | null
  latestVersion: TestFlowVersionGraph | null
}

export function createNodeId(): string {
  return crypto.randomUUID()
}

export function cloneGraphWithFreshIds(graph: TestFlowGraph): TestFlowGraph {
  const nodeIdMap = new Map<string, string>()

  for (const node of graph.nodes) {
    nodeIdMap.set(node.id, createNodeId())
  }

  return {
    uiLayoutJson: graph.uiLayoutJson ?? null,
    nodes: graph.nodes.map((node) => ({
      ...node,
      id: nodeIdMap.get(node.id) ?? node.id,
    })),
    edges: graph.edges.map((edge) => ({
      ...edge,
      id: createNodeId(),
      sourceNodeId: nodeIdMap.get(edge.sourceNodeId) ?? edge.sourceNodeId,
      targetNodeId: nodeIdMap.get(edge.targetNodeId) ?? edge.targetNodeId,
    })),
  }
}

export function createDefaultNodes(): Node[] {
  const start = createWorkflowNode('start', { x: FLOW_BOARD_START_X, y: FLOW_BOARD_Y })
  const end = createWorkflowNode('end', {
    x: FLOW_BOARD_START_X + getWorkflowNodeLayoutWidth(start) + HORIZONTAL_NODE_GAP,
    y: FLOW_BOARD_Y,
  })

  return [start, end]
}

export function createDefaultEdges(nodes: Node[]): Edge[] {
  const startNode = nodes.find((node) => (node.data as WorkflowNodeData)?.nodeType === 'start')
  const endNode = nodes.find((node) => (node.data as WorkflowNodeData)?.nodeType === 'end')

  if (!startNode || !endNode) return []

  return [
    {
      ...WORKFLOW_EDGE_OPTIONS,
      id: createNodeId(),
      source: startNode.id,
      target: endNode.id,
    },
  ]
}

export function createWorkflowNode(
  nodeType: TestFlowNodeType,
  position?: { x: number; y: number },
): Node {
  return {
    id: createNodeId(),
    type: WORKFLOW_NODE_TYPE,
    draggable: false,
    origin: WORKFLOW_NODE_ORIGIN,
    data: {
      label: getWorkflowNodeLabel(nodeType),
      description: '',
      nodeType,
      ...(nodeType === 'if-else'
        ? { config: { branches: [...DEFAULT_IF_ELSE_BRANCHES] } }
        : isLoopNodeType(nodeType)
          ? {
              config: {
                branches: [...DEFAULT_LOOP_BRANCHES],
                breakExits: [],
                loopConfigVersion: LOOP_CONFIG_VERSION,
              },
            }
          : {}),
    },
    position: position ?? { x: FLOW_BOARD_START_X, y: FLOW_BOARD_Y },
  }
}

function isNearPosition(
  node: Node,
  position: { x: number; y: number },
  excludeNodeId?: string,
): boolean {
  if (excludeNodeId && node.id === excludeNodeId) return false

  return (
    Math.abs(node.position.x - position.x) <= POSITION_TOLERANCE &&
    Math.abs(node.position.y - position.y) <= POSITION_TOLERANCE
  )
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
    const position = sharedParent
      ? {
          x: sourceNode.position.x + groupWidth + HORIZONTAL_NODE_GAP,
          y:
            sourceNode.position.y +
            getLoopBodyBreakHandleCenterY(
              groupHeight,
              Math.max(breakIndex, 0),
              breakExits.length,
            ),
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

export function isValidWorkflowConnection(
  connection: Connection,
  nodes: Node[],
): boolean {
  if (!connection.source || !connection.target) return false
  if (connection.source === connection.target) return false

  const sourceNode = nodes.find((node) => node.id === connection.source)
  const targetNode = nodes.find((node) => node.id === connection.target)
  if (!sourceNode || !targetNode) return false

  const sourceType = (sourceNode.data as WorkflowNodeData)?.nodeType ?? ''
  const targetType = (targetNode.data as WorkflowNodeData)?.nodeType ?? ''
  const handle = connection.sourceHandle

  if (isLoopBodyGroupNode(sourceNode)) {
    if (!handle) return false

    const loopNodeId = (sourceNode.data as { loopNodeId?: string })?.loopNodeId
    if (typeof loopNodeId !== 'string' || loopNodeId.length === 0) return false

    if (handle === LOOP_DONE_BRANCH_ID) {
      return isValidLoopGroupExitTarget(loopNodeId, targetNode, nodes)
    }

    const breakExits = Array.isArray(sourceNode.data?.breakExits)
      ? (sourceNode.data.breakExits as IfElseBranch[])
      : []
    if (!breakExits.some((branch) => branch.id === handle)) return false

    const loopNode = nodes.find((n) => n.id === loopNodeId)
    if (!loopNode) return false
    const bodyIds = readLoopBodyNodeIds((loopNode.data as WorkflowNodeData).config)
    const hasIfElse = bodyIds.some((id) => {
      const node = nodes.find((n) => n.id === id)
      return (node?.data as WorkflowNodeData)?.nodeType === 'if-else'
    })
    if (!hasIfElse) return false

    return isValidLoopGroupExitTarget(loopNodeId, targetNode, nodes)
  }

  if (isLoopNodeType(sourceType)) {
    if (handle === LOOP_BODY_BRANCH_ID) {
      return isLoopBodyWorkNodeType(targetType as TestFlowNodeType)
    }
    if (handle === LOOP_DONE_BRANCH_ID) {
      const bodyIds = readLoopBodyNodeIds((sourceNode.data as WorkflowNodeData).config)
      if (bodyIds.length > 0) return false
      return isCanvasLayoutNode(targetNode, nodes)
    }
    return false
  }

  if (isBranchingWorkNodeType(sourceType)) {
    if (!handle) return false
    const branches = getIfElseBranches(sourceNode.data as WorkflowNodeData)
    if (!branches.some((branch) => branch.id === handle)) return false
  }

  const owningLoop = findLoopNodeForBodyMember(sourceNode.id, nodes)
  if (owningLoop) {
    if (isLoopBodyBreakIncomingConnection(connection, targetNode, owningLoop)) {
      return true
    }

    if (
      isNodeInLoopBody(targetNode.id, owningLoop, nodes) &&
      !isLoopBodyGroupNode(targetNode)
    ) {
      return isLoopBodyWorkNodeType(targetType as TestFlowNodeType)
    }

    if (isCanvasLayoutNode(targetNode, nodes)) {
      return true
    }

    return false
  }

  const targetLoop = findLoopNodeForBodyMember(targetNode.id, nodes)
  if (targetLoop && isCanvasLayoutNode(sourceNode, nodes)) {
    return false
  }

  return true
}

/** @deprecated Use repositionNodeForBranchConnection */
export function repositionNodeForIfElseConnection(
  nodes: Node[],
  connection: Connection,
): Node[] {
  return repositionNodeForBranchConnection(nodes, connection)
}

function readNodeDescription(config?: Record<string, unknown> | null): string | undefined {
  const value = config?.description
  return typeof value === 'string' && value.trim() ? value : undefined
}

function writeNodeConfig(
  config: Record<string, unknown> | undefined,
  description: string | undefined,
): Record<string, unknown> | undefined {
  const next = { ...(config ?? {}) }

  if (description?.trim()) {
    next.description = description.trim()
  } else {
    delete next.description
  }

  return Object.keys(next).length > 0 ? next : undefined
}

export function hasStartNode(nodes: Node[]): boolean {
  return nodes.some(
    (node) =>
      node.data?.nodeType === 'start' ||
      node.type === 'input' ||
      node.type === 'start',
  )
}

export function hasEndNode(nodes: Node[]): boolean {
  return nodes.some(
    (node) =>
      node.data?.nodeType === 'end' ||
      node.type === 'output' ||
      node.type === 'end',
  )
}

function toDbNodeType(reactFlowType?: string, dataNodeType?: string): TestFlowNodeType {
  if (dataNodeType && isTestFlowNodeType(dataNodeType)) {
    return dataNodeType
  }

  const candidate = reactFlowType
  if (candidate === 'input' || candidate === 'start') return 'start'
  if (candidate === 'output' || candidate === 'end') return 'end'
  if (candidate && isTestFlowNodeType(candidate)) {
    return candidate
  }
  return 'script'
}

function toReactFlowType(_nodeType: TestFlowNodeType): string {
  return WORKFLOW_NODE_TYPE
}

function flattenNodePosition(node: Node, nodeMap: Map<string, Node>): { x: number; y: number } {
  if (!node.parentId) return node.position

  const parent = nodeMap.get(node.parentId)
  if (!parent) return node.position

  const parentPosition = flattenNodePosition(parent, nodeMap)
  return {
    x: parentPosition.x + node.position.x,
    y: parentPosition.y + node.position.y,
  }
}

export function reactFlowToGraph(
  nodes: Node[],
  edges: Edge[],
  uiLayoutJson?: Record<string, unknown> | null,
): TestFlowGraph {
  const workflowNodes = nodes.filter((node) => !isLoopBodyGroupNode(node))
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))

  const persistedEdges = edges
    .filter((edge) => !isLoopBackEdge(edge))
    .map((edge) => {
      const sourceNode = nodeMap.get(edge.source)
      if (sourceNode && isLoopBodyGroupNode(sourceNode)) {
        const loopNodeId = sourceNode.data?.loopNodeId
        if (typeof loopNodeId === 'string' && loopNodeId.length > 0) {
          return { ...edge, source: loopNodeId }
        }
      }
      return edge
    })

  return {
    uiLayoutJson: uiLayoutJson ?? null,
    nodes: workflowNodes.map((node) => {
      const data = node.data as WorkflowNodeData
      const description = node.data?.description as string | undefined
      const config = writeNodeConfig(
        isLoopNodeType(data.nodeType ?? '')
          ? migrateLoopNodeConfig(data.config as Record<string, unknown> | undefined)
          : (data.config as Record<string, unknown> | undefined),
        description,
      )
      const position = flattenNodePosition(node, nodeMap)

      return {
        id: node.id,
        nodeType: toDbNodeType(node.type, node.data?.nodeType as string | undefined),
        label: (node.data?.label as string | undefined) ?? undefined,
        scriptLanguage: node.data?.scriptLanguage as TestFlowGraphNode['scriptLanguage'],
        scriptContent: node.data?.scriptContent as string | undefined,
        scriptDependencies: node.data?.scriptDependencies as Record<string, unknown> | undefined,
        config,
        positionX: Math.round(position.x),
        positionY: Math.round(position.y),
      }
    }),
    edges: persistedEdges.map((edge) => ({
      id: edge.id,
      sourceNodeId: edge.source,
      targetNodeId: edge.target,
      sourceHandle: edge.sourceHandle ?? undefined,
      targetHandle: edge.targetHandle ?? undefined,
      label: typeof edge.label === 'string' ? edge.label : undefined,
    })),
  }
}

export function graphToReactFlow(version: TestFlowVersionGraph | null): {
  nodes: Node[]
  edges: Edge[]
} {
  if (!version) {
    const nodes = createDefaultNodes()
    return { nodes, edges: createDefaultEdges(nodes) }
  }

  const baseNodes = version.nodes.map((node) => ({
    id: node.id,
    type: toReactFlowType(node.nodeType),
    draggable: false,
    origin: WORKFLOW_NODE_ORIGIN,
    data: {
      label: node.label ?? node.nodeType,
      description: readNodeDescription(node.config as Record<string, unknown> | undefined) ?? '',
      nodeType: node.nodeType,
      scriptLanguage: node.scriptLanguage,
      scriptContent: node.scriptContent,
      scriptDependencies: node.scriptDependencies,
      config:
        node.nodeType === 'for-loop' || node.nodeType === 'do-while'
          ? migrateLoopNodeConfig(node.config as Record<string, unknown> | undefined)
          : node.config,
    },
    position: {
      x: node.positionX ?? FLOW_BOARD_START_X,
      y: node.positionY ?? FLOW_BOARD_Y,
    },
  }))

  const baseEdges = version.edges.map((edge) =>
    withWorkflowEdgeDefaults({
      id: edge.id,
      source: edge.sourceNodeId,
      target: edge.targetNodeId,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      label: edge.label,
    }),
  )

  return prepareLoadedFlowGraph(baseNodes, baseEdges)
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

export function pruneEdgesForRemovedBranches(
  edges: Edge[],
  sourceNodeId: string,
  branches: IfElseBranch[],
): Edge[] {
  const branchIds = new Set(branches.map((branch) => branch.id))

  return edges.filter((edge) => {
    if (edge.source !== sourceNodeId) return true
    if (!edge.sourceHandle) return true
    if (edge.sourceHandle === LOOP_DONE_BRANCH_ID) return true
    return branchIds.has(edge.sourceHandle)
  })
}

export function connectEdge(connection: Connection, edges: Edge[]): Edge[] {
  return addEdge(
    {
      ...connection,
      id: createNodeId(),
      ...WORKFLOW_EDGE_OPTIONS,
    },
    edges,
  )
}
