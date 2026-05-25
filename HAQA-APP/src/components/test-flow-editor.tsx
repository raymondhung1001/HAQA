import { useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  ConnectionLineType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { Edge, Node } from '@xyflow/react'

import { EditorHeader } from '@/components/test-flow/editor-header'
import { TestFlowMetadataForm } from '@/components/test-flow/metadata-form'
import { NodePalette } from '@/components/test-flow/node-palette'
import { WorkflowNodeEditor } from '@/components/test-flow/workflow-node-editor'
import { useWorkflowGraph } from '@/lib/hooks/use-workflow-graph'
import { cn } from '@/lib/utils'
import {
  reactFlowToGraph,
  WORKFLOW_EDGE_OPTIONS,
  WORKFLOW_NODE_ORIGIN,
  type TestFlowGraph,
} from '@/lib/test-flow-graph'

export interface TestFlowEditorFormData {
  name: string
  description: string
  isActive: boolean
}

interface TestFlowEditorProps {
  title: string
  submitLabel: string
  initialFormData: TestFlowEditorFormData
  initialNodes?: Node[]
  initialEdges?: Edge[]
  isSubmitting?: boolean
  className?: string
  onCancel: () => void
  onSubmit: (formData: TestFlowEditorFormData, graph: TestFlowGraph) => void
}

function TestFlowEditorCanvas({
  title,
  submitLabel,
  initialFormData,
  initialNodes,
  initialEdges,
  isSubmitting = false,
  className,
  onCancel,
  onSubmit,
}: TestFlowEditorProps) {
  const [formData, setFormData] = useState(initialFormData)
  const [nameError, setNameError] = useState<string | undefined>()

  const {
    nodes,
    edges,
    flowNodes,
    flowEdges,
    editorNodeTypes,
    onNodesChange,
    onEdgesChange,
    onConnect,
    startNodeExists,
    editingNode,
    editingNodeId,
    openNodeEditor,
    closeNodeEditor,
    handleAddNode,
    handleUpdateNode,
    handleAddLoopBodyNode,
    handleRemoveLoopBodyNode,
    handleReorderLoopBodyNode,
  } = useWorkflowGraph({ initialNodes, initialEdges })

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      setNameError('Please enter a test flow name')
      return
    }
    setNameError(undefined)
    onSubmit(formData, reactFlowToGraph(nodes, edges))
  }

  return (
    <div
      className={cn(
        'flex min-h-[calc(100dvh-5rem)] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 lg:min-h-[calc(100dvh-8.5rem)]',
        className,
      )}
    >
      <EditorHeader
        title={title}
        submitLabel={submitLabel}
        isSubmitting={isSubmitting}
        onCancel={onCancel}
        onSubmit={handleSubmit}
      />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="flex w-full shrink-0 flex-col border-b border-gray-200 dark:border-slate-700 lg:w-80 lg:border-b-0 lg:border-r">
          <TestFlowMetadataForm formData={formData} onChange={setFormData} />
          {nameError ? (
            <p className="px-4 pb-2 text-sm text-red-600 dark:text-red-400">{nameError}</p>
          ) : null}

          <div className="min-h-[220px] flex-1 lg:min-h-0">
            <NodePalette onAddNode={handleAddNode} hasStartNode={startNodeExists} />
          </div>
        </aside>

        <section className="relative min-h-[62vh] min-w-0 flex-1 lg:min-h-0">
          <div className="absolute inset-0">
            <ReactFlow
              nodes={flowNodes}
              edges={flowEdges}
              nodeTypes={editorNodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeDoubleClick={(_, node) => openNodeEditor(node.id)}
              nodesDraggable={false}
              nodeOrigin={WORKFLOW_NODE_ORIGIN}
              proOptions={{ hideAttribution: true }}
              defaultEdgeOptions={WORKFLOW_EDGE_OPTIONS}
              connectionLineType={ConnectionLineType.SmoothStep}
              deleteKeyCode={['Backspace', 'Delete']}
              fitView
            >
              <Background gap={20} size={1} />
              <Controls className="!shadow-md" />
              <MiniMap className="!shadow-md" pannable zoomable nodeStrokeWidth={3} />
            </ReactFlow>
          </div>

          <p className="pointer-events-none absolute bottom-3 left-4 z-10 max-w-xl rounded-md bg-white/90 px-3 py-1.5 text-xs text-gray-600 shadow-sm backdrop-blur-sm dark:bg-slate-900/90 dark:text-gray-300">
            Add nodes from the palette to grow the flow to the right, configure If / Else output
            branches in the node editor, add loop body steps and break exits at the end of the body,
            use the arrow buttons on a step to swap its order, connect handles between steps,
            double-click or use the edit button to configure a node, and press Delete to remove a
            selected node.
          </p>
        </section>
      </div>

      <WorkflowNodeEditor
        node={editingNode}
        allNodes={nodes}
        open={editingNodeId !== null}
        onOpenChange={(open) => {
          if (!open) closeNodeEditor()
        }}
        onSave={handleUpdateNode}
        onAddLoopBodyNode={handleAddLoopBodyNode}
        onRemoveLoopBodyNode={handleRemoveLoopBodyNode}
        onReorderLoopBodyNode={handleReorderLoopBodyNode}
      />
    </div>
  )
}

export function TestFlowEditor(props: TestFlowEditorProps) {
  return (
    <ReactFlowProvider>
      <TestFlowEditorCanvas {...props} />
    </ReactFlowProvider>
  )
}
