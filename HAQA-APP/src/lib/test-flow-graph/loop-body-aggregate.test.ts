import { describe, expect, it } from 'vitest'

import {
  LOOP_BODY_BRANCH_ID,
  LoopBodyAggregate,
  createWorkflowNode,
  layoutLoopBodyNodes,
  syncLoopBodyEdges,
} from '@/lib/test-flow-graph'

describe('LoopBodyAggregate business invariants', () => {
  it('clears break exits when loop body has no if-else node', () => {
    const loop = createWorkflowNode('for-loop')
    const body = createWorkflowNode('script')
    loop.data = {
      ...loop.data,
      config: {
        bodyNodeIds: [body.id],
        breakExits: [{ id: 'break-1', label: 'Break 1' }],
      },
    }

    const aggregate = new LoopBodyAggregate(
      { layoutLoopBodyNodes, syncLoopBodyEdges },
      { nodes: [loop, body], edges: [] },
    )

    const result = aggregate.applyLoopBodyUpdate(loop.id, [body.id])
    const updatedLoop = result.nodes.find((node) => node.id === loop.id)
    const breakExits =
      (updatedLoop?.data as { config?: { breakExits?: unknown[] } } | undefined)?.config
        ?.breakExits ?? []

    expect(Array.isArray(breakExits)).toBe(true)
    expect(breakExits).toHaveLength(0)
  })

  it('appends connected target into loop body when using loop handle', () => {
    const loop = createWorkflowNode('for-loop')
    const body = createWorkflowNode('script')
    loop.data = {
      ...loop.data,
      config: {
        bodyNodeIds: [],
        breakExits: [],
      },
    }

    const aggregate = new LoopBodyAggregate(
      { layoutLoopBodyNodes, syncLoopBodyEdges },
      { nodes: [loop, body], edges: [] },
    )

    const result = aggregate.appendTargetToLoopBodyOnConnect({
      source: loop.id,
      target: body.id,
      sourceHandle: LOOP_BODY_BRANCH_ID,
    })

    const updatedLoop = result.nodes.find((node) => node.id === loop.id)
    const bodyNodeIds =
      (updatedLoop?.data as { config?: { bodyNodeIds?: string[] } } | undefined)?.config
        ?.bodyNodeIds ?? []

    expect(bodyNodeIds).toContain(body.id)
  })
})
