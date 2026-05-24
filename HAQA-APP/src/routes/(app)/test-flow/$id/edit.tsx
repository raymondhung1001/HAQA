import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Container } from '@/components/ui/container'
import { Navigation } from '@/components/navigation'
import { TestFlowEditor } from '@/components/test-flow-editor'
import {
  useTestFlow,
  useUpdateTestFlow,
  useSaveTestFlowGraph,
} from '@/queries/test-flow-queries'
import { graphToReactFlow } from '@/lib/test-flow-graph'

export const Route = createFileRoute('/(app)/test-flow/$id/edit')({
  component: EditTestFlowPage,
})

function EditTestFlowPage() {
  const navigate = useNavigate()
  const { id } = Route.useParams()
  const { data, isLoading, error } = useTestFlow(id)

  const updateMutation = useUpdateTestFlow()
  const saveGraphMutation = useSaveTestFlowGraph({
    onSuccess: () => {
      navigate({ to: '/test-flow' })
    },
  })

  if (isLoading) {
    return (
      <Navigation>
        <Container size="2xl">
          <p className="text-gray-600 dark:text-gray-400">Loading test flow...</p>
        </Container>
      </Navigation>
    )
  }

  if (error || !data) {
    return (
      <Navigation>
        <Container size="2xl">
          <p className="text-red-600">Failed to load test flow.</p>
        </Container>
      </Navigation>
    )
  }

  const { nodes, edges } = graphToReactFlow(data.latestVersion)

  return (
    <Navigation>
      <Container size="2xl">
        <TestFlowEditor
          title="Edit Test Flow"
          submitLabel="Save New Version"
          initialFormData={{
            name: data.name,
            description: data.description ?? '',
            isActive: data.isActive ?? true,
          }}
          initialNodes={nodes}
          initialEdges={edges}
          isSubmitting={updateMutation.isPending || saveGraphMutation.isPending}
          onCancel={() => navigate({ to: '/test-flow' })}
          onSubmit={(formData, graph) => {
            updateMutation.mutate({
              id,
              data: {
                name: formData.name,
                description: formData.description || undefined,
                isActive: formData.isActive,
              },
            })
            saveGraphMutation.mutate({ id, graph })
          }}
        />
        {data.latestVersion && (
          <p className="text-xs text-gray-500 mt-2">
            Current version: v{data.latestVersion.versionNumber}. Saving creates a new version snapshot.
          </p>
        )}
      </Container>
    </Navigation>
  )
}
