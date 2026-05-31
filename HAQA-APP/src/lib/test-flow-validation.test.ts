import { describe, expect, it } from 'vitest'

import {
  DEFAULT_IF_ELSE_BRANCHES,
  type TestFlowGraph,
  type TestFlowGraphEdge,
  type TestFlowGraphNode,
  type TestFlowNodeType,
} from '@/lib/test-flow-graph'
import {
  validateTestFlowGraph,
  type TestFlowValidationErrorCode,
} from '@/lib/test-flow-validation'

type GraphNodeSpec = {
  id: string
  nodeType: TestFlowNodeType
  label?: string
  config?: Record<string, unknown>
}

type GraphEdgeSpec = {
  source: string
  target: string
  sourceHandle?: string
}

function makeGraph(nodes: GraphNodeSpec[], edges: GraphEdgeSpec[] = []): TestFlowGraph {
  const graphNodes: TestFlowGraphNode[] = nodes.map((node) => ({
    id: node.id,
    nodeType: node.nodeType,
    label: node.label ?? node.nodeType,
    config: node.config,
  }))

  const graphEdges: TestFlowGraphEdge[] = edges.map((edge, index) => ({
    id: `edge-${index}`,
    sourceNodeId: edge.source,
    targetNodeId: edge.target,
    sourceHandle: edge.sourceHandle,
  }))

  return { nodes: graphNodes, edges: graphEdges }
}

function expectInvalid(graph: TestFlowGraph, code: TestFlowValidationErrorCode) {
  const result = validateTestFlowGraph(graph)
  expect(result.valid).toBe(false)
  expect(result.errors.some((error) => error.code === code)).toBe(true)
  return result
}

const defaultIfElseBranches = { branches: DEFAULT_IF_ELSE_BRANCHES }

describe('validateTestFlowGraph', () => {
  it('accepts a valid default start to end graph', () => {
    const graph = makeGraph(
      [
        { id: 'start-1', nodeType: 'start' },
        { id: 'end-1', nodeType: 'end' },
      ],
      [{ source: 'start-1', target: 'end-1' }],
    )

    const result = validateTestFlowGraph(graph)

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('fails when the graph has no end node', () => {
    const graph = makeGraph([{ id: 'start-1', nodeType: 'start' }])

    const result = expectInvalid(graph, 'missing_end')

    expect(result.errors.some((error) => error.message.includes('at least one end node'))).toBe(
      true,
    )
  })

  it('fails when the graph has multiple start nodes', () => {
    const graph = makeGraph(
      [
        { id: 'start-1', nodeType: 'start' },
        { id: 'start-2', nodeType: 'start' },
        { id: 'end-1', nodeType: 'end' },
      ],
      [
        { source: 'start-1', target: 'end-1' },
        { source: 'start-2', target: 'end-1' },
      ],
    )

    expectInvalid(graph, 'multiple_starts')
  })

  it('fails when a cycle is detected', () => {
    const graph = makeGraph(
      [
        { id: 'start-1', nodeType: 'start' },
        { id: 'script-a', nodeType: 'script' },
        { id: 'script-b', nodeType: 'script' },
        { id: 'end-1', nodeType: 'end' },
      ],
      [
        { source: 'start-1', target: 'script-a' },
        { source: 'script-a', target: 'script-b' },
        { source: 'script-b', target: 'script-a' },
        { source: 'script-b', target: 'end-1' },
      ],
    )

    const result = expectInvalid(graph, 'cycle')

    expect(result.errors.some((error) => error.nodeId === 'script-a')).toBe(true)
  })

  it('fails when a node is unreachable from start', () => {
    const graph = makeGraph(
      [
        { id: 'start-1', nodeType: 'start' },
        { id: 'end-1', nodeType: 'end' },
        { id: 'orphan-script', nodeType: 'script', label: 'orphan-script' },
      ],
      [{ source: 'start-1', target: 'end-1' }],
    )

    const result = expectInvalid(graph, 'unreachable')

    expect(result.errors.some((error) => error.nodeId === 'orphan-script')).toBe(true)
  })

  it('fails when a non-end node has multiple incoming edges', () => {
    const graph = makeGraph(
      [
        { id: 'start-1', nodeType: 'start' },
        {
          id: 'if-else-1',
          nodeType: 'if-else',
          config: defaultIfElseBranches,
        },
        { id: 'script-yes', nodeType: 'script' },
        { id: 'script-no', nodeType: 'script' },
        { id: 'merge-script', nodeType: 'script', label: 'merge-script' },
        { id: 'end-1', nodeType: 'end' },
      ],
      [
        { source: 'start-1', target: 'if-else-1' },
        { source: 'if-else-1', target: 'script-yes', sourceHandle: 'true' },
        { source: 'if-else-1', target: 'script-no', sourceHandle: 'false' },
        { source: 'script-yes', target: 'merge-script' },
        { source: 'script-no', target: 'merge-script' },
        { source: 'merge-script', target: 'end-1' },
      ],
    )

    const result = expectInvalid(graph, 'tree_incoming_edge')

    expect(result.errors.some((error) => error.nodeId === 'merge-script')).toBe(true)
  })

  it('allows multiple incoming edges to end nodes', () => {
    const graph = makeGraph(
      [
        { id: 'start-1', nodeType: 'start' },
        {
          id: 'if-else-1',
          nodeType: 'if-else',
          config: defaultIfElseBranches,
        },
        { id: 'script-yes', nodeType: 'script' },
        { id: 'script-no', nodeType: 'script' },
        { id: 'end-1', nodeType: 'end' },
      ],
      [
        { source: 'start-1', target: 'if-else-1' },
        { source: 'if-else-1', target: 'script-yes', sourceHandle: 'true' },
        { source: 'if-else-1', target: 'script-no', sourceHandle: 'false' },
        { source: 'script-yes', target: 'end-1' },
        { source: 'script-no', target: 'end-1' },
      ],
    )

    const result = validateTestFlowGraph(graph)

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('fails when the start node has an incoming edge', () => {
    const graph = makeGraph(
      [
        { id: 'start-1', nodeType: 'start' },
        { id: 'script-1', nodeType: 'script' },
        { id: 'end-1', nodeType: 'end' },
      ],
      [
        { source: 'script-1', target: 'start-1' },
        { source: 'start-1', target: 'end-1' },
      ],
    )

    expectInvalid(graph, 'start_incoming_edge')
  })
})
