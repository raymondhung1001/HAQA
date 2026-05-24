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
  return [createWorkflowNode('start', { x: 250, y: 40 })]
}

export function createWorkflowNode(
  nodeType: TestFlowNodeType,
  position?: { x: number; y: number },
): Node {
  return {
    id: createNodeId(),
    type: WORKFLOW_NODE_TYPE,
    data: {
      label: getWorkflowNodeLabel(nodeType),
      nodeType,
    },
    position: position ?? { x: 120, y: 120 },
  }
}

export function getNextNodePosition(existingNodes: Node[]): { x: number; y: number } {
  const index = existingNodes.length
  return {
    x: 120 + (index % 4) * 180,
    y: 80 + Math.floor(index / 4) * 120,
  }
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
    nodes: nodes.map((node) => ({
      id: node.id,
      nodeType: toDbNodeType(node.type, node.data?.nodeType as string | undefined),
      label: (node.data?.label as string | undefined) ?? undefined,
      scriptLanguage: node.data?.scriptLanguage as TestFlowGraphNode['scriptLanguage'],
      scriptContent: node.data?.scriptContent as string | undefined,
      scriptDependencies: node.data?.scriptDependencies as Record<string, unknown> | undefined,
      config: node.data?.config as Record<string, unknown> | undefined,
      positionX: Math.round(node.position.x),
      positionY: Math.round(node.position.y),
    })),
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
      data: {
        label: node.label ?? node.nodeType,
        nodeType: node.nodeType,
        scriptLanguage: node.scriptLanguage,
        scriptContent: node.scriptContent,
        scriptDependencies: node.scriptDependencies,
        config: node.config,
      },
      position: {
        x: node.positionX ?? 0,
        y: node.positionY ?? 0,
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
