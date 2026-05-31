import { describe, expect, it } from 'vitest'
import type { Connection, Edge, Node } from '@xyflow/react'

import {
  DEFAULT_IF_ELSE_BRANCHES,
  LOOP_BODY_BRANCH_ID,
  LOOP_BODY_GROUP_NODE_TYPE,
  connectEdge,
  createWorkflowNode,
  getLoopBodyGroupId,
  isLoopBodyBreakTargetEdge,
  isUiOnlyEdge,
  isValidWorkflowConnection,
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
