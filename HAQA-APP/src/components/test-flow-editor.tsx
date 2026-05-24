import { useCallback, useMemo, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  ConnectionLineType,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { ArrowLeft, FileText } from 'lucide-react'
import { NodePalette } from '@/components/test-flow/node-palette'
import { LoopBodyGroupNode } from '@/components/test-flow/loop-body-group-node'
import { WorkflowNodeEditor } from '@/components/test-flow/workflow-node-editor'
import { workflowNodeTypes } from '@/components/test-flow/workflow-node-types'
import { cn } from '@/lib/utils'
import {
  canSwapWorkflowNode,
  swapAdjacentWorkflowNode,
  WORKFLOW_NODE_ORIGIN,
  addNodeToLoopBody,
  appendTargetToLoopBodyOnConnect,
  connectEdge,
  createDefaultNodes,
  createWorkflowNode,
  getNextNodePosition,
  hasStartNode,
  isLoopNodeType,
  pruneEdgesForRemovedBranches,
  reactFlowToGraph,
  LOOP_BODY_GROUP_NODE_TYPE,
  readIfElseBranches,
  readLoopBodyNodeIds,
  readLoopBranches,
  removeNodeFromLoopBody,
  repositionNodeForBranchConnection,
  resolveLoopBodySteps,
  reorderLoopBody,
  WORKFLOW_EDGE_OPTIONS,
  withWorkflowEdgeDefaults,
  type TestFlowGraph,
  type TestFlowNodeType,
  type WorkflowNodeData,
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
  const [nodes, setNodes, onNodesChangeBase] = useNodesState(initialNodes ?? createDefaultNodes())
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges ?? [])
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChangeBase(changes.filter((change) => change.type !== 'position'))
    },
    [onNodesChangeBase],
  )

  const startNodeExists = useMemo(() => hasStartNode(nodes), [nodes])

  const editingNode = useMemo(
    () => nodes.find((node) => node.id === editingNodeId) ?? null,
    [nodes, editingNodeId],
  )

  const handleSwapNode = useCallback(
    (nodeId: string, direction: 'left' | 'right') => {
      const result = swapAdjacentWorkflowNode(nodes, edges, nodeId, direction)
      setNodes(result.nodes)
      setEdges(result.edges)
    },
    [nodes, edges, setNodes, setEdges],
  )

  const flowNodes = useMemo(
    () =>
      (nodes ?? []).map((node) => {
        if (node.type === LOOP_BODY_GROUP_NODE_TYPE) {
          return {
            ...node,
            draggable: false,
            selectable: false,
            focusable: false,
          }
        }

        const data = node.data as WorkflowNodeData
        const loopBodySteps = isLoopNodeType(data.nodeType ?? '')
          ? resolveLoopBodySteps(readLoopBodyNodeIds(data.config), nodes)
          : undefined
        const isMainFlowNode = !node.parentId?.endsWith('-loop-body')

        return {
          ...node,
          draggable: false,
          origin: WORKFLOW_NODE_ORIGIN,
          data: {
            ...data,
            loopBodySteps,
            onEdit: () => setEditingNodeId(node.id),
            onSwapLeft: isMainFlowNode ? () => handleSwapNode(node.id, 'left') : undefined,
            onSwapRight: isMainFlowNode ? () => handleSwapNode(node.id, 'right') : undefined,
            canSwapLeft: isMainFlowNode ? canSwapWorkflowNode(nodes, node.id, 'left') : false,
            canSwapRight: isMainFlowNode ? canSwapWorkflowNode(nodes, node.id, 'right') : false,
          },
        }
      }),
    [nodes, handleSwapNode],
  )

  const editorNodeTypes = useMemo(
    () => ({
      ...workflowNodeTypes,
      [LOOP_BODY_GROUP_NODE_TYPE]: LoopBodyGroupNode,
    }),
    [],
  )

  const flowEdges = useMemo(() => edges.map(withWorkflowEdgeDefaults), [edges])

  const onConnect = useCallback(
    (connection: Connection) => {
      let nextEdges = connectEdge(connection, edges)
      let nextNodes = repositionNodeForBranchConnection(nodes, connection)
      const loopBodyResult = appendTargetToLoopBodyOnConnect(connection, nextNodes, nextEdges)
      nextNodes = loopBodyResult.nodes
      nextEdges = loopBodyResult.edges
      setEdges(nextEdges)
      setNodes(nextNodes)
    },
    [nodes, edges, setEdges, setNodes],
  )

  const handleAddLoopBodyNode = useCallback(
    (loopNodeId: string, nodeType: TestFlowNodeType) => {
      const result = addNodeToLoopBody(loopNodeId, nodeType, nodes, edges)
      if (!result) return
      setNodes(result.nodes)
      setEdges(result.edges)
    },
    [nodes, edges, setNodes, setEdges],
  )

  const handleRemoveLoopBodyNode = useCallback(
    (loopNodeId: string, bodyNodeId: string) => {
      const result = removeNodeFromLoopBody(loopNodeId, bodyNodeId, nodes, edges)
      setNodes(result.nodes)
      setEdges(result.edges)
    },
    [nodes, edges, setNodes, setEdges],
  )

  const handleReorderLoopBodyNode = useCallback(
    (loopNodeId: string, fromIndex: number, toIndex: number) => {
      const result = reorderLoopBody(loopNodeId, fromIndex, toIndex, nodes, edges)
      setNodes(result.nodes)
      setEdges(result.edges)
    },
    [nodes, edges, setNodes, setEdges],
  )

  const handleAddNode = useCallback(
    (nodeType: TestFlowNodeType) => {
      if (nodeType === 'start' && hasStartNode(nodes)) {
        return
      }

      const position = getNextNodePosition(nodes, edges)
      setNodes((current) => [...current, createWorkflowNode(nodeType, position)])
    },
    [nodes, edges, setNodes],
  )

  const handleUpdateNode = useCallback(
    (nodeId: string, updates: Partial<WorkflowNodeData>) => {
      if (updates.config?.branches) {
        const existing = nodes.find((node) => node.id === nodeId)
        const nodeType = (existing?.data as WorkflowNodeData)?.nodeType
        const branches =
          nodeType === 'if-else'
            ? readIfElseBranches(updates.config)
            : isLoopNodeType(nodeType ?? '')
              ? readLoopBranches(updates.config)
              : []

        if (branches.length > 0) {
          setEdges((current) => pruneEdgesForRemovedBranches(current, nodeId, branches))
        }
      }

      setNodes((current) =>
        current.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  ...updates,
                  config: updates.config
                    ? { ...(node.data?.config as Record<string, unknown> | undefined), ...updates.config }
                    : node.data?.config,
                },
              }
            : node,
        ),
      )
    },
    [nodes, setNodes, setEdges],
  )

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      alert('Please enter a test flow name')
      return
    }

    onSubmit(formData, reactFlowToGraph(nodes, edges))
  }

  return (
    <div
      className={cn(
        'flex min-h-[calc(100dvh-5rem)] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 lg:min-h-[calc(100dvh-8.5rem)]',
        className,
      )}
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-slate-700 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="outline" size="sm" onClick={onCancel}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 shrink-0 text-primary" />
              <h1 className="truncate text-lg font-semibold text-gray-900 dark:text-white sm:text-xl">
                {title}
              </h1>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Configure flow details, add steps, and connect them on the canvas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : submitLabel}
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="flex w-full shrink-0 flex-col border-b border-gray-200 dark:border-slate-700 lg:w-80 lg:border-b-0 lg:border-r">
          <div className="space-y-4 border-b border-gray-200 p-4 dark:border-slate-700">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Enter test flow name"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                rows={3}
                placeholder="Enter test flow description"
              />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-800/50">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Flow status</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formData.isActive
                    ? 'Active — this flow can be executed'
                    : 'Inactive — this flow is disabled'}
                </p>
              </div>
              <Switch
                checked={formData.isActive}
                onCheckedChange={(isActive) => setFormData({ ...formData, isActive })}
                aria-label="Toggle flow active status"
              />
            </div>
          </div>

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
                onNodeDoubleClick={(_, node) => setEditingNodeId(node.id)}
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
              <MiniMap
                className="!shadow-md"
                pannable
                zoomable
                nodeStrokeWidth={3}
              />
            </ReactFlow>
          </div>

          <p className="pointer-events-none absolute bottom-3 left-4 z-10 max-w-xl rounded-md bg-white/90 px-3 py-1.5 text-xs text-gray-600 shadow-sm backdrop-blur-sm dark:bg-slate-900/90 dark:text-gray-300">
            Add nodes from the palette to grow the flow to the right, configure If / Else output
            branches in the node editor, use the arrow buttons on a step to swap its order, connect handles
            between steps, double-click or use the edit button to configure a node, and press Delete
            to remove a selected node.
          </p>
        </section>
      </div>

      <WorkflowNodeEditor
        node={editingNode}
        allNodes={nodes}
        open={editingNodeId !== null}
        onOpenChange={(open) => {
          if (!open) setEditingNodeId(null)
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
