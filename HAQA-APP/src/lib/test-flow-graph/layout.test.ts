import { describe, expect, it, vi } from 'vitest'
import type { Edge, Node } from '@xyflow/react'

import {
  createWorkflowNode,
  mergeMainFlowRelayout,
  swapAdjacentWorkflowNode,
} from '@/lib/test-flow-graph'

function makeEdge(
  source: string,
  target: string,
  options: Partial<Edge> = {},
): Edge {
  return {
    id: options.id ?? `${source}-${target}`,
    source,
    target,
    ...options,
  }
}

describe('mergeMainFlowRelayout', () => {
  it('passes current edges into loop-body synchronization', () => {
    const start = createWorkflowNode('start')
    const end = createWorkflowNode('end')
    const allNodes: Node[] = [start, end]
    const relayoutedMain: Node[] = [end, start]
    const edges: Edge[] = [makeEdge(start.id, end.id)]
    const syncStub = vi.fn((nodesInput: Node[]) => nodesInput)

    mergeMainFlowRelayout(allNodes, relayoutedMain, edges, syncStub)

    expect(syncStub).toHaveBeenCalledWith(expect.any(Array), edges)
  })
})

describe('swapAdjacentWorkflowNode', () => {
  it('relayout uses remapped edges after swap', () => {
    const start = createWorkflowNode('start', { x: 0, y: 0 })
    const script = createWorkflowNode('script', { x: 200, y: 0 })
    const end = createWorkflowNode('end', { x: 400, y: 0 })
    const nodes: Node[] = [start, script, end]
    const edges: Edge[] = [makeEdge(start.id, script.id), makeEdge(script.id, end.id)]

    const result = swapAdjacentWorkflowNode(nodes, edges, script.id, 'right')

    expect(result.edges.some((edge) => edge.source === start.id && edge.target === end.id)).toBe(
      true,
    )
    expect(
      result.edges.some((edge) => edge.source === end.id && edge.target === script.id),
    ).toBe(true)
  })
})
