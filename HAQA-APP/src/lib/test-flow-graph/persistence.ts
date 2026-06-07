import type { Edge, Node } from '@xyflow/react'
import type {
  TestFlowGraph,
  TestFlowGraphNode,
  TestFlowVersionGraph,
  WorkflowNodeData,
} from './types'
import {
  WORKFLOW_NODE_TYPE,
  WORKFLOW_NODE_ORIGIN,
  FLOW_BOARD_START_X,
  FLOW_BOARD_Y,
  LOOP_CONTINUE_SOURCE_HANDLE,
} from './constants'
import { migrateLoopNodeConfig, isLoopNodeType, getIfElseBranches } from './branch-config'
import {
  isLoopBodyGroupNode,
  syncAllLoopBodyGroups,
  syncAllLoopBodyEdges,
  reconstructLoopBodyBreakTargetEdges,
  relayoutMainFlowCanvasNodes,
} from './loop-body'
import { isUiOnlyEdge, withWorkflowEdgeDefaults } from './edge-helpers'
import { createDefaultNodes, createDefaultEdges, createNodeId, hasStartNode, hasEndNode } from './nodes'
import { isTestFlowNodeType } from './workflow-node-meta'

export function prepareLoadedFlowGraph(
  nodes: Node[],
  edges: Edge[],
): { nodes: Node[]; edges: Edge[] } {
  const syncedNodes = syncAllLoopBodyGroups(nodes, edges)
  let syncedEdges = syncAllLoopBodyEdges(syncedNodes, edges)
  syncedEdges = reconstructLoopBodyBreakTargetEdges(syncedNodes, syncedEdges)

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
    .filter((edge) => !isUiOnlyEdge(edge))
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
  viewport?: { x: number; y: number; zoom: number }
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

  const baseEdges = version.edges.map((edge) => {
    let label = edge.label
    if (!label && edge.sourceHandle) {
      const source = version.nodes.find((node) => node.id === edge.sourceNodeId)
      if (source?.nodeType === 'if-else') {
        const branch = getIfElseBranches({
          nodeType: 'if-else',
          label: source.label ?? 'if-else',
          config: source.config as Record<string, unknown> | undefined,
        }).find((item) => item.id === edge.sourceHandle)
        label = branch?.label
      }
    }

    return withWorkflowEdgeDefaults({
      id: edge.id,
      source: edge.sourceNodeId,
      target: edge.targetNodeId,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      label,
    })
  })

  return {
    ...prepareLoadedFlowGraph(baseNodes, baseEdges),
    viewport: readViewportFromUiLayout(version.uiLayoutJson),
  }
}

export function readViewportFromUiLayout(
  uiLayoutJson: Record<string, unknown> | null | undefined,
): { x: number; y: number; zoom: number } | undefined {
  if (!uiLayoutJson) return undefined

  const viewport = uiLayoutJson.viewport
  if (!viewport || typeof viewport !== 'object') return undefined

  const record = viewport as Record<string, unknown>
  const x = record.x
  const y = record.y
  const zoom = record.zoom

  if (typeof x === 'number' && typeof y === 'number' && typeof zoom === 'number') {
    return { x, y, zoom }
  }

  return undefined
}

export function buildUiLayoutJson(viewport: {
  x: number
  y: number
  zoom: number
}): Record<string, unknown> {
  return { viewport }
}
