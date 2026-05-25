import type { TestFlowGraph } from '@/lib/test-flow-graph'

export interface TestFlowEditorFormData {
  name: string
  description: string
  isActive: boolean
}

export type TestFlowEditorMode = 'create' | 'edit'

export type TestFlowEditorSubmitHandler = (
  formData: TestFlowEditorFormData,
  graph: TestFlowGraph,
) => void

export interface TestFlowEditorPageBase {
  handleCancel: () => void
  handleSubmit: TestFlowEditorSubmitHandler
  isSubmitting: boolean
  layoutClassName: string
}

export type UseTestFlowEditorPageOptions =
  | { mode: 'create' }
  | { mode: 'edit'; id: string }

export type TestFlowEditorPageResult = TestFlowEditorPageBase
