import { describe, expect, it } from 'vitest'
import type { Connection, Edge } from '@xyflow/react'

import {
  connectEdge,
  createWorkflowNode,
  getLoopBodyGroupId,
  isValidWorkflowConnection,
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
