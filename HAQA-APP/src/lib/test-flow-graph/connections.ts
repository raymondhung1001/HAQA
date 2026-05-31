import type { Connection, Edge, Node } from '@xyflow/react'
import { addEdge } from '@xyflow/react'
import type { WorkflowNodeData, TestFlowNodeType } from './types'
import { WORKFLOW_EDGE_OPTIONS } from './constants'
import {
  LOOP_BODY_BRANCH_ID,
  LOOP_DONE_BRANCH_ID,
  LOOP_CONTINUE_SOURCE_HANDLE,
} from './constants'
import {
  getIfElseBranches,
  isLoopNodeType,
  readLoopBodyNodeIds,
} from './branch-config'
import {
  isLoopBodyBreakTargetEdge,
  normalizeLoopBodyBreakTargetConnection,
  withWorkflowEdgeDefaults,
  isUiOnlyEdge,
} from './edge-helpers'
import {
  getBreakExitsForLoopBodyGroup,
  findLoopNodeForBodyMember,
  isLoopBodyGroupNode,
  isNodeInLoopBody,
  isCanvasLayoutNode,
  getLoopNodeForBodyGroup,
  canConnectBodyBranchToLoopBreak,
  isBranchingWorkNodeType,
} from './loop-body'
import { createNodeId } from './nodes'

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

const validateLoopBodyGroupSourceConnection = (
  sourceNode: Node,
  targetNode: Node,
  sourceHandle: string | null | undefined,
  nodes: Node[],
): boolean | undefined => {
  if (!isLoopBodyGroupNode(sourceNode)) return undefined
  if (!sourceHandle) return false

  const loopNodeId = (sourceNode.data as { loopNodeId?: string })?.loopNodeId
  if (typeof loopNodeId !== 'string' || loopNodeId.length === 0) return false

  if (sourceHandle === LOOP_DONE_BRANCH_ID) {
    return isValidLoopGroupExitTarget(loopNodeId, targetNode, nodes)
  }

  const breakExits = getBreakExitsForLoopBodyGroup(sourceNode, nodes)
  if (!breakExits.some((branch) => branch.id === sourceHandle)) return false

  const loopNode = nodes.find((node) => node.id === loopNodeId)
  if (!loopNode) return false

  const bodyIds = readLoopBodyNodeIds((loopNode.data as WorkflowNodeData).config)
  if (!loopBodyHasIfElseNode(loopNodeId, bodyIds, nodes)) return false

  return isValidLoopGroupExitTarget(loopNodeId, targetNode, nodes)
}

const validateLoopNodeSourceConnection = (
  sourceNode: Node,
  targetNode: Node,
  targetType: string,
  sourceHandle: string | null | undefined,
  nodes: Node[],
): boolean | undefined => {
  const sourceType = (sourceNode.data as WorkflowNodeData)?.nodeType ?? ''
  if (!isLoopNodeType(sourceType)) return undefined

  if (sourceHandle === LOOP_BODY_BRANCH_ID) {
    return isLoopBodyWorkNodeType(targetType as TestFlowNodeType)
  }

  if (sourceHandle === LOOP_DONE_BRANCH_ID) {
    const bodyIds = readLoopBodyNodeIds((sourceNode.data as WorkflowNodeData).config)
    if (bodyIds.length > 0) return false
    return isCanvasLayoutNode(targetNode, nodes)
  }

  return false
}

const hasValidBranchingSourceHandle = (
  sourceNode: Node,
  sourceType: string,
  sourceHandle: string | null | undefined,
): boolean => {
  if (!isBranchingWorkNodeType(sourceType)) return true
  if (!sourceHandle) return false

  const branches = getIfElseBranches(sourceNode.data as WorkflowNodeData)
  return branches.some((branch) => branch.id === sourceHandle)
}

const validateLoopBodyMemberConnection = (
  sourceNode: Node,
  targetNode: Node,
  targetType: string,
  nodes: Node[],
): boolean | undefined => {
  const owningLoop = findLoopNodeForBodyMember(sourceNode.id, nodes)
  if (!owningLoop) return undefined

  if (
    isNodeInLoopBody(targetNode.id, owningLoop, nodes) &&
    !isLoopBodyGroupNode(targetNode)
  ) {
    return isLoopBodyWorkNodeType(targetType as TestFlowNodeType)
  }

  if (isCanvasLayoutNode(targetNode, nodes)) {
    return false
  }

  return false
}

const TREE_NODE_TYPES_WITH_SINGLE_OUTGOING = new Set<TestFlowNodeType>([
  'start',
  'script',
  'api-call',
  'wait',
  'end',
])

function countEdgesBySourceHandle(
  edges: Edge[],
  sourceId: string,
  sourceHandle: string | null | undefined,
): number {
  return edges.filter(
    (edge) =>
      edge.source === sourceId &&
      (sourceHandle === undefined || sourceHandle === null
        ? !edge.sourceHandle
        : edge.sourceHandle === sourceHandle),
  ).length
}

function countIncomingEdges(edges: Edge[], targetId: string): number {
  return edges.filter((edge) => edge.target === targetId).length
}

function countOutgoingEdges(edges: Edge[], sourceId: string): number {
  return edges.filter((edge) => edge.source === sourceId).length
}

function validateConnectionAgainstExistingEdges(
  connection: Connection,
  nodes: Node[],
  edges: Edge[],
): boolean {
  if (!connection.source || !connection.target) return false

  const sourceNode = nodes.find((node) => node.id === connection.source)
  const targetNode = nodes.find((node) => node.id === connection.target)
  if (!sourceNode || !targetNode) return false

  const sourceType = (sourceNode.data as WorkflowNodeData)?.nodeType ?? ''
  const targetType = (targetNode.data as WorkflowNodeData)?.nodeType ?? ''
  const handle = connection.sourceHandle

  if (targetType !== 'end' && countIncomingEdges(edges, connection.target) >= 1) {
    return false
  }

  if (sourceType === 'if-else' && handle) {
    if (countEdgesBySourceHandle(edges, connection.source, handle) >= 1) {
      return false
    }
  }

  if (isLoopNodeType(sourceType) && handle) {
    if (countEdgesBySourceHandle(edges, connection.source, handle) >= 1) {
      return false
    }
  }

  if (isLoopBodyGroupNode(sourceNode) && handle) {
    if (countEdgesBySourceHandle(edges, connection.source, handle) >= 1) {
      return false
    }
  }

  if (
    TREE_NODE_TYPES_WITH_SINGLE_OUTGOING.has(sourceType as TestFlowNodeType) &&
    sourceType !== 'end' &&
    countOutgoingEdges(edges, connection.source) >= 1
  ) {
    return false
  }

  return true
}

export function isValidWorkflowConnection(
  connection: Connection,
  nodes: Node[],
  edges: Edge[] = [],
): boolean {
  if (!connection.source || !connection.target) return false
  if (connection.source === connection.target) return false

  const sourceNode = nodes.find((node) => node.id === connection.source)
  const targetNode = nodes.find((node) => node.id === connection.target)
  if (!sourceNode || !targetNode) return false

  const sourceType = (sourceNode.data as WorkflowNodeData)?.nodeType ?? ''
  const targetType = (targetNode.data as WorkflowNodeData)?.nodeType ?? ''
  const handle = connection.sourceHandle

  if (canConnectBodyBranchToLoopBreak(connection, sourceNode, targetNode, nodes)) {
    return validateConnectionAgainstExistingEdges(connection, nodes, edges)
  }

  const loopBodyGroupResult = validateLoopBodyGroupSourceConnection(
    sourceNode,
    targetNode,
    handle,
    nodes,
  )
  if (loopBodyGroupResult !== undefined) {
    return loopBodyGroupResult
      ? validateConnectionAgainstExistingEdges(connection, nodes, edges)
      : false
  }

  const loopNodeResult = validateLoopNodeSourceConnection(
    sourceNode,
    targetNode,
    targetType,
    handle,
    nodes,
  )
  if (loopNodeResult !== undefined) {
    return loopNodeResult
      ? validateConnectionAgainstExistingEdges(connection, nodes, edges)
      : false
  }

  if (!hasValidBranchingSourceHandle(sourceNode, sourceType, handle)) return false

  const loopBodyMemberResult = validateLoopBodyMemberConnection(
    sourceNode,
    targetNode,
    targetType,
    nodes,
  )
  if (loopBodyMemberResult !== undefined) {
    return loopBodyMemberResult
      ? validateConnectionAgainstExistingEdges(connection, nodes, edges)
      : false
  }

  const targetLoop = findLoopNodeForBodyMember(targetNode.id, nodes)
  if (targetLoop && isCanvasLayoutNode(sourceNode, nodes)) {
    return false
  }

  return validateConnectionAgainstExistingEdges(connection, nodes, edges)
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

/** Branch label for If/Else (and similar) outgoing edges shown on the canvas. */
export function resolveBranchEdgeLabel(
  connection: Connection,
  nodes: Node[],
): string | undefined {
  if (!connection.source || !connection.sourceHandle) return undefined

  const sourceNode = nodes.find((node) => node.id === connection.source)
  if (!sourceNode) return undefined

  const data = sourceNode.data as WorkflowNodeData
  const nodeType = data?.nodeType ?? ''
  if (nodeType !== 'if-else') return undefined

  const branch = getIfElseBranches(data).find((item) => item.id === connection.sourceHandle)
  const label = branch?.label?.trim()
  return label || undefined
}

export function connectEdge(
  connection: Connection,
  edges: Edge[],
  nodes?: Node[],
): Edge[] {
  if (
    connection.source &&
    connection.target &&
    workflowEdgeExists(edges, connection.source, connection.target, connection.sourceHandle)
  ) {
    return edges
  }

  const label = nodes ? resolveBranchEdgeLabel(connection, nodes) : undefined

  return addEdge(
    {
      ...connection,
      id: createNodeId(),
      ...WORKFLOW_EDGE_OPTIONS,
      ...(label ? { label } : {}),
    },
    edges,
  )
}
