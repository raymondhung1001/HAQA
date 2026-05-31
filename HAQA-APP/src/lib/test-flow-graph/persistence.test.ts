import { describe, expect, it } from 'vitest'
import type { Edge, Node } from '@xyflow/react'

import {
  DEFAULT_IF_ELSE_BRANCHES,
  LOOP_BODY_BRANCH_ID,
  LOOP_BODY_GROUP_NODE_TYPE,
  createWorkflowNode,
  getLoopBodyGroupId,
  isLoopBodyBreakTargetEdge,
  isUiOnlyEdge,
  reactFlowToGraph,
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

describe('isUiOnlyEdge / reactFlowToGraph', () => {
  it('identifies loop body break-target edges as UI-only', () => {
    const edge = makeEdge('if-else-1', 'loop-1-loop-body', {
      sourceHandle: 'true',
      targetHandle: 'break-1-target',
    })

    expect(isLoopBodyBreakTargetEdge(edge)).toBe(true)
    expect(isUiOnlyEdge(edge)).toBe(true)
  })

  it('filters break-target edges from persisted graph output', () => {
    const loopId = 'loop-1'
    const groupId = getLoopBodyGroupId(loopId)
    const ifElseId = 'if-else-1'
    const scriptId = 'script-1'
    const endNode = createWorkflowNode('end', { x: 400, y: 0 })
    const endId = endNode.id

    const nodes: Node[] = [
      {
        id: loopId,
        type: 'workflow',
        position: { x: 0, y: 0 },
        data: {
          nodeType: 'for-loop',
          label: 'Loop',
          config: {
            bodyNodeIds: [ifElseId, scriptId],
            breakExits: [{ id: 'break-1', label: 'Break 1' }],
          },
        },
      },
      {
        id: groupId,
        type: LOOP_BODY_GROUP_NODE_TYPE,
        position: { x: 0, y: 0 },
        data: {
          loopNodeId: loopId,
          breakExits: [{ id: 'break-1', label: 'Break 1' }],
        },
      },
      {
        id: ifElseId,
        type: 'workflow',
        parentId: groupId,
        position: { x: 0, y: 0 },
        data: {
          nodeType: 'if-else',
          label: 'If / Else',
          config: { branches: DEFAULT_IF_ELSE_BRANCHES },
        },
      },
      {
        id: scriptId,
        type: 'workflow',
        parentId: groupId,
        position: { x: 100, y: 0 },
        data: { nodeType: 'script', label: 'Script' },
      },
      endNode,
    ]

    const edges: Edge[] = [
      makeEdge(ifElseId, groupId, {
        sourceHandle: 'true',
        targetHandle: 'break-1-target',
      }),
      makeEdge(groupId, endId, { sourceHandle: 'break-1' }),
      makeEdge(loopId, ifElseId, { sourceHandle: LOOP_BODY_BRANCH_ID }),
    ]

    const graph = reactFlowToGraph(nodes, edges)

    expect(graph.edges.some((edge) => edge.targetNodeId.endsWith('-loop-body'))).toBe(false)
    expect(
      graph.edges.some(
        (edge) => edge.sourceNodeId === loopId && edge.sourceHandle === 'break-1',
      ),
    ).toBe(true)
  })
})
