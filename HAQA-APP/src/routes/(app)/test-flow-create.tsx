import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Container } from '@/components/ui/container'
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
      <Container size="2xl">
        <TestFlowEditor
          title="Create New Test Flow"
          submitLabel="Create Test Flow"
          initialFormData={{ name: '', description: '', isActive: true }}
          isSubmitting={createMutation.isPending}
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
      </Container>
    </Navigation>
  )
}
