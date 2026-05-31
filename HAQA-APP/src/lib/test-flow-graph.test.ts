import { describe, expect, it } from 'vitest'
import type { Connection, Edge, Node } from '@xyflow/react'

import {
  DEFAULT_IF_ELSE_BRANCHES,
  LOOP_BODY_BRANCH_ID,
  LOOP_BODY_GROUP_NODE_TYPE,
  collectCascadeDeletionIds,
  connectEdge,
  createWorkflowNode,
  deleteWorkflowNodes,
  getLoopBodyGroupId,
  isLoopBodyBreakTargetEdge,
  isUiOnlyEdge,
  isValidWorkflowConnection,
  reactFlowToGraph,
  syncLoopBodyGraphLayout,
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

describe('isValidWorkflowConnection with edges', () => {
  it('rejects duplicate if-else branch handle usage', () => {
    const ifElse = createWorkflowNode('if-else')
    const scriptA = createWorkflowNode('script')
    const scriptB = createWorkflowNode('script')
    const nodes = [ifElse, scriptA, scriptB]
    const edges = [makeEdge(ifElse.id, scriptA.id, { sourceHandle: 'true' })]

    const connection: Connection = {
      source: ifElse.id,
      target: scriptB.id,
      sourceHandle: 'true',
    }

    expect(isValidWorkflowConnection(connection, nodes, edges)).toBe(false)
  })

  it('rejects a second incoming edge to a non-end node', () => {
    const start = createWorkflowNode('start')
    const script = createWorkflowNode('script')
    const scriptB = createWorkflowNode('script')
    const nodes = [start, script, scriptB]
    const edges = [makeEdge(start.id, script.id)]

    const connection: Connection = {
      source: start.id,
      target: script.id,
    }

    expect(isValidWorkflowConnection(connection, nodes, edges)).toBe(false)
  })

  it('rejects a second outgoing edge from a linear node', () => {
    const start = createWorkflowNode('start')
    const scriptA = createWorkflowNode('script')
    const scriptB = createWorkflowNode('script')
    const nodes = [start, scriptA, scriptB]
    const edges = [makeEdge(start.id, scriptA.id)]

    const connection: Connection = {
      source: start.id,
      target: scriptB.id,
    }

    expect(isValidWorkflowConnection(connection, nodes, edges)).toBe(false)
  })

  it('rejects loop body member connections to main canvas nodes', () => {
    const loop = createWorkflowNode('for-loop')
    const bodyScript = createWorkflowNode('script')
    const canvasScript = createWorkflowNode('script')
    const groupId = getLoopBodyGroupId(loop.id)

    loop.data = {
      ...loop.data,
      config: {
        bodyNodeIds: [bodyScript.id],
        breakExits: [],
      },
    }
    bodyScript.parentId = groupId

    const nodes = [loop, bodyScript, canvasScript]
    const connection: Connection = {
      source: bodyScript.id,
      target: canvasScript.id,
    }

    expect(isValidWorkflowConnection(connection, nodes, [])).toBe(false)
  })
})

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

describe('connectEdge duplicate guard', () => {
  it('does not add duplicate edges', () => {
    const start = createWorkflowNode('start')
    const end = createWorkflowNode('end')
    const nodes = [start, end]
    const edges = [makeEdge(start.id, end.id)]

    const next = connectEdge({ source: start.id, target: end.id }, edges, nodes)

    expect(next).toHaveLength(1)
  })
})

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

  it('creates workflow nodes without forcing deletable false on start/end', () => {
    expect(createWorkflowNode('start').deletable).toBeUndefined()
    expect(createWorkflowNode('end').deletable).toBeUndefined()
    expect(createWorkflowNode('script').deletable).toBeUndefined()
  })
})
