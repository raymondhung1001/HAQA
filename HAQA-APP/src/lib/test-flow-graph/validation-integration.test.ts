import { describe, expect, it } from 'vitest'
import type { Edge } from '@xyflow/react'

import {
  DEFAULT_IF_ELSE_BRANCHES,
  LOOP_BODY_BRANCH_ID,
  LOOP_BODY_GROUP_NODE_TYPE,
  createWorkflowNode,
  getLoopBodyGroupId,
  reactFlowToGraph,
} from '@/lib/test-flow-graph'
import { validateTestFlowGraph } from '@/lib/test-flow-validation'

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

describe('validateTestFlowGraph break wiring', () => {
  it('accepts a loop break exit wired to the main flow', () => {
    const start = { ...createWorkflowNode('start', { x: 0, y: 0 }), id: 'start-1' }
    const end = { ...createWorkflowNode('end', { x: 500, y: 0 }), id: 'end-1' }
    const loopId = 'loop-1'
    const groupId = getLoopBodyGroupId(loopId)
    const ifElseId = 'if-else-1'

    const graph = reactFlowToGraph(
      [
        start,
        {
          ...createWorkflowNode('for-loop', { x: 200, y: 0 }),
          id: loopId,
          data: {
            nodeType: 'for-loop',
            label: 'Loop',
            config: {
              bodyNodeIds: [ifElseId],
              breakExits: [{ id: 'break-1', label: 'Break 1' }],
            },
          },
        },
        {
          id: groupId,
          type: LOOP_BODY_GROUP_NODE_TYPE,
          position: { x: 220, y: 40 },
          data: {
            loopNodeId: loopId,
            breakExits: [{ id: 'break-1', label: 'Break 1' }],
          },
        },
        {
          ...createWorkflowNode('if-else', { x: 0, y: 0 }),
          id: ifElseId,
          parentId: groupId,
          data: {
            nodeType: 'if-else',
            label: 'If / Else',
            config: { branches: DEFAULT_IF_ELSE_BRANCHES },
          },
        },
        end,
      ],
      [
        makeEdge('start-1', loopId),
        makeEdge(loopId, ifElseId, { sourceHandle: LOOP_BODY_BRANCH_ID }),
        makeEdge(ifElseId, groupId, {
          sourceHandle: 'true',
          targetHandle: 'break-1-target',
        }),
        makeEdge(groupId, 'end-1', { sourceHandle: 'break-1' }),
      ].map((edge, index) => ({ ...edge, id: `edge-${index}` })),
    )

    const result = validateTestFlowGraph(graph)

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })
})
