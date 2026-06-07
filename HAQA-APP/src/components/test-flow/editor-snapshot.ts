import type { Edge, Node } from '@xyflow/react'

import { reactFlowToGraph } from '@/lib/test-flow-graph'
import type { TestFlowEditorFormData } from '@/types'

export const serializeEditorSnapshot = (
  formData: TestFlowEditorFormData,
  nodes: Node[],
  edges: Edge[],
): string => {
  return JSON.stringify({
    formData,
    graph: reactFlowToGraph(nodes, edges),
  })
}
