import type { Connection, Edge, Node } from '@xyflow/react'
import { addEdge } from '@xyflow/react'
import { IF_ELSE_NODE_LAYOUT } from '@/components/test-flow/workflow-node-layout'
import {
  getWorkflowNodeLabel,
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

export function getBranchHandleColorClass(index: number, count?: number): string {
  if (count !== undefined && isElseBranchIndex(index, count)) {
    return '!border-red-500'
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

export function getIfElseBranchPosition(
  sourceNode: Node,
  handleId: string,
  branches?: IfElseBranch[],
): { x: number; y: number } {
  const branchList = branches ?? getIfElseBranches(sourceNode.data as WorkflowNodeData)
  const index = branchList.findIndex((branch) => branch.id === handleId)
  const offsetY = index === -1 ? 0 : getBranchOffsetY(index, branchList.length)

  return {
    x: sourceNode.position.x + HORIZONTAL_NODE_GAP,
    y: sourceNode.position.y + offsetY,
  }
}

function branchHasTarget(
  ifElseNode: Node,
  branchId: string,
  nodes: Node[],
  edges: Edge[],
): boolean {
  const position = getIfElseBranchPosition(ifElseNode, branchId)
  const outgoing = edges.filter((edge) => edge.source === ifElseNode.id)

  return (
    outgoing.some((edge) => edge.sourceHandle === branchId) ||
    nodes.some((node) => isNearPosition(node, position, ifElseNode.id))
  )
}

function getNextIfElseBranchSlot(
  nodes: Node[],
  edges: Edge[],
): { x: number; y: number } | null {
  const ifElseNodes = [...nodes]
    .filter((node) => node.data?.nodeType === 'if-else')
    .sort((a, b) => b.position.x - a.position.x)

  for (const ifElseNode of ifElseNodes) {
    const branches = getIfElseBranches(ifElseNode.data as WorkflowNodeData)

    for (const branch of branches) {
      if (!branchHasTarget(ifElseNode, branch.id, nodes, edges)) {
        return getIfElseBranchPosition(ifElseNode, branch.id, branches)
      }
    }
  }

  return null
}

export function getNextNodePosition(
  existingNodes: Node[],
  edges: Edge[] = [],
): { x: number; y: number } {
  if (existingNodes.length === 0) {
    return { x: FLOW_BOARD_START_X, y: FLOW_BOARD_Y }
  }

  const branchSlot = getNextIfElseBranchSlot(existingNodes, edges)
  if (branchSlot) return branchSlot

  const rightmost = existingNodes.reduce((current, node) =>
    node.position.x >= current.position.x ? node : current,
  )

  return {
    x: rightmost.position.x + HORIZONTAL_NODE_GAP,
    y: rightmost.position.y,
  }
}

export function repositionNodeForIfElseConnection(
  nodes: Node[],
  connection: Connection,
): Node[] {
  if (!connection.source || !connection.target) return nodes

  const sourceNode = nodes.find((node) => node.id === connection.source)
  if (!sourceNode || sourceNode.data?.nodeType !== 'if-else') return nodes

  const handle = connection.sourceHandle
  if (!handle) return nodes

  const branches = getIfElseBranches(sourceNode.data as WorkflowNodeData)
  if (!branches.some((branch) => branch.id === handle)) return nodes

  const position = getIfElseBranchPosition(sourceNode, handle, branches)

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

export function reactFlowToGraph(
  nodes: Node[],
  edges: Edge[],
  uiLayoutJson?: Record<string, unknown> | null,
): TestFlowGraph {
  return {
    uiLayoutJson: uiLayoutJson ?? null,
    nodes: nodes.map((node) => {
      const description = node.data?.description as string | undefined
      const config = writeNodeConfig(
        node.data?.config as Record<string, unknown> | undefined,
        description,
      )

      return {
        id: node.id,
        nodeType: toDbNodeType(node.type, node.data?.nodeType as string | undefined),
        label: (node.data?.label as string | undefined) ?? undefined,
        scriptLanguage: node.data?.scriptLanguage as TestFlowGraphNode['scriptLanguage'],
        scriptContent: node.data?.scriptContent as string | undefined,
        scriptDependencies: node.data?.scriptDependencies as Record<string, unknown> | undefined,
        config,
        positionX: Math.round(node.position.x),
        positionY: Math.round(node.position.y),
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
    nodes: version.nodes.map((node) => ({
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
  return [...nodes].sort(
    (a, b) => a.position.x - b.position.x || a.id.localeCompare(b.id),
  )
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
    nodes: relayoutOrderedNodes(nextOrdered),
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
