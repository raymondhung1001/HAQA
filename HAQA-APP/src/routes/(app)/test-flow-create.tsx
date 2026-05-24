import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Navigation } from '@/components/navigation'
import { TestFlowEditor } from '@/components/test-flow-editor'
import { useCreateTestFlow } from '@/queries/test-flow-queries'

export const Route = createFileRoute('/(app)/test-flow-create')({
  component: CreateTestFlowPage,
})

function CreateTestFlowPage() {
  const navigate = useNavigate()
  const createMutation = useCreateTestFlow({
    onSuccess: () => {
      navigate({ to: '/test-flow' })
    },
  })

  return (
    <Navigation>
      <div className="-mx-4 -my-6 sm:-mx-6 lg:-mx-8 lg:-my-8">
        <TestFlowEditor
          title="Create New Test Flow"
          submitLabel="Create Test Flow"
          initialFormData={{ name: '', description: '', isActive: true }}
          isSubmitting={createMutation.isPending}
          className="min-h-[calc(100dvh-4rem)] rounded-none border-x-0 border-t-0 shadow-none lg:min-h-[calc(100dvh-7rem)] lg:rounded-xl lg:border lg:shadow-sm"
          onCancel={() => navigate({ to: '/test-flow' })}
          onSubmit={(formData, graph) => {
            createMutation.mutate({
              name: formData.name,
              description: formData.description || undefined,
              isActive: formData.isActive,
              graph,
            })
          }}
        />
      </div>
    </Navigation>
  )
}
