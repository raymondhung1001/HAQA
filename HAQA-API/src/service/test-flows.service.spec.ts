import { BadRequestException } from '@nestjs/common'

import { TestFlowsService } from './test-flows.service'
import type { TestFlowGraphDto } from './test-flow-graph.types'

describe('TestFlowsService.validateGraph', () => {
  const service = new TestFlowsService({} as never, {} as never)

  const invokeValidateGraph = (graph: TestFlowGraphDto): void => {
    ;(service as unknown as { validateGraph(graph: TestFlowGraphDto): void }).validateGraph(graph)
  }

  it('rejects loop body node outgoing edges to main canvas', () => {
    const graph: TestFlowGraphDto = {
      nodes: [
        { id: 'start-1', nodeType: 'start' },
        { id: 'loop-1', nodeType: 'for-loop', config: { bodyNodeIds: ['script-1'] } },
        { id: 'script-1', nodeType: 'script' },
        { id: 'script-2', nodeType: 'script' },
        { id: 'end-1', nodeType: 'end' },
      ],
      edges: [
        { id: 'e1', sourceNodeId: 'start-1', targetNodeId: 'loop-1' },
        { id: 'e2', sourceNodeId: 'loop-1', targetNodeId: 'script-1', sourceHandle: 'loop' },
        { id: 'e3', sourceNodeId: 'script-1', targetNodeId: 'script-2' },
        { id: 'e4', sourceNodeId: 'script-2', targetNodeId: 'end-1' },
      ],
    }

    expect(() => invokeValidateGraph(graph)).toThrow(BadRequestException)
    expect(() => invokeValidateGraph(graph)).toThrow(
      /cannot connect outside its loop body except through loop break\/done handles/,
    )
  })
})
