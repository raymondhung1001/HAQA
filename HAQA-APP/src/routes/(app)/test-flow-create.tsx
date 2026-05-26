import { createFileRoute } from '@tanstack/react-router'

import { Navigation } from '@/components/navigation'
import { TestFlowEditor } from '@/components/test-flow-editor'
import { useTestFlowEditorPage } from '@/lib/hooks'

const CreateTestFlowPage = () => {
  const { handleCancel, handleSubmit, isSubmitting, layoutClassName } = useTestFlowEditorPage({
    mode: 'create',
  })

  return (
    <Navigation>
      <div className="-mx-4 -my-6 sm:-mx-6 lg:-mx-8 lg:-my-8">
        <TestFlowEditor
          title="Create New Test Flow"
          submitLabel="Create Test Flow"
          initialFormData={{ name: '', description: '', isActive: true }}
          isSubmitting={isSubmitting}
          className={layoutClassName}
          onCancel={handleCancel}
          onSubmit={handleSubmit}
        />
      </div>
    </Navigation>
  )
}

export const Route = createFileRoute('/(app)/test-flow-create')({
  component: CreateTestFlowPage,
})
