import type { ScriptLanguage } from '@/types/workflow'
import type { Edge, Node } from '@xyflow/react'

export type TestFlowNodeType =
  | 'start'
  | 'end'
  | 'script'
  | 'api-call'
  | 'if-else'
  | 'for-loop'
  | 'do-while'
  | 'wait'

export interface WorkflowNodeData {
  nodeType: TestFlowNodeType
  label: string
  description?: string
  scriptLanguage?: ScriptLanguage
  scriptContent?: string
  scriptDependencies?: Record<string, unknown>
  config?: Record<string, unknown>
  loopBodySteps?: LoopBodyStep[]
  onEdit?: () => void
  onSwapLeft?: () => void
  onSwapRight?: () => void
  canSwapLeft?: boolean
  canSwapRight?: boolean
  /** Canvas display name; computed when duplicate types need disambiguation. */
  displayLabel?: string
}

export interface TestFlowGraphNode {
  id: string
  nodeType: TestFlowNodeType
  label?: string
  scriptLanguage?: ScriptLanguage
  scriptContent?: string
  scriptDependencies?: Record<string, unknown>
  config?: Record<string, unknown>
  positionX?: number
  positionY?: number
}

export interface IfElseBranch {
  id: string
  label: string
}

export interface LoopBodyStep {
  id: string
  label: string
  /** Type label with optional ordinal when duplicates exist (e.g. "Script 1"). */
  displayLabel: string
  nodeType: TestFlowNodeType
  typeOrdinal?: number
}

export type DeleteWorkflowNodesResult = {
  nodes: Node[]
  edges: Edge[]
  deletedNodeIds: string[]
  blocked: {
    loopBodyGroup: boolean
  }
}

export interface TestFlowGraphEdge {
  id: string
  sourceNodeId: string
  targetNodeId: string
  sourceHandle?: string
  targetHandle?: string
  label?: string
}

export interface TestFlowGraph {
  uiLayoutJson?: Record<string, unknown> | null
  nodes: TestFlowGraphNode[]
  edges: TestFlowGraphEdge[]
}

export interface TestFlowVersionGraph {
  id: string
  testFlowId: string
  versionNumber: number
  uiLayoutJson: Record<string, unknown> | null
  nodes: TestFlowGraphNode[]
  edges: TestFlowGraphEdge[]
}

export interface TestFlowDetail {
  id: string
  name: string
  description?: string | null
  isActive?: boolean | null
  userId?: number
  createdAt?: string | null
  updatedAt?: string | null
  latestVersion: TestFlowVersionGraph | null
}
