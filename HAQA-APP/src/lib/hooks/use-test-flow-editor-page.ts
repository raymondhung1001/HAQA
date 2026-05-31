import { useCallback, useState } from 'react'
import { useBlocker, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'

import { parseApiErrorMessage } from '@/lib/parse-api-error'
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

export const useTestFlowEditorPage = (
  options: UseTestFlowEditorPageOptions,
): TestFlowEditorPageResult => {
  const navigate = useNavigate()
  const [isDirty, setIsDirty] = useState(false)

  const navigateToList = useCallback(() => {
    navigate({ to: '/test-flow', replace: true })
  }, [navigate])

  const createMutation = useCreateTestFlow({
    onError: (error) => {
      toast.error(parseApiErrorMessage(error, 'Failed to create test flow'))
    },
  })

  const updateMutation = useUpdateTestFlow({
    onError: (error) => {
      toast.error(
        `Failed to save flow details: ${parseApiErrorMessage(error, 'Could not update metadata')}`,
      )
    },
  })

  const saveGraphMutation = useSaveTestFlowGraph({
    onError: (error) => {
      toast.error(
        `Failed to save workflow graph: ${parseApiErrorMessage(error, 'Could not save graph')}`,
      )
    },
  })

  useBlocker({
    shouldBlockFn: () => {
      if (!isDirty) return false
      return !window.confirm('You have unsaved changes. Leave without saving?')
    },
    enableBeforeUnload: isDirty,
  })

  const handleCancel = useCallback(() => {
    if (
      isDirty &&
      !window.confirm('You have unsaved changes. Leave without saving?')
    ) {
      return
    }
    navigateToList()
  }, [isDirty, navigateToList])

  const isSubmitting =
    options.mode === 'create'
      ? createMutation.isPending
      : updateMutation.isPending || saveGraphMutation.isPending

  const handleSubmit = async (formData: TestFlowEditorFormData, graph: TestFlowGraph) => {
    const flowDetails = {
      name: formData.name,
      description: formData.description || undefined,
      isActive: formData.isActive,
    }

    if (options.mode === 'create') {
      try {
        await createMutation.mutateAsync({
          ...flowDetails,
          graph: cloneGraphWithFreshIds(graph),
        })
        toast.success('Test flow created successfully')
        navigateToList()
      } catch {
        // onError toast already shown
      }
      return
    }

    try {
      await updateMutation.mutateAsync({
        id: options.id,
        data: flowDetails,
      })
    } catch {
      return
    }

    try {
      await saveGraphMutation.mutateAsync({ id: options.id, graph })
      toast.success('Test flow saved successfully')
      navigateToList()
    } catch {
      // Partial failure: metadata saved but graph failed — onError toast already shown
    }
  }

  return {
    handleCancel,
    handleSubmit,
    isSubmitting,
    isDirty,
    setIsDirty,
    layoutClassName: TEST_FLOW_EDITOR_LAYOUT_CLASS,
  }
}
