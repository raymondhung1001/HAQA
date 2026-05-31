import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  ControlButton,
  MiniMap,
  ReactFlowProvider,
  ConnectionLineType,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { Edge, Node, Viewport } from '@xyflow/react'

import { Callout } from '@/components/callout'
import {
  FLOW_BOARD_FIT_MAX_ZOOM,
  FLOW_BOARD_FIT_MIN_ZOOM,
  FLOW_BOARD_MAX_ZOOM,
  FLOW_BOARD_MIN_ZOOM,
  getBoardTranslateExtent,
} from '@/components/test-flow/flow-board-layout'
import { EditorHeader } from '@/components/test-flow/editor-header'
import { TestFlowMetadataForm } from '@/components/test-flow/metadata-form'
import { NodePalette } from '@/components/test-flow/node-palette'
import { WorkflowNodeEditor } from '@/components/test-flow/workflow-node-editor'
import { useTestFlowEditorDirtyState } from '@/lib/hooks/use-test-flow-editor-dirty-state'
import { useWorkflowGraph } from '@/lib/hooks/use-workflow-graph'
import { cn } from '@/lib/utils'
import {
  buildUiLayoutJson,
  createDefaultEdges,
  createDefaultNodes,
  isEmptyStarterGraph,
  reactFlowToGraph,
  WORKFLOW_EDGE_OPTIONS,
  WORKFLOW_NODE_ORIGIN,
} from '@/lib/test-flow-graph'
import { validateTestFlowGraph } from '@/lib/test-flow-validation'
import type { TestFlowEditorFormData, TestFlowGraph } from '@/types'

export type { TestFlowEditorFormData } from '@/types'

interface TestFlowEditorProps {
  title: string
  submitLabel: string
  initialFormData: TestFlowEditorFormData
  initialNodes?: Node[]
  initialEdges?: Edge[]
  initialViewport?: Viewport
  isSubmitting?: boolean
  className?: string
  onCancel: () => void
  onSubmit: (formData: TestFlowEditorFormData, graph: TestFlowGraph) => void
  onDirtyChange?: (dirty: boolean) => void
}

const TestFlowEditorCanvas = ({
  title,
  submitLabel,
  initialFormData,
  initialNodes,
  initialEdges,
  initialViewport,
  isSubmitting = false,
  className,
  onCancel,
  onSubmit,
  onDirtyChange,
}: TestFlowEditorProps) => {
  const { getViewport, setViewport } = useReactFlow()
  const [formData, setFormData] = useState(initialFormData)
  const [nameError, setNameError] = useState<string | undefined>()
  const [showFlowHelp, setShowFlowHelp] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Array<{ code: string; message: string }>>([])
  const viewportRestoredRef = useRef(false)

  const effectiveInitialNodes = initialNodes ?? createDefaultNodes()
  const effectiveInitialEdges = initialEdges ?? createDefaultEdges(effectiveInitialNodes)

  const {
    nodes,
    edges,
    flowNodes,
    flowEdges,
    editorNodeTypes,
    onNodesChange,
    onEdgesChange,
    onConnect,
    isValidConnection,
    startNodeExists,
    endNodeExists,
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

  const boardTranslateExtent = useMemo(() => getBoardTranslateExtent(flowNodes), [flowNodes])

  const graphValidation = useMemo(
    () => validateTestFlowGraph(reactFlowToGraph(nodes, edges)),
    [nodes, edges],
  )

  const isDirty = useTestFlowEditorDirtyState({
    initialFormData,
    initialNodes: effectiveInitialNodes,
    initialEdges: effectiveInitialEdges,
    formData,
    nodes,
    edges,
  })

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  useEffect(() => {
    if (!initialViewport || viewportRestoredRef.current) return
    setViewport(initialViewport, { duration: 0 })
    viewportRestoredRef.current = true
  }, [initialViewport, setViewport])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      if (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        target?.isContentEditable
      ) {
        return
      }

      if (event.key === '?' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        setShowFlowHelp((current) => !current)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSubmit = useCallback(() => {
    if (!formData.name.trim()) {
      setNameError('Please enter a test flow name')
      return
    }
    setNameError(undefined)

    const validation = validateTestFlowGraph(reactFlowToGraph(nodes, edges))
    setValidationErrors(validation.errors)
    if (!validation.valid) return

    const viewport = getViewport()
    const graph = reactFlowToGraph(nodes, edges, buildUiLayoutJson(viewport))
    onSubmit(formData, graph)
  }, [formData, nodes, edges, getViewport, onSubmit])

  const showEmptyCanvasHint = isEmptyStarterGraph(nodes, edges)
  const saveDisabled = !graphValidation.valid

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
        saveDisabled={saveDisabled}
        onCancel={onCancel}
        onSubmit={handleSubmit}
      />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="flex w-full shrink-0 flex-col border-b border-gray-200 dark:border-slate-700 lg:w-80 lg:border-b-0 lg:border-r">
          <TestFlowMetadataForm formData={formData} onChange={setFormData} />
          {nameError ? (
            <p className="px-4 pb-2 text-sm text-red-600 dark:text-red-400">{nameError}</p>
          ) : null}

          {!graphValidation.valid ? (
            <div className="px-4 pb-3">
              <Callout variant="warning" title="Fix graph issues before saving">
                <ul className="list-disc space-y-1 pl-4 text-sm text-gray-700 dark:text-gray-300">
                  {graphValidation.errors.map((error) => (
                    <li key={`${error.code}-${error.nodeId ?? error.message}`}>{error.message}</li>
                  ))}
                </ul>
              </Callout>
            </div>
          ) : validationErrors.length > 0 ? (
            <div className="px-4 pb-3">
              <Callout variant="warning" title="Could not save">
                <ul className="list-disc space-y-1 pl-4 text-sm text-gray-700 dark:text-gray-300">
                  {validationErrors.map((error) => (
                    <li key={`${error.code}-${error.message}`}>{error.message}</li>
                  ))}
                </ul>
              </Callout>
            </div>
          ) : null}

          {showEmptyCanvasHint ? (
            <div className="px-4 pb-3">
              <Callout variant="info" title="Get started">
                Add nodes from the palette below, then connect handles on the canvas to build your
                workflow.
              </Callout>
            </div>
          ) : null}

          <div className="min-h-[220px] flex-1 lg:min-h-0">
            <NodePalette
              onAddNode={handleAddNode}
              hasStartNode={startNodeExists}
              hasEndNode={endNodeExists}
            />
          </div>
        </aside>

        <section className="relative min-h-[62vh] min-w-0 flex-1 lg:min-h-0">
          <div className="absolute inset-0" data-testid="test-flow-canvas">
            <ReactFlow
              nodes={flowNodes}
              edges={flowEdges}
              nodeTypes={editorNodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              isValidConnection={isValidConnection}
              onNodeDoubleClick={(_, node) => openNodeEditor(node.id)}
              nodesDraggable={false}
              nodeOrigin={WORKFLOW_NODE_ORIGIN}
              proOptions={{ hideAttribution: true }}
              defaultEdgeOptions={WORKFLOW_EDGE_OPTIONS}
              connectionLineType={ConnectionLineType.SmoothStep}
              connectionRadius={24}
              minZoom={FLOW_BOARD_MIN_ZOOM}
              maxZoom={FLOW_BOARD_MAX_ZOOM}
              translateExtent={boardTranslateExtent}
              deleteKeyCode={['Backspace', 'Delete']}
              fitViewOptions={{
                padding: { left: 0.04, right: 0.14, top: 0.1, bottom: 0.1 },
                minZoom: FLOW_BOARD_FIT_MIN_ZOOM,
                maxZoom: FLOW_BOARD_FIT_MAX_ZOOM,
              }}
              fitView={!initialViewport}
            >
              <Background gap={20} size={1} />
              <Controls className="!shadow-md">
                <ControlButton
                  aria-label="Flow board help"
                  title="Flow board help (?)"
                  className="!bg-white hover:!bg-slate-100 dark:!bg-slate-800 dark:hover:!bg-slate-700"
                  onClick={() => setShowFlowHelp((current) => !current)}
                >
                  <svg viewBox="0 0 24 24" className="block h-4 w-4" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" fill="currentColor" />
                    <rect x="11" y="10" width="2" height="7" rx="1" fill="white" />
                    <circle cx="12" cy="7" r="1.25" fill="white" />
                  </svg>
                </ControlButton>
              </Controls>
              <MiniMap
                className="!h-36 !w-52 !shadow-md"
                pannable
                zoomable={false}
                nodeStrokeWidth={3}
              />
            </ReactFlow>
          </div>

          {showFlowHelp ? (
            <p className="pointer-events-none absolute bottom-3 left-16 z-10 max-w-xl rounded-md bg-white/90 px-3 py-1.5 text-xs text-gray-600 shadow-sm backdrop-blur-sm dark:bg-slate-900/90 dark:text-gray-300">
              Press <kbd className="rounded border px-1">?</kbd> to toggle this help. Add nodes from
              the palette to grow the flow to the right, connect handles to build a branch tree (If /
              Else needs Yes/Else handles), add loop body steps and wire them in the canvas, wire If /
              Else branches to orange Break handles on the loop body rail (then out to main flow), use
              blue Done to continue after the loop, use the arrow buttons on a main-flow step to swap
              its order, connect handles between steps, double-click or use the edit button to
              configure a node, press Delete to remove selected nodes or edges (loop entry and
              loop-back connections are protected), and remove loop body steps from the node editor
              or by selecting them on the canvas.
            </p>
          ) : null}
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

export const TestFlowEditor = (props: TestFlowEditorProps) => {
  return (
    <ReactFlowProvider>
      <TestFlowEditorCanvas {...props} />
    </ReactFlowProvider>
  )
}
