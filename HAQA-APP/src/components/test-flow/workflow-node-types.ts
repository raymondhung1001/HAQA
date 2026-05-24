import type { Node } from '@xyflow/react'
import { WorkflowNode } from './workflow-node'

export const workflowNodeTypes = {
  workflow: WorkflowNode,
}

export const WORKFLOW_NODE_TYPE = 'workflow' as const
