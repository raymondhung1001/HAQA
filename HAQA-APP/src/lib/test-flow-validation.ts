import type { TestFlowGraph, TestFlowGraphEdge, TestFlowGraphNode } from '@/lib/test-flow-graph'
import { IF_ELSE_ELSE_BRANCH_ID } from '@/lib/test-flow-graph'

export type TestFlowValidationErrorCode =
  | 'empty_graph'
  | 'duplicate_node_id'
  | 'missing_start'
  | 'multiple_starts'
  | 'missing_end'
  | 'invalid_edge_reference'
  | 'self_referencing_edge'
  | 'cycle'
  | 'unreachable'
  | 'start_incoming_edge'
  | 'missing_incoming_edge'
  | 'tree_incoming_edge'
  | 'if_else_branches'
  | 'if_else_else_branch'
  | 'if_else_missing_handle'
  | 'if_else_invalid_handle'
  | 'if_else_duplicate_handle'

export interface TestFlowValidationError {
  code: TestFlowValidationErrorCode
  message: string
  nodeId?: string
}

export interface TestFlowValidationResult {
  valid: boolean
  errors: TestFlowValidationError[]
}

const START_NODE_TYPE = 'start'
const END_NODE_TYPE = 'end'
const IF_ELSE_NODE_TYPE = 'if-else'

function pushError(
  errors: TestFlowValidationError[],
  code: TestFlowValidationErrorCode,
  message: string,
  nodeId?: string,
): void {
  errors.push({ code, message, ...(nodeId ? { nodeId } : {}) })
}

export function validateTestFlowGraph(graph: TestFlowGraph): TestFlowValidationResult {
  const errors: TestFlowValidationError[] = []

  if (!graph.nodes.length) {
    pushError(errors, 'empty_graph', 'Graph must include at least one node')
    return { valid: false, errors }
  }

  const nodeById = new Map<string, TestFlowGraphNode>()
  for (const node of graph.nodes) {
    if (nodeById.has(node.id)) {
      pushError(errors, 'duplicate_node_id', `Duplicate node id detected: ${node.id}`, node.id)
    }
    nodeById.set(node.id, node)
  }

  const startNodes = graph.nodes.filter((node) => node.nodeType === START_NODE_TYPE)
  if (startNodes.length === 0) {
    pushError(errors, 'missing_start', 'Graph must contain exactly one start node')
  } else if (startNodes.length > 1) {
    pushError(errors, 'multiple_starts', 'Graph must contain exactly one start node')
  }

  const endNodes = graph.nodes.filter((node) => node.nodeType === END_NODE_TYPE)
  if (endNodes.length < 1) {
    pushError(errors, 'missing_end', 'Graph must contain at least one end node')
  }

  for (const edge of graph.edges) {
    if (!nodeById.has(edge.sourceNodeId) || !nodeById.has(edge.targetNodeId)) {
      pushError(errors, 'invalid_edge_reference', 'All edges must reference existing node ids')
      break
    }
    if (edge.sourceNodeId === edge.targetNodeId) {
      pushError(
        errors,
        'self_referencing_edge',
        `Self-referencing edge is not allowed: ${edge.id}`,
      )
    }
  }

  const adjacency = buildAdjacency(graph.edges, nodeById)
  collectCycleErrors(nodeById, adjacency, errors)
  collectReachabilityErrors(graph.nodes, adjacency, errors)
  collectIncomingEdgeErrors(graph.nodes, graph.edges, errors)
  collectIfElseErrors(graph.nodes, graph.edges, errors)

  return { valid: errors.length === 0, errors }
}

function buildAdjacency(
  edges: TestFlowGraphEdge[],
  nodeById: Map<string, TestFlowGraphNode>,
): Map<string, string[]> {
  const adjacency = new Map<string, string[]>()
  for (const nodeId of nodeById.keys()) {
    adjacency.set(nodeId, [])
  }
  for (const edge of edges) {
    if (!nodeById.has(edge.sourceNodeId) || !nodeById.has(edge.targetNodeId)) continue
    adjacency.get(edge.sourceNodeId)?.push(edge.targetNodeId)
  }
  return adjacency
}

function collectCycleErrors(
  nodeById: Map<string, TestFlowGraphNode>,
  adjacency: Map<string, string[]>,
  errors: TestFlowValidationError[],
): void {
  const visiting = new Set<string>()
  const visited = new Set<string>()

  const dfs = (nodeId: string): void => {
    if (visiting.has(nodeId)) {
      pushError(errors, 'cycle', `Cycle detected in graph at node ${nodeId}`, nodeId)
      return
    }
    if (visited.has(nodeId)) return

    visiting.add(nodeId)
    for (const nextNodeId of adjacency.get(nodeId) ?? []) {
      dfs(nextNodeId)
    }
    visiting.delete(nodeId)
    visited.add(nodeId)
  }

  for (const nodeId of nodeById.keys()) {
    if (!visited.has(nodeId)) {
      dfs(nodeId)
    }
  }
}

function collectReachabilityErrors(
  nodes: TestFlowGraphNode[],
  adjacency: Map<string, string[]>,
  errors: TestFlowValidationError[],
): void {
  const startNode = nodes.find((node) => node.nodeType === START_NODE_TYPE)
  if (!startNode) return

  const visited = new Set<string>()
  const stack = [startNode.id]

  while (stack.length > 0) {
    const currentId = stack.pop()!
    if (visited.has(currentId)) continue
    visited.add(currentId)
    for (const nextId of adjacency.get(currentId) ?? []) {
      if (!visited.has(nextId)) stack.push(nextId)
    }
  }

  const unreachable = nodes.find((node) => !visited.has(node.id))
  if (unreachable) {
    pushError(
      errors,
      'unreachable',
      `All nodes must be reachable from start node. Unreachable: ${unreachable.label ?? unreachable.id}`,
      unreachable.id,
    )
  }
}

function collectIncomingEdgeErrors(
  nodes: TestFlowGraphNode[],
  edges: TestFlowGraphEdge[],
  errors: TestFlowValidationError[],
): void {
  const incomingByNodeId = new Map<string, TestFlowGraphEdge[]>()
  for (const edge of edges) {
    const list = incomingByNodeId.get(edge.targetNodeId) ?? []
    list.push(edge)
    incomingByNodeId.set(edge.targetNodeId, list)
  }

  for (const node of nodes) {
    const incomingCount = incomingByNodeId.get(node.id)?.length ?? 0

    if (node.nodeType === START_NODE_TYPE) {
      if (incomingCount > 0) {
        pushError(errors, 'start_incoming_edge', 'Start node cannot have incoming edges', node.id)
      }
      continue
    }

    if (incomingCount === 0) {
      pushError(
        errors,
        'missing_incoming_edge',
        `Node "${node.label ?? node.id}" must have an incoming edge`,
        node.id,
      )
      continue
    }

    if (node.nodeType === END_NODE_TYPE) continue

    if (incomingCount > 1) {
      pushError(
        errors,
        'tree_incoming_edge',
        `Node "${node.label ?? node.id}" must have at most one incoming edge (found ${incomingCount})`,
        node.id,
      )
    }
  }
}

function readIfElseBranches(node: TestFlowGraphNode): Array<{ id: string; label: string }> {
  const rawBranches = node.config?.branches
  if (!Array.isArray(rawBranches)) return []

  const branches: Array<{ id: string; label: string }> = []
  for (const branch of rawBranches) {
    if (!branch || typeof branch !== 'object') continue
    const record = branch as Record<string, unknown>
    const id = record.id
    const label = record.label
    if (typeof id === 'string' && id.length > 0 && typeof label === 'string') {
      branches.push({ id, label })
    }
  }
  return branches
}

function collectIfElseErrors(
  nodes: TestFlowGraphNode[],
  edges: TestFlowGraphEdge[],
  errors: TestFlowValidationError[],
): void {
  const outgoingByNodeId = new Map<string, TestFlowGraphEdge[]>()
  for (const edge of edges) {
    const list = outgoingByNodeId.get(edge.sourceNodeId) ?? []
    list.push(edge)
    outgoingByNodeId.set(edge.sourceNodeId, list)
  }

  for (const node of nodes) {
    if (node.nodeType !== IF_ELSE_NODE_TYPE) continue

    const branches = readIfElseBranches(node)
    if (branches.length < 2) {
      pushError(
        errors,
        'if_else_branches',
        `If / Else node "${node.label ?? node.id}" must define at least two branches`,
        node.id,
      )
      continue
    }

    const elseBranch = branches[branches.length - 1]
    if (elseBranch.id !== IF_ELSE_ELSE_BRANCH_ID) {
      pushError(
        errors,
        'if_else_else_branch',
        `If / Else node "${node.label ?? node.id}" must keep "${IF_ELSE_ELSE_BRANCH_ID}" as the last branch id`,
        node.id,
      )
    }

    const allowedHandles = new Set(branches.map((branch) => branch.id))
    const outgoing = outgoingByNodeId.get(node.id) ?? []
    const handleUsage = new Map<string, number>()

    for (const edge of outgoing) {
      const handle = edge.sourceHandle
      if (!handle) {
        pushError(
          errors,
          'if_else_missing_handle',
          `If / Else node "${node.label ?? node.id}" requires source handles on outgoing edges`,
          node.id,
        )
        continue
      }
      if (!allowedHandles.has(handle)) {
        pushError(
          errors,
          'if_else_invalid_handle',
          `If / Else node "${node.label ?? node.id}" has invalid source handle "${handle}" on an edge`,
          node.id,
        )
      }
      handleUsage.set(handle, (handleUsage.get(handle) ?? 0) + 1)
    }

    for (const [handle, count] of handleUsage.entries()) {
      if (count > 1) {
        pushError(
          errors,
          'if_else_duplicate_handle',
          `If / Else node "${node.label ?? node.id}" cannot have multiple outgoing edges from handle "${handle}"`,
          node.id,
        )
      }
    }
  }
}
