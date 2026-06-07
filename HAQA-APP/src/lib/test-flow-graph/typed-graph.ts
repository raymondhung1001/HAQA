import type { Edge, Node } from '@xyflow/react'

import type { TestFlowNodeType, WorkflowNodeData } from './types'

export type WorkflowRFNode = Node<WorkflowNodeData>
export type WorkflowRFEdge = Edge

export const toWorkflowNodeData = (node: Node): WorkflowNodeData => {
  return (node.data ?? {}) as WorkflowNodeData
}

export const getWorkflowNodeType = (node: Node): TestFlowNodeType | undefined => {
  return toWorkflowNodeData(node).nodeType
}

export const isWorkflowNodeType = (
  node: Node,
  nodeType: TestFlowNodeType,
): boolean => {
  return getWorkflowNodeType(node) === nodeType
}
