import { useCallback, useMemo, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileText, ArrowLeft } from 'lucide-react'
import { NodePalette } from '@/components/test-flow/node-palette'
import { WorkflowNodeEditor } from '@/components/test-flow/workflow-node-editor'
import { workflowNodeTypes } from '@/components/test-flow/workflow-node-types'
import {
  connectEdge,
  createDefaultNodes,
  createWorkflowNode,
  getNextNodePosition,
  hasStartNode,
  reactFlowToGraph,
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

  const flowNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        draggable: false,
        data: {
          ...node.data,
          onEdit: () => setEditingNodeId(node.id),
        },
      })),
    [nodes],
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((current) => connectEdge(connection, current))
    },
    [setEdges],
  )

  const handleAddNode = useCallback(
    (nodeType: TestFlowNodeType) => {
      if (nodeType === 'start' && hasStartNode(nodes)) {
        return
      }

      const position = getNextNodePosition(nodes)
      setNodes((current) => [...current, createWorkflowNode(nodeType, position)])
    },
    [nodes, setNodes],
  )

  const handleUpdateNode = useCallback(
    (nodeId: string, updates: Partial<WorkflowNodeData>) => {
      setNodes((current) =>
        current.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  ...updates,
                },
              }
            : node,
        ),
      )
    },
    [setNodes],
  )

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      alert('Please enter a test flow name')
      return
    }

    onSubmit(formData, reactFlowToGraph(nodes, edges))
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-6 h-6" />
            <CardTitle className="text-2xl">{title}</CardTitle>
          </div>
          <Button variant="outline" onClick={onCancel}>
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Enter test flow name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            rows={3}
            placeholder="Enter test flow description"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Test Flow (Visual Editor)</label>
          <div className="flex overflow-hidden rounded-md border" style={{ height: '480px' }}>
            <div className="w-52 shrink-0">
              <NodePalette onAddNode={handleAddNode} hasStartNode={startNodeExists} />
            </div>
            <div className="min-w-0 flex-1">
              <ReactFlow
                nodes={flowNodes}
                edges={edges}
                nodeTypes={workflowNodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeDoubleClick={(_, node) => setEditingNodeId(node.id)}
                nodesDraggable={false}
                proOptions={{ hideAttribution: true }}
                deleteKeyCode={['Backspace', 'Delete']}
                fitView
              >
                <Background />
                <Controls />
                <MiniMap />
              </ReactFlow>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Add nodes from the palette to grow the flow to the right, connect handles between steps,
            double-click or use the edit button to configure a node, and press Delete to remove a
            selected node.
          </p>
        </div>

        <WorkflowNodeEditor
          node={editingNode}
          open={editingNodeId !== null}
          onOpenChange={(open) => {
            if (!open) setEditingNodeId(null)
          }}
          onSave={handleUpdateNode}
        />

        <div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="w-4 h-4"
            />
            <span className="text-sm font-medium">Active</span>
          </label>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : submitLabel}
          </Button>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function TestFlowEditor(props: TestFlowEditorProps) {
  return (
    <ReactFlowProvider>
      <TestFlowEditorCanvas {...props} />
    </ReactFlowProvider>
  )
}
