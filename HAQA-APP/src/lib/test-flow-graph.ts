import type { Connection, Edge, Node } from '@xyflow/react'
import { addEdge } from '@xyflow/react'
import {
  getLoopBodyRowHeight,
  IF_ELSE_NODE_LAYOUT,
  LOOP_BODY_GROUP,
  LOOP_BODY_WRAP,
} from '@/components/test-flow/workflow-node-layout'
import {
  getWorkflowNodeLabel,
  isLoopBodyWorkNodeType,
  isTestFlowNodeType,
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
  scriptLanguage?: 'javascript' | 'python' | 'bash'
  scriptContent?: string
  scriptDependencies?: Record<string, unknown>
  config?: Record<string, unknown>
  loopBodySteps?: LoopBodyStep[]
  onEdit?: () => void
  onSwapLeft?: () => void
  onSwapRight?: () => void
  canSwapLeft?: boolean
  canSwapRight?: boolean
}

export interface TestFlowGraphNode {
  id: string
  nodeType: TestFlowNodeType
  label?: string
  scriptLanguage?: 'javascript' | 'python' | 'bash'
  scriptContent?: string
  scriptDependencies?: Record<string, unknown>
  config?: Record<string, unknown>
  positionX?: number
  positionY?: number
}

const HORIZONTAL_NODE_GAP = 300
const VERTICAL_BRANCH_OFFSET = 120
export const LOOP_BODY_GROUP_NODE_TYPE = 'loop-body-group' as const
const FLOW_BOARD_Y = 200
const FLOW_BOARD_START_X = 40
const POSITION_TOLERANCE = 10
/** Vertical center anchor — position.y aligns handle line without custom handle offsets. */
export const WORKFLOW_NODE_ORIGIN: [number, number] = [0, 0.5]

/** Shared React Flow edge styling for workflow connections. */
export const WORKFLOW_EDGE_OPTIONS = {
  type: 'smoothstep' as const,
  animated: true,
  pathOptions: {
    borderRadius: 16,
    offset: 28,
  },
  style: {
    strokeWidth: 2,
  },
}

export function withWorkflowEdgeDefaults(edge: Edge): Edge {
  return {
    ...edge,
    ...WORKFLOW_EDGE_OPTIONS,
    pathOptions: {
      ...WORKFLOW_EDGE_OPTIONS.pathOptions,
      ...(edge.pathOptions ?? {}),
    },
    style: {
      ...WORKFLOW_EDGE_OPTIONS.style,
      ...(edge.style ?? {}),
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

export const DEFAULT_LOOP_BRANCHES: IfElseBranch[] = [
  { id: LOOP_BODY_BRANCH_ID, label: 'Loop' },
  { id: LOOP_DONE_BRANCH_ID, label: 'Done' },
]

const MIN_LOOP_BRANCHES = 2
const LOOP_BODY_BRANCH_LABEL = 'Loop'
const LOOP_DONE_BRANCH_LABEL = 'Done'

export function isLoopNodeType(nodeType: string): nodeType is 'for-loop' | 'do-while' {
  return nodeType === 'for-loop' || nodeType === 'do-while'
}

export function isBranchingNodeType(nodeType: string): boolean {
  return nodeType === 'if-else' || isLoopNodeType(nodeType)
}

export function readLoopBranches(config?: Record<string, unknown> | null): IfElseBranch[] {
  const raw = config?.branches
  if (!Array.isArray(raw)) return [...DEFAULT_LOOP_BRANCHES]

  const branches = raw.filter(isIfElseBranch).map((branch) => ({
    id: branch.id,
    label: branch.label.trim() || branch.id,
  }))

  if (branches.length < MIN_LOOP_BRANCHES) return [...DEFAULT_LOOP_BRANCHES]

  return normalizeLoopBranches(branches)
}

export function isLoopBodyBranchIndex(index: number): boolean {
  return index === 0
}

export function isLoopDoneBranchIndex(index: number, count: number): boolean {
  return count > 0 && index === count - 1
}

export function normalizeLoopBranches(branches: IfElseBranch[]): IfElseBranch[] {
  if (branches.length < MIN_LOOP_BRANCHES) return [...DEFAULT_LOOP_BRANCHES]

  const normalized = branches.map((branch) => ({ ...branch }))

  if (normalized[0].id === LOOP_DONE_BRANCH_ID) {
    normalized[0] = { ...normalized[0], id: createNodeId() }
  }

  normalized[0] = {
    id: LOOP_BODY_BRANCH_ID,
    label: LOOP_BODY_BRANCH_LABEL,
  }

  for (let index = 1; index < normalized.length - 1; index += 1) {
    if (
      normalized[index].id === LOOP_BODY_BRANCH_ID ||
      normalized[index].id === LOOP_DONE_BRANCH_ID
    ) {
      normalized[index] = { ...normalized[index], id: createNodeId() }
    }
  }

  normalized[normalized.length - 1] = {
    id: LOOP_DONE_BRANCH_ID,
    label: LOOP_DONE_BRANCH_LABEL,
  }

  return normalized
}

export function addLoopBreakCondition(branches: IfElseBranch[], label?: string): IfElseBranch[] {
  const normalized = normalizeLoopBranches(branches)
  const doneBranch = normalized[normalized.length - 1]
  const breakCount = Math.max(normalized.length - 2, 0)
  const newBreak = createIfElseBranch(label ?? `Break ${breakCount + 1}`)

  return normalizeLoopBranches([
    ...normalized.slice(0, normalized.length - 1),
    newBreak,
    doneBranch,
  ])
}

export function removeLoopBreakCondition(
  branches: IfElseBranch[],
  branchId: string,
): IfElseBranch[] {
  const normalized = normalizeLoopBranches(branches)
  if (normalized.length <= MIN_LOOP_BRANCHES) return normalized

  const branchIndex = normalized.findIndex((branch) => branch.id === branchId)
  if (
    branchIndex === -1 ||
    isLoopBodyBranchIndex(branchIndex) ||
    isLoopDoneBranchIndex(branchIndex, normalized.length)
  ) {
    return normalized
  }

  return normalizeLoopBranches(normalized.filter((branch) => branch.id !== branchId))
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
  nodeType: TestFlowNodeType
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

export function resolveLoopBodySteps(
  bodyNodeIds: string[] | undefined | null,
  nodes: Node[] | undefined | null,
): LoopBodyStep[] {
  const ids = Array.isArray(bodyNodeIds) ? bodyNodeIds : []
  const nodeList = Array.isArray(nodes) ? nodes : []
  const nodeMap = new Map(nodeList.map((node) => [node.id, node]))

  return ids
    .map((id) => nodeMap.get(id))
    .filter((node): node is Node => Boolean(node))
    .map((node) => {
      const data = node.data as WorkflowNodeData
      const nodeType = data.nodeType ?? 'script'

      return {
        id: node.id,
        label: data.label?.trim() || getWorkflowNodeLabel(nodeType),
        nodeType,
      }
    })
}

export function getLoopNodeHeight(
  branchCount: number,
  _bodyStepCount: number,
  showFooter: boolean,
): number {
  const { paddingY, headerHeight, branchRowHeight, footerHeight } = IF_ELSE_NODE_LAYOUT
  const loopRowHeight = IF_ELSE_NODE_LAYOUT.branchRowHeight
  const otherRows = Math.max(branchCount - 1, 0) * branchRowHeight

  return (
    paddingY * 2 +
    headerHeight +
    loopRowHeight +
    otherRows +
    (showFooter ? footerHeight : 0)
  )
}

export function getLoopBranchHandleTopPercent(
  rowIndex: number,
  branchCount: number,
  _bodyStepCount: number,
  showFooter: boolean,
): string {
  const nodeHeight = getLoopNodeHeight(branchCount, 0, showFooter)
  const { paddingY, headerHeight, branchRowHeight } = IF_ELSE_NODE_LAYOUT
  const loopRowHeight = IF_ELSE_NODE_LAYOUT.branchRowHeight

  const centerY =
    rowIndex === 0
      ? paddingY + headerHeight + loopRowHeight / 2
      : paddingY +
        headerHeight +
        loopRowHeight +
        (rowIndex - 1) * branchRowHeight +
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

export function isCanvasLayoutNode(node: Node, nodes: Node[] = []): boolean {
  if (isLoopBodyGroupNode(node)) return false
  if (node.parentId && node.parentId.endsWith('-loop-body')) return false
  if (isNodeInAnyLoopBody(node.id, nodes)) return false
  return true
}

function getLoopBodyContentSpan(bodyCount: number): number {
  if (bodyCount <= 0) return 0

  const { nodeWidth } = LOOP_BODY_GROUP
  return (bodyCount - 1) * HORIZONTAL_NODE_GAP + nodeWidth
}

function getLoopBodyGroupSize(bodyCount: number): { width: number; height: number } {
  const { padding, nodeHeight, minWidth, minHeight } = LOOP_BODY_GROUP

  if (bodyCount <= 0) {
    return { width: minWidth, height: minHeight }
  }

  const contentSpan = getLoopBodyContentSpan(bodyCount)
  const width = Math.max(minWidth, padding * 2 + contentSpan)
  const height = Math.max(minHeight, padding * 2 + nodeHeight)

  return { width, height }
}

function getLoopBodyGroupPosition(loopNode: Node, bodyCount: number): { x: number; y: number } {
  const { height } = getLoopBodyGroupSize(bodyCount)
  const { padding } = LOOP_BODY_GROUP

  return {
    x: loopNode.position.x + HORIZONTAL_NODE_GAP - padding,
    y: loopNode.position.y - height / 2,
  }
}

function getLoopBodyChildPosition(stepIndex: number, bodyCount: number): { x: number; y: number } {
  const { width, height } = getLoopBodyGroupSize(bodyCount)
  const contentSpan = getLoopBodyContentSpan(bodyCount)
  const startX = (width - contentSpan) / 2

  return {
    x: startX + stepIndex * HORIZONTAL_NODE_GAP,
    y: height / 2,
  }
}

export function getLoopBodyNodePosition(
  loopNode: Node,
  stepIndex: number,
  _totalSteps: number,
): { x: number; y: number } {
  const groupPosition = getLoopBodyGroupPosition(loopNode, _totalSteps)
  const childPosition = getLoopBodyChildPosition(stepIndex, _totalSteps)

  return {
    x: groupPosition.x + childPosition.x,
    y: groupPosition.y + childPosition.y,
  }
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
): Node[] {
  const groupId = getLoopBodyGroupId(loopNode.id)
  const withoutGroup = nodes.filter((node) => node.id !== groupId)

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

  const { width, height } = getLoopBodyGroupSize(bodyNodeIds.length)
  const groupPosition = getLoopBodyGroupPosition(loopNode, bodyNodeIds.length)

  const groupNode: Node = {
    id: groupId,
    type: LOOP_BODY_GROUP_NODE_TYPE,
    position: groupPosition,
    data: { loopNodeId: loopNode.id },
    style: { width, height, zIndex: -1 },
    draggable: false,
    selectable: false,
    focusable: false,
  }

  const updatedNodes = withoutGroup.map((node) => {
    const stepIndex = bodyNodeIds.indexOf(node.id)
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

    return {
      ...node,
      parentId: groupId,
      extent: 'parent' as const,
      expandParent: true,
      origin: WORKFLOW_NODE_ORIGIN,
      position: getLoopBodyChildPosition(stepIndex, bodyNodeIds.length),
      draggable: false,
    }
  })

  return sortNodesParentFirst([...updatedNodes, groupNode])
}

export function syncAllLoopBodyGroups(nodes: Node[]): Node[] {
  let result = nodes.filter((node) => !isLoopBodyGroupNode(node))

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

  for (const loopNode of result) {
    const data = loopNode.data as WorkflowNodeData
    if (!isLoopNodeType(data.nodeType ?? '')) continue

    const bodyIds = readLoopBodyNodeIds(data.config)
    result = layoutLoopBodyNodes(loopNode, bodyIds, result)
  }

  return result
}

export function syncLoopBodyEdges(
  loopNodeId: string,
  bodyNodeIds: string[],
  edges: Edge[],
): Edge[] {
  const bodySet = new Set(bodyNodeIds)

  let next = edges.filter((edge) => {
    if (edge.source === loopNodeId && edge.sourceHandle === LOOP_BODY_BRANCH_ID) {
      return false
    }

    if (bodySet.has(edge.source) && bodySet.has(edge.target)) {
      return false
    }

    return true
  })

  if (bodyNodeIds.length === 0) return next

  next = connectEdge(
    {
      source: loopNodeId,
      target: bodyNodeIds[0],
      sourceHandle: LOOP_BODY_BRANCH_ID,
    },
    next,
  )

  for (let index = 0; index < bodyNodeIds.length - 1; index += 1) {
    next = connectEdge(
      {
        source: bodyNodeIds[index],
        target: bodyNodeIds[index + 1],
      },
      next,
    )
  }

  return next
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

  const positionedNodes = layoutLoopBodyNodes(loopNode, validIds, nodes).map((node) => {
    if (node.id !== loopNodeId) return node

    return {
      ...node,
      data: {
        ...node.data,
        config: {
          ...((node.data as WorkflowNodeData).config ?? {}),
          bodyNodeIds: validIds,
        },
      },
    }
  })

  return {
    nodes: positionedNodes,
    edges: syncLoopBodyEdges(loopNodeId, validIds, edges),
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

  return applyLoopBodyUpdate(loopNodeId, [...currentIds, newNode.id], [...nodes, newNode], edges)
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

export function createDefaultNodes(): Node[] {
  return [createWorkflowNode('start', { x: FLOW_BOARD_START_X, y: FLOW_BOARD_Y })]
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
          ? { config: { branches: [...DEFAULT_LOOP_BRANCHES] } }
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
): { x: number; y: number } {
  const data = sourceNode.data as WorkflowNodeData
  const branchList =
    branches ??
    (isBranchingNodeType(data.nodeType ?? '')
      ? getNodeOutputBranches(data)
      : [])
  const index = branchList.findIndex((branch) => branch.id === handleId)
  const offsetY = index === -1 ? 0 : getBranchOffsetY(index, branchList.length)

  return {
    x: sourceNode.position.x + HORIZONTAL_NODE_GAP,
    y: sourceNode.position.y + offsetY,
  }
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
  const position = getBranchOutputPosition(branchNode, branchId)
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
    const branches = getNodeOutputBranches(branchNode.data as WorkflowNodeData)

    for (const branch of branches) {
      if (!branchHasTarget(branchNode, branch.id, nodes, edges)) {
        return getBranchOutputPosition(branchNode, branch.id, branches)
      }
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

  const rightmost = canvasNodes.reduce((current, node) =>
    node.position.x >= current.position.x ? node : current,
  )

  return {
    x: rightmost.position.x + HORIZONTAL_NODE_GAP,
    y: rightmost.position.y,
  }
}

export function repositionNodeForBranchConnection(
  nodes: Node[],
  connection: Connection,
): Node[] {
  if (!connection.source || !connection.target) return nodes

  const sourceNode = nodes.find((node) => node.id === connection.source)
  const nodeType = (sourceNode?.data as WorkflowNodeData)?.nodeType ?? ''
  if (!sourceNode || !isBranchingNodeType(nodeType)) return nodes

  const handle = connection.sourceHandle
  if (!handle) return nodes

  const branches = getNodeOutputBranches(sourceNode.data as WorkflowNodeData)
  if (!branches.some((branch) => branch.id === handle)) return nodes

  const position = getBranchOutputPosition(sourceNode, handle, branches)

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

  return {
    uiLayoutJson: uiLayoutJson ?? null,
    nodes: workflowNodes.map((node) => {
      const description = node.data?.description as string | undefined
      const config = writeNodeConfig(
        node.data?.config as Record<string, unknown> | undefined,
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
    edges: edges.map((edge) => ({
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
    return { nodes: createDefaultNodes(), edges: [] }
  }

  return {
    nodes: syncAllLoopBodyGroups(
      version.nodes.map((node) => ({
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
          config: node.config,
        },
        position: {
          x: node.positionX ?? FLOW_BOARD_START_X,
          y: node.positionY ?? FLOW_BOARD_Y,
        },
      })),
    ),
    edges: version.edges.map((edge) =>
      withWorkflowEdgeDefaults({
        id: edge.id,
        source: edge.sourceNodeId,
        target: edge.targetNodeId,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        label: edge.label,
      }),
    ),
  }
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
  return syncAllLoopBodyGroups([...relayoutedMain, ...preserved])
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

function relayoutOrderedNodes(ordered: Node[]): Node[] {
  return ordered.map((node, index) => ({
    ...node,
    origin: WORKFLOW_NODE_ORIGIN,
    position: {
      x: FLOW_BOARD_START_X + index * HORIZONTAL_NODE_GAP,
      y: FLOW_BOARD_Y,
    },
  }))
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
    nodes: mergeMainFlowRelayout(nodes, relayoutOrderedNodes(nextOrdered)),
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
