import type { Connection, Edge, Node } from '@xyflow/react'
import { addEdge } from '@xyflow/react'
import { WORKFLOW_NODE_TYPE } from '@/components/test-flow/workflow-node-types'
import {
  getWorkflowNodeLabel,
  isTestFlowNodeType,
} from '@/components/test-flow/workflow-node-definitions'

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

const HORIZONTAL_NODE_GAP = 220
const FLOW_BOARD_Y = 200
const FLOW_BOARD_START_X = 40

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
    data: {
      label: getWorkflowNodeLabel(nodeType),
      description: '',
      nodeType,
    },
    position: position ?? { x: FLOW_BOARD_START_X, y: FLOW_BOARD_Y },
  }
}

export function getNextNodePosition(existingNodes: Node[]): { x: number; y: number } {
  if (existingNodes.length === 0) {
    return { x: FLOW_BOARD_START_X, y: FLOW_BOARD_Y }
  }

  const maxX = Math.max(...existingNodes.map((node) => node.position.x))
  return {
    x: maxX + HORIZONTAL_NODE_GAP,
    y: FLOW_BOARD_Y,
  }
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
    edges: version.edges.map((edge) => ({
      id: edge.id,
      source: edge.sourceNodeId,
      target: edge.targetNodeId,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      label: edge.label,
    })),
  }
}

export function connectEdge(connection: Connection, edges: Edge[]): Edge[] {
  return addEdge({ ...connection, id: createNodeId() }, edges)
}
