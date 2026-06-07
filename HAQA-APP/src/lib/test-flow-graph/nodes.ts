import type { Edge, Node } from '@xyflow/react'
import type { TestFlowNodeType, WorkflowNodeData } from './types'
import {
  WORKFLOW_NODE_TYPE,
  WORKFLOW_NODE_ORIGIN,
  WORKFLOW_EDGE_OPTIONS,
  FLOW_BOARD_START_X,
  FLOW_BOARD_Y,
  HORIZONTAL_NODE_GAP,
  DEFAULT_IF_ELSE_BRANCHES,
  DEFAULT_LOOP_BRANCHES,
  LOOP_CONFIG_VERSION,
  LOOP_CONTINUE_SOURCE_HANDLE,
  LOOP_BODY_GROUP_NODE_TYPE,
} from './constants'
import { isLoopBodyGroupNode } from './loop-body'
import { isLoopNodeType, readLoopBodyNodeIds } from './branch-config'
import {
  getWorkflowNodeLabel,
  getWorkflowNodeTypeOrdinals,
  resolveWorkflowNodeDisplayLabel,
} from './workflow-node-meta'
import { getWorkflowNodeLayoutWidth } from './layout'

function getNodeTypeFromMap(
  nodeMap: Map<string, Node>,
  nodeId: string,
): TestFlowNodeType | undefined {
  const node = nodeMap.get(nodeId)
  if (!node) return undefined
  return (node.data as WorkflowNodeData).nodeType ?? 'script'
}

export function createNodeId(): string {
  return crypto.randomUUID()
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

/** True when the canvas is still the default Start → End stub (ignores loop-body-group nodes and loop-back edges). */
export function isEmptyStarterGraph(nodes: Node[], edges: Edge[]): boolean {
  const workflowNodes = nodes.filter((node) => !isLoopBodyGroupNode(node))
  if (workflowNodes.length !== 2) return false

  const startNode = workflowNodes.find(
    (node) => (node.data as WorkflowNodeData)?.nodeType === 'start',
  )
  const endNode = workflowNodes.find(
    (node) => (node.data as WorkflowNodeData)?.nodeType === 'end',
  )
  if (!startNode || !endNode) return false

  const mainEdges = edges.filter(
    (edge) =>
      edge.sourceHandle !== LOOP_CONTINUE_SOURCE_HANDLE && edge.data?.loopBack !== true,
  )

  return (
    mainEdges.length === 1 &&
    mainEdges[0]?.source === startNode.id &&
    mainEdges[0]?.target === endNode.id
  )
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
