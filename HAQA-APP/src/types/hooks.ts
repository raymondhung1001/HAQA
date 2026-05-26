import type { ComponentType, Dispatch, SetStateAction } from 'react'
import type { Node, Edge, Connection, NodeChange, EdgeChange } from '@xyflow/react'

import type { TestFlowFilters, SearchTestFlowsParams } from '@/types/test-flow'
import type { TestFlowEditorPageResult, UseTestFlowEditorPageOptions } from '@/types/editor'
import type {
  TestFlowNodeType,
  WorkflowNodeData,
  IfElseBranch,
  LoopBodyStep,
} from '@/lib/test-flow-graph'
import type { ScriptLanguage } from '@/types/workflow'

export interface UseTestFlowFiltersReturn {
  filters: TestFlowFilters
  debouncedSearchQuery: string
  searchParams: SearchTestFlowsParams
  setSearchQuery: (query: string) => void
  setPage: (page: number) => void
  setLimit: (limit: number) => void
  setSortBy: (sortBy: TestFlowFilters['sortBy']) => void
  reset: () => void
}

export type UseTestFlowEditorPage = (
  options: UseTestFlowEditorPageOptions,
) => TestFlowEditorPageResult

export interface UseWorkflowGraphOptions {
  initialNodes?: Node[]
  initialEdges?: Edge[]
}

export interface UseWorkflowGraphReturn {
  nodes: Node[]
  edges: Edge[]
  flowNodes: Node[]
  flowEdges: Edge[]
  editorNodeTypes: Record<string, ComponentType<unknown>>
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (connection: Connection) => void
  startNodeExists: boolean
  endNodeExists: boolean
  editingNode: Node | null
  editingNodeId: string | null
  openNodeEditor: (nodeId: string) => void
  closeNodeEditor: () => void
  setEditingNodeId: Dispatch<SetStateAction<string | null>>
  handleAddNode: (nodeType: TestFlowNodeType) => void
  handleUpdateNode: (nodeId: string, updates: Partial<WorkflowNodeData>) => void
  handleAddLoopBodyNode: (loopNodeId: string, nodeType: TestFlowNodeType) => void
  handleRemoveLoopBodyNode: (loopNodeId: string, bodyNodeId: string) => void
  handleReorderLoopBodyNode: (loopNodeId: string, fromIndex: number, toIndex: number) => void
}

export interface UseWorkflowNodeEditorFormReturn {
  nodeType: TestFlowNodeType
  nodeData: WorkflowNodeData
  label: string
  setLabel: Dispatch<SetStateAction<string>>
  description: string
  setDescription: Dispatch<SetStateAction<string>>
  scriptLanguage: ScriptLanguage
  setScriptLanguage: Dispatch<SetStateAction<ScriptLanguage>>
  scriptContent: string
  setScriptContent: Dispatch<SetStateAction<string>>
  branches: IfElseBranch[]
  breakExits: IfElseBranch[]
  isIfElseNode: boolean
  isLoopNode: boolean
  loopBodySteps: LoopBodyStep[]
  minIfElseBranches: number
  handleBranchLabelChange: (branchId: string, nextLabel: string) => void
  handleLoopBreakLabelChange: (branchId: string, nextLabel: string) => void
  handleAddBranch: () => void
  handleRemoveBranch: (branchId: string) => void
  buildSavePayload: () => Partial<WorkflowNodeData> | null
}
