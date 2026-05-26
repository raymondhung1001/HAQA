import { createFileRoute } from '@tanstack/react-router'

import { Navigation } from '@/components/navigation'
import { QueryState } from '@/components/query-state'
import { TestFlowEditor } from '@/components/test-flow-editor'
import { useTestFlowEditorPage } from '@/lib/hooks'
import { useTestFlow } from '@/queries/test-flow-queries'
import { graphToReactFlow } from '@/lib/test-flow-graph'
import type {
  TestFlowDetail,
  TestFlowEditorFormData,
  TestFlowEditorSubmitHandler,
} from '@/types'

const EditTestFlowPage = () => {
  const { id } = Route.useParams()
  const { data, isLoading, error } = useTestFlow(id)
  const { handleCancel, handleSubmit, isSubmitting, layoutClassName } = useTestFlowEditorPage({
    mode: 'edit',
    id,
  })

  return (
    <QueryState
      isLoading={isLoading}
      error={error ?? undefined}
      isEmpty={!data}
      loadingMessage="Loading test flow..."
      errorMessage="Failed to load test flow."
      emptyMessage="Test flow not found."
    >
      {data ? (
        <EditTestFlowEditor
          data={data}
          layoutClassName={layoutClassName}
          isSubmitting={isSubmitting}
          onCancel={handleCancel}
          onSubmit={handleSubmit}
        />
      ) : null}
    </QueryState>
  )
}

const EditTestFlowEditor = ({
  data,
  layoutClassName,
  isSubmitting,
  onCancel,
  onSubmit,
}: {
  data: TestFlowDetail
  layoutClassName: string
  isSubmitting: boolean
  onCancel: () => void
  onSubmit: TestFlowEditorSubmitHandler
}) => {
  const { nodes, edges } = graphToReactFlow(data.latestVersion)

  return (
    <Navigation>
      <div className="-mx-4 -my-6 sm:-mx-6 lg:-mx-8 lg:-my-8">
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
          isSubmitting={isSubmitting}
          className={layoutClassName}
          onCancel={onCancel}
          onSubmit={onSubmit}
        />
        {data.latestVersion ? (
          <p className="px-4 py-2 text-xs text-gray-500 lg:px-0">
            Current version: v{data.latestVersion.versionNumber}. Saving creates a new version
            snapshot.
          </p>
        ) : null}
      </div>
    </Navigation>
  )
}

export const Route = createFileRoute('/(app)/test-flow/$id/edit')({
  component: EditTestFlowPage,
})
