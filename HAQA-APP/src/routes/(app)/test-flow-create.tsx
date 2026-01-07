import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Container } from '@/components/ui/container'
import { Navigation } from '@/components/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileText, ArrowLeft } from 'lucide-react'
import { apiClient } from '@/lib/withApi'

export const Route = createFileRoute('/(app)/test-flow-create')({
  component: CreateTestFlowPage,
})

const initialNodes = [
  {
    id: '1',
    type: 'input',
    data: { label: 'Start' },
    position: { x: 250, y: 5 },
  },
]

const initialEdges: any[] = []

function CreateTestFlowPage() {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isActive: true,
  })
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: {
      name: string
      description?: string
      isActive?: boolean
    }) => {
      const response = await apiClient.createTestFlow(data)
      // Response is wrapped in SuccessResponse format: { success: true, data: {...}, ... }
      return (response?.data || response)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testCases'] })
      navigate({ to: '/test-flow' })
    },
  })

  const handleCreate = () => {
    if (!formData.name.trim()) {
      alert('Please enter a test flow name')
      return
    }

    createMutation.mutate({
      name: formData.name,
      description: formData.description || undefined,
      isActive: formData.isActive,
    })
  }

  const handleCancel = () => {
    navigate({ to: '/test-flow' })
  }

  return (
    <Navigation>
      <Container size="2xl">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-6 h-6" />
                <CardTitle className="text-2xl">Create New Test Flow</CardTitle>
              </div>
              <Button
                variant="outline"
                onClick={handleCancel}
              >
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
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Enter test case name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                rows={3}
                placeholder="Enter test case description"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Test Flow (Visual Editor)
              </label>
              <div className="border rounded-md" style={{ height: '400px' }}>
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  fitView
                >
                  <Background />
                  <Controls />
                  <MiniMap />
                </ReactFlow>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Drag nodes to create your test flow. Connect nodes to define the sequence.
                Note: The test flow structure will be saved when you create test flow versions.
              </p>
            </div>

            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) =>
                    setFormData({ ...formData, isActive: e.target.checked })
                  }
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium">Active</span>
              </label>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleCreate}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? 'Creating...' : 'Create Test Flow'}
              </Button>
              <Button
                variant="outline"
                onClick={handleCancel}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </Container>
    </Navigation>
  )
}

