import { describe, expect, it } from 'vitest'

import {
  addNodeToLoopBody,
  createWorkflowNode,
  getLoopBodyGroupId,
  isValidWorkflowConnection,
  syncLoopBodyGraphLayout,
} from '@/lib/test-flow-graph'

describe('loop body connections to nested for-loop', () => {
  it('allows if-else branch to connect to for-loop in same loop body', () => {
    const outerLoop = createWorkflowNode('for-loop')
    let state = { nodes: [outerLoop] as ReturnType<typeof createWorkflowNode>[], edges: [] as import('@xyflow/react').Edge[] }

    const withIfElse = addNodeToLoopBody(outerLoop.id, 'if-else', state.nodes, state.edges)
    if (!withIfElse) throw new Error('failed to add if-else')
    state = withIfElse

    const withForLoop = addNodeToLoopBody(outerLoop.id, 'for-loop', state.nodes, state.edges)
    if (!withForLoop) throw new Error('failed to add for-loop')
    state = syncLoopBodyGraphLayout(withForLoop.nodes, withForLoop.edges)

    const ifElse = state.nodes.find((n) => (n.data as { nodeType?: string }).nodeType === 'if-else')
    const innerForLoop = state.nodes.find(
      (n) => n.id !== outerLoop.id && (n.data as { nodeType?: string }).nodeType === 'for-loop',
    )
    expect(ifElse).toBeDefined()
    expect(innerForLoop).toBeDefined()

    const connection = {
      source: ifElse!.id,
      target: innerForLoop!.id,
      sourceHandle: 'true',
    }

    expect(isValidWorkflowConnection(connection, state.nodes, state.edges)).toBe(true)
  })

  it('allows connection when nested for-loop has loop-back incoming edge', () => {
    const outerLoop = createWorkflowNode('for-loop')
    const ifElse = createWorkflowNode('if-else')
    const innerForLoop = createWorkflowNode('for-loop')
    const innerScript = createWorkflowNode('script')
    const groupId = getLoopBodyGroupId(outerLoop.id)
    const innerGroupId = getLoopBodyGroupId(innerForLoop.id)

    ifElse.parentId = groupId
    innerForLoop.parentId = groupId
    innerScript.parentId = innerGroupId

    outerLoop.data = {
      ...outerLoop.data,
      config: { bodyNodeIds: [ifElse.id, innerForLoop.id], breakExits: [] },
    }
    innerForLoop.data = {
      ...innerForLoop.data,
      config: { bodyNodeIds: [innerScript.id], breakExits: [] },
    }

    let state = syncLoopBodyGraphLayout(
      [outerLoop, ifElse, innerForLoop, innerScript],
      [],
    )

    const loopBackToInner = state.edges.filter((e) => e.target === innerForLoop.id)
    expect(loopBackToInner.length).toBeGreaterThan(0)

    const connection = {
      source: ifElse.id,
      target: innerForLoop.id,
      sourceHandle: 'true',
    }

    expect(isValidWorkflowConnection(connection, state.nodes, state.edges)).toBe(true)
  })
})
