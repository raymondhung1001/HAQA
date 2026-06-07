import { describe, expect, it } from 'vitest'

import {
  LOOP_BODY_BRANCH_ID,
  collectCascadeDeletionIds,
  createWorkflowNode,
  deleteWorkflowNodes,
  isValidWorkflowConnection,
  syncLoopBodyGraphLayout,
} from '@/lib/test-flow-graph'

function makeEdge(
  source: string,
  target: string,
  options: { sourceHandle?: string } = {},
) {
  return {
    id: `${source}-${target}`,
    source,
    target,
    ...options,
  }
}

describe('deleteWorkflowNodes', () => {
  it('allows deletion of start and end nodes', () => {
    const start = createWorkflowNode('start')
    const end = createWorkflowNode('end')
    const script = createWorkflowNode('script')
    const nodes = [start, script, end]
    const edges = [
      makeEdge(start.id, script.id),
      makeEdge(script.id, end.id),
    ]

    const result = deleteWorkflowNodes([start.id, end.id], nodes, edges)

    expect(result.blocked.loopBodyGroup).toBe(false)
    expect(result.deletedNodeIds).toEqual(expect.arrayContaining([start.id, end.id]))
    expect(result.nodes).toHaveLength(1)
    expect(result.nodes[0]?.id).toBe(script.id)
  })

  it('cascades loop deletion to all body steps', () => {
    const start = createWorkflowNode('start', { x: 0, y: 0 })
    const loop = createWorkflowNode('for-loop', { x: 200, y: 0 })
    const bodyScript = createWorkflowNode('script', { x: 0, y: 0 })
    const end = createWorkflowNode('end', { x: 400, y: 0 })

    loop.data = {
      ...loop.data,
      config: {
        bodyNodeIds: [bodyScript.id],
        breakExits: [],
      },
    }

    const layout = syncLoopBodyGraphLayout(
      [start, loop, bodyScript, end],
      [
        makeEdge(start.id, loop.id),
        makeEdge(loop.id, bodyScript.id, { sourceHandle: LOOP_BODY_BRANCH_ID }),
      ],
    )

    const result = deleteWorkflowNodes([loop.id], layout.nodes, layout.edges)

    expect(result.deletedNodeIds).toContain(loop.id)
    expect(result.deletedNodeIds).toContain(bodyScript.id)
    expect(result.nodes.some((node) => node.id === bodyScript.id)).toBe(false)
    expect(result.nodes.some((node) => node.id === loop.id)).toBe(false)
    expect(result.nodes.some((node) => node.id === start.id)).toBe(true)
  })

  it('removes a loop body step through removeNodeFromLoopBody semantics', () => {
    const loop = createWorkflowNode('for-loop', { x: 0, y: 0 })
    const bodyA = createWorkflowNode('script', { x: 0, y: 0 })
    const bodyB = createWorkflowNode('script', { x: 100, y: 0 })

    loop.data = {
      ...loop.data,
      config: {
        bodyNodeIds: [bodyA.id, bodyB.id],
        breakExits: [],
      },
    }

    const layout = syncLoopBodyGraphLayout(
      [loop, bodyA, bodyB],
      [
        makeEdge(loop.id, bodyA.id, { sourceHandle: LOOP_BODY_BRANCH_ID }),
        makeEdge(bodyA.id, bodyB.id),
      ],
    )

    const result = deleteWorkflowNodes([bodyA.id], layout.nodes, layout.edges)

    expect(result.deletedNodeIds).toEqual([bodyA.id])
    expect(result.nodes.some((node) => node.id === bodyA.id)).toBe(false)
    expect(result.nodes.some((node) => node.id === bodyB.id)).toBe(true)

    const updatedLoop = result.nodes.find((node) => node.id === loop.id)
    expect(updatedLoop?.data?.config?.bodyNodeIds).toEqual([bodyB.id])
  })

  it('allows remaining loop body steps to reconnect after deleting a middle step', () => {
    const loop = createWorkflowNode('for-loop', { x: 0, y: 0 })
    const bodyA = createWorkflowNode('script', { x: 0, y: 0 })
    const bodyB = createWorkflowNode('script', { x: 100, y: 0 })
    const bodyC = createWorkflowNode('script', { x: 200, y: 0 })

    loop.data = {
      ...loop.data,
      config: {
        bodyNodeIds: [bodyA.id, bodyB.id, bodyC.id],
        breakExits: [],
      },
    }

    const layout = syncLoopBodyGraphLayout(
      [loop, bodyA, bodyB, bodyC],
      [
        makeEdge(loop.id, bodyA.id, { sourceHandle: LOOP_BODY_BRANCH_ID }),
        makeEdge(bodyA.id, bodyB.id),
        makeEdge(bodyB.id, bodyC.id),
      ],
    )

    const deleted = deleteWorkflowNodes([bodyB.id], layout.nodes, layout.edges)

    expect(deleted.nodes.some((node) => node.id === bodyB.id)).toBe(false)
    expect(deleted.edges.some((edge) => edge.source === bodyA.id && edge.target === bodyB.id)).toBe(false)
    expect(deleted.edges.some((edge) => edge.source === bodyB.id && edge.target === bodyC.id)).toBe(false)
    expect(
      isValidWorkflowConnection(
        { source: bodyA.id, target: bodyC.id },
        deleted.nodes,
        deleted.edges,
      ),
    ).toBe(true)
  })

  it('collects nested loop body members when deleting an outer loop', () => {
    const outerLoop = createWorkflowNode('for-loop')
    const innerLoop = createWorkflowNode('for-loop')
    const innerBody = createWorkflowNode('script')

    outerLoop.data = {
      ...outerLoop.data,
      config: { bodyNodeIds: [innerLoop.id], breakExits: [] },
    }
    innerLoop.data = {
      ...innerLoop.data,
      config: { bodyNodeIds: [innerBody.id], breakExits: [] },
    }

    const cascade = collectCascadeDeletionIds(outerLoop.id, [outerLoop, innerLoop, innerBody])

    expect(cascade).toEqual(expect.arrayContaining([outerLoop.id, innerLoop.id, innerBody.id]))
    expect(cascade).toHaveLength(3)
  })

  it('handles loop containment cycles without infinite recursion', () => {
    const loopA = createWorkflowNode('for-loop')
    const loopB = createWorkflowNode('for-loop')

    loopA.data = {
      ...loopA.data,
      config: { bodyNodeIds: [loopB.id], breakExits: [] },
    }
    loopB.data = {
      ...loopB.data,
      config: { bodyNodeIds: [loopA.id], breakExits: [] },
    }

    const cascade = collectCascadeDeletionIds(loopA.id, [loopA, loopB])

    expect(cascade).toEqual(expect.arrayContaining([loopA.id, loopB.id]))
    expect(cascade).toHaveLength(2)
  })

  it('creates workflow nodes without forcing deletable false on start/end', () => {
    expect(createWorkflowNode('start').deletable).toBeUndefined()
    expect(createWorkflowNode('end').deletable).toBeUndefined()
    expect(createWorkflowNode('script').deletable).toBeUndefined()
  })
})
