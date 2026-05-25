import { useNavigate } from '@tanstack/react-router'
import { cloneGraphWithFreshIds } from '@/lib/test-flow-graph'

import {
  useCreateTestFlow,
  useSaveTestFlowGraph,
  useUpdateTestFlow,
} from '@/queries/test-flow-queries'
import type {
  TestFlowEditorFormData,
  TestFlowEditorPageResult,
  TestFlowGraph,
  UseTestFlowEditorPageOptions,
} from '@/types'

export const TEST_FLOW_EDITOR_LAYOUT_CLASS =
  'min-h-[calc(100dvh-4rem)] rounded-none border-x-0 border-t-0 shadow-none lg:min-h-[calc(100dvh-7rem)] lg:rounded-xl lg:border lg:shadow-sm'

export function useTestFlowEditorPage(
  options: UseTestFlowEditorPageOptions,
): TestFlowEditorPageResult {
  const navigate = useNavigate()

  const createMutation = useCreateTestFlow({
    onSuccess: () => navigate({ to: '/test-flow' }),
  })

  const updateMutation = useUpdateTestFlow()
  const saveGraphMutation = useSaveTestFlowGraph({
    onSuccess: () => navigate({ to: '/test-flow' }),
  })

  const handleCancel = () => navigate({ to: '/test-flow' })

  const isSubmitting =
    options.mode === 'create'
      ? createMutation.isPending
      : updateMutation.isPending || saveGraphMutation.isPending

  const handleSubmit = (formData: TestFlowEditorFormData, graph: TestFlowGraph) => {
    const persistedGraph = cloneGraphWithFreshIds(graph)

    if (options.mode === 'create') {
      createMutation.mutate({
        name: formData.name,
        description: formData.description || undefined,
        isActive: formData.isActive,
        graph: persistedGraph,
      })
      return
    }

    updateMutation.mutate({
      id: options.id,
      data: {
        name: formData.name,
        description: formData.description || undefined,
        isActive: formData.isActive,
      },
    })
    saveGraphMutation.mutate({ id: options.id, graph: persistedGraph })
  }

  return {
    handleCancel,
    handleSubmit,
    isSubmitting,
    layoutClassName: TEST_FLOW_EDITOR_LAYOUT_CLASS,
  }
}
