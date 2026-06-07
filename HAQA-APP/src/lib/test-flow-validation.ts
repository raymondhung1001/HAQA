import type { TestFlowGraph, TestFlowGraphEdge, TestFlowGraphNode } from '@/lib/test-flow-graph'
import {
  IF_ELSE_ELSE_BRANCH_ID,
  LOOP_BODY_BRANCH_ID,
  LOOP_DONE_BRANCH_ID,
  isLoopNodeType,
  readLoopBodyNodeIds,
  readLoopBreakExits,
} from '@/lib/test-flow-graph'

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
  | 'start_missing_outgoing'
  | 'missing_incoming_edge'
  | 'tree_incoming_edge'
  | 'end_outgoing_edge'
  | 'end_missing_incoming'
  | 'linear_multiple_outgoing'
  | 'invalid_source_handle'
  | 'if_else_branches'
  | 'if_else_else_branch'
  | 'if_else_missing_handle'
  | 'if_else_invalid_handle'
  | 'if_else_duplicate_handle'
  | 'loop_missing_body_handle'
  | 'loop_body_without_nodes'
  | 'loop_invalid_body_target'
  | 'loop_exit_to_body'
  | 'loop_break_without_if_else'
  | 'loop_missing_handle'
  | 'loop_invalid_handle'
  | 'loop_duplicate_handle'
  | 'loop_duplicate_body_member'
  | 'loop_body_multiple_owners'
  | 'loop_body_invalid_entry'
  | 'loop_body_outside_exit'

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

const TREE_NODE_TYPES_WITH_SINGLE_OUTGOING = new Set([
  'start',
  'script',
  'api-call',
  'wait',
  'end',
])

interface ParsedLoopConfig {
  bodyNodeIds: string[]
  breakExitIds: string[]
}

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

  const outgoingByNodeId = groupEdgesBySource(graph.edges)
  const incomingByNodeId = groupEdgesByTarget(graph.edges)
  collectNodeDirectionErrors(graph.nodes, outgoingByNodeId, incomingByNodeId, errors)

  const loopConfigByNodeId = parseLoopConfigs(graph.nodes, nodeById, errors)
  collectLoopMembershipErrors(loopConfigByNodeId, errors)
  collectLoopBodyIncomingErrors(loopConfigByNodeId, incomingByNodeId, errors)
  collectLoopBodyOutgoingErrors(loopConfigByNodeId, outgoingByNodeId, errors)
  collectIfElseErrors(graph.nodes, graph.edges, errors)
  collectLoopOutgoingErrors(graph.nodes, outgoingByNodeId, loopConfigByNodeId, nodeById, errors)
  collectInvalidSourceHandleErrors(graph.nodes, outgoingByNodeId, errors)

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

function groupEdgesBySource(edges: TestFlowGraphEdge[]): Map<string, TestFlowGraphEdge[]> {
  const grouped = new Map<string, TestFlowGraphEdge[]>()
  for (const edge of edges) {
    const list = grouped.get(edge.sourceNodeId) ?? []
    list.push(edge)
    grouped.set(edge.sourceNodeId, list)
  }
  return grouped
}

function groupEdgesByTarget(edges: TestFlowGraphEdge[]): Map<string, TestFlowGraphEdge[]> {
  const grouped = new Map<string, TestFlowGraphEdge[]>()
  for (const edge of edges) {
    const list = grouped.get(edge.targetNodeId) ?? []
    list.push(edge)
    grouped.set(edge.targetNodeId, list)
  }
  return grouped
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
  const incomingByNodeId = groupEdgesByTarget(edges)

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

function collectNodeDirectionErrors(
  nodes: TestFlowGraphNode[],
  outgoingByNodeId: Map<string, TestFlowGraphEdge[]>,
  incomingByNodeId: Map<string, TestFlowGraphEdge[]>,
  errors: TestFlowValidationError[],
): void {
  for (const node of nodes) {
    const outgoing = outgoingByNodeId.get(node.id) ?? []
    const incoming = incomingByNodeId.get(node.id) ?? []

    if (node.nodeType === START_NODE_TYPE && outgoing.length === 0) {
      pushError(
        errors,
        'start_missing_outgoing',
        'Start node must have at least one outgoing edge',
        node.id,
      )
    }

    if (node.nodeType === END_NODE_TYPE) {
      if (outgoing.length > 0) {
        pushError(
          errors,
          'end_outgoing_edge',
          `End node "${node.label ?? node.id}" cannot have outgoing edges`,
          node.id,
        )
      }
      if (incoming.length === 0) {
        pushError(
          errors,
          'end_missing_incoming',
          `End node "${node.label ?? node.id}" must be reachable`,
          node.id,
        )
      }
    }

    if (
      TREE_NODE_TYPES_WITH_SINGLE_OUTGOING.has(node.nodeType) &&
      node.nodeType !== END_NODE_TYPE &&
      outgoing.length > 1
    ) {
      pushError(
        errors,
        'linear_multiple_outgoing',
        `Node "${node.label ?? node.id}" can have at most one outgoing edge`,
        node.id,
      )
    }
  }
}

function parseLoopConfigs(
  nodes: TestFlowGraphNode[],
  nodeById: Map<string, TestFlowGraphNode>,
  errors: TestFlowValidationError[],
): Map<string, ParsedLoopConfig> {
  const loopConfigByNodeId = new Map<string, ParsedLoopConfig>()

  for (const node of nodes) {
    if (!isLoopNodeType(node.nodeType)) continue

    const bodyNodeIds = readLoopBodyNodeIds(node.config)
    const breakExitIds = readLoopBreakExits(node.config).map((branch) => branch.id)
    const uniqueBodyNodeIds = [...new Set(bodyNodeIds)]

    if (uniqueBodyNodeIds.length !== bodyNodeIds.length) {
      pushError(
        errors,
        'loop_duplicate_body_member',
        `Loop node "${node.label ?? node.id}" has duplicate body node ids`,
        node.id,
      )
    }

    for (const bodyNodeId of uniqueBodyNodeIds) {
      const bodyNode = nodeById.get(bodyNodeId)
      if (!bodyNode) {
        pushError(
          errors,
          'loop_invalid_body_target',
          `Loop node "${node.label ?? node.id}" references missing body node ${bodyNodeId}`,
          node.id,
        )
      } else if (bodyNodeId === node.id) {
        pushError(
          errors,
          'loop_invalid_body_target',
          `Loop node "${node.label ?? node.id}" cannot include itself in its body`,
          node.id,
        )
      } else if (bodyNode.nodeType === START_NODE_TYPE || bodyNode.nodeType === END_NODE_TYPE) {
        pushError(
          errors,
          'loop_invalid_body_target',
          `Loop node "${node.label ?? node.id}" body cannot include ${bodyNode.nodeType} node ${bodyNodeId}`,
          node.id,
        )
      }
    }

    loopConfigByNodeId.set(node.id, {
      bodyNodeIds: uniqueBodyNodeIds,
      breakExitIds,
    })
  }

  return loopConfigByNodeId
}

function collectLoopMembershipErrors(
  loopConfigByNodeId: Map<string, ParsedLoopConfig>,
  errors: TestFlowValidationError[],
): void {
  const ownerByBodyNodeId = new Map<string, string>()

  for (const [loopNodeId, loopConfig] of loopConfigByNodeId.entries()) {
    for (const bodyNodeId of loopConfig.bodyNodeIds) {
      const existingOwner = ownerByBodyNodeId.get(bodyNodeId)
      if (existingOwner && existingOwner !== loopNodeId) {
        pushError(
          errors,
          'loop_body_multiple_owners',
          `Node ${bodyNodeId} cannot belong to multiple loop bodies`,
          bodyNodeId,
        )
      }
      ownerByBodyNodeId.set(bodyNodeId, loopNodeId)
    }
  }
}

function collectLoopBodyIncomingErrors(
  loopConfigByNodeId: Map<string, ParsedLoopConfig>,
  incomingByNodeId: Map<string, TestFlowGraphEdge[]>,
  errors: TestFlowValidationError[],
): void {
  for (const [loopNodeId, loopConfig] of loopConfigByNodeId.entries()) {
    const bodySet = new Set(loopConfig.bodyNodeIds)

    for (const bodyNodeId of loopConfig.bodyNodeIds) {
      const incoming = incomingByNodeId.get(bodyNodeId) ?? []

      for (const edge of incoming) {
        const sourceInSameBody = bodySet.has(edge.sourceNodeId)
        const sourceIsLoopEntry =
          edge.sourceNodeId === loopNodeId && edge.sourceHandle === LOOP_BODY_BRANCH_ID

        if (!sourceInSameBody && !sourceIsLoopEntry) {
          pushError(
            errors,
            'loop_body_invalid_entry',
            `Loop body node "${bodyNodeId}" can only be entered from loop Loop handle or same loop body`,
            bodyNodeId,
          )
        }
      }
    }
  }
}

function collectLoopBodyOutgoingErrors(
  loopConfigByNodeId: Map<string, ParsedLoopConfig>,
  outgoingByNodeId: Map<string, TestFlowGraphEdge[]>,
  errors: TestFlowValidationError[],
): void {
  for (const [, loopConfig] of loopConfigByNodeId.entries()) {
    const bodySet = new Set(loopConfig.bodyNodeIds)

    for (const bodyNodeId of loopConfig.bodyNodeIds) {
      const outgoing = outgoingByNodeId.get(bodyNodeId) ?? []

      for (const edge of outgoing) {
        if (bodySet.has(edge.targetNodeId)) continue

        pushError(
          errors,
          'loop_body_outside_exit',
          `Loop body node "${bodyNodeId}" cannot connect outside its loop body except through loop break/done handles`,
          bodyNodeId,
        )
      }
    }
  }
}

function collectHandledOutgoingErrors(
  nodeId: string,
  nodeLabel: string | undefined,
  outgoing: TestFlowGraphEdge[],
  allowedHandles: Set<string>,
  nodeKind: 'if-else' | 'loop',
  errors: TestFlowValidationError[],
): void {
  const handleUsage = new Map<string, number>()

  for (const edge of outgoing) {
    const handle = edge.sourceHandle
    if (!handle) {
      pushError(
        errors,
        nodeKind === 'if-else' ? 'if_else_missing_handle' : 'loop_missing_handle',
        `${nodeKind === 'if-else' ? 'If / Else' : 'Loop'} node "${nodeLabel ?? nodeId}" requires source handles on outgoing edges`,
        nodeId,
      )
      continue
    }

    if (!allowedHandles.has(handle)) {
      pushError(
        errors,
        nodeKind === 'if-else' ? 'if_else_invalid_handle' : 'loop_invalid_handle',
        `${nodeKind === 'if-else' ? 'If / Else' : 'Loop'} node "${nodeLabel ?? nodeId}" has invalid source handle "${handle}"`,
        nodeId,
      )
    }

    handleUsage.set(handle, (handleUsage.get(handle) ?? 0) + 1)
  }

  for (const [handle, count] of handleUsage.entries()) {
    if (count > 1) {
      pushError(
        errors,
        nodeKind === 'if-else' ? 'if_else_duplicate_handle' : 'loop_duplicate_handle',
        `${nodeKind === 'if-else' ? 'If / Else' : 'Loop'} node "${nodeLabel ?? nodeId}" cannot have multiple outgoing edges from handle "${handle}"`,
        nodeId,
      )
    }
  }
}

function collectLoopOutgoingErrors(
  nodes: TestFlowGraphNode[],
  outgoingByNodeId: Map<string, TestFlowGraphEdge[]>,
  loopConfigByNodeId: Map<string, ParsedLoopConfig>,
  nodeById: Map<string, TestFlowGraphNode>,
  errors: TestFlowValidationError[],
): void {
  for (const node of nodes) {
    if (!isLoopNodeType(node.nodeType)) continue

    const loopConfig = loopConfigByNodeId.get(node.id)
    if (!loopConfig) continue

    const outgoing = outgoingByNodeId.get(node.id) ?? []
    const allowedHandles = new Set<string>([
      LOOP_BODY_BRANCH_ID,
      LOOP_DONE_BRANCH_ID,
      ...loopConfig.breakExitIds,
    ])

    collectHandledOutgoingErrors(node.id, node.label, outgoing, allowedHandles, 'loop', errors)

    const bodyNodeSet = new Set(loopConfig.bodyNodeIds)
    const loopEdges = outgoing.filter((edge) => edge.sourceHandle === LOOP_BODY_BRANCH_ID)
    const doneEdges = outgoing.filter((edge) => edge.sourceHandle === LOOP_DONE_BRANCH_ID)
    const breakEdges = outgoing.filter(
      (edge) => edge.sourceHandle && loopConfig.breakExitIds.includes(edge.sourceHandle),
    )

    if (loopConfig.bodyNodeIds.length > 0 && loopEdges.length === 0) {
      pushError(
        errors,
        'loop_missing_body_handle',
        `Loop node "${node.label ?? node.id}" must connect Loop handle to its body`,
        node.id,
      )
    }

    if (loopConfig.bodyNodeIds.length === 0 && loopEdges.length > 0) {
      pushError(
        errors,
        'loop_body_without_nodes',
        `Loop node "${node.label ?? node.id}" cannot use Loop handle without body nodes`,
        node.id,
      )
    }

    for (const loopEdge of loopEdges) {
      if (!bodyNodeSet.has(loopEdge.targetNodeId)) {
        pushError(
          errors,
          'loop_invalid_body_target',
          `Loop edge of "${node.label ?? node.id}" must target one of its body nodes`,
          node.id,
        )
      }
    }

    for (const exitEdge of [...doneEdges, ...breakEdges]) {
      if (bodyNodeSet.has(exitEdge.targetNodeId)) {
        pushError(
          errors,
          'loop_exit_to_body',
          `Loop exit edge of "${node.label ?? node.id}" cannot target its own body node`,
          node.id,
        )
      }
    }

    const hasIfElseInBody = loopConfig.bodyNodeIds.some((bodyNodeId) => {
      const bodyNode = nodeById.get(bodyNodeId)
      return bodyNode?.nodeType === IF_ELSE_NODE_TYPE
    })

    if (!hasIfElseInBody && breakEdges.length > 0) {
      pushError(
        errors,
        'loop_break_without_if_else',
        `Loop node "${node.label ?? node.id}" cannot use break exits without an if-else node in its body`,
        node.id,
      )
    }
  }
}

function collectInvalidSourceHandleErrors(
  nodes: TestFlowGraphNode[],
  outgoingByNodeId: Map<string, TestFlowGraphEdge[]>,
  errors: TestFlowValidationError[],
): void {
  for (const node of nodes) {
    if (node.nodeType === IF_ELSE_NODE_TYPE || isLoopNodeType(node.nodeType)) continue

    const outgoing = outgoingByNodeId.get(node.id) ?? []
    for (const edge of outgoing) {
      if (edge.sourceHandle) {
        pushError(
          errors,
          'invalid_source_handle',
          `Node "${node.label ?? node.id}" (${node.nodeType}) cannot use source handle "${edge.sourceHandle}"`,
          node.id,
        )
      }
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
  const outgoingByNodeId = groupEdgesBySource(edges)

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
    collectHandledOutgoingErrors(node.id, node.label, outgoing, allowedHandles, 'if-else', errors)
  }
}
