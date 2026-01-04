import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
import { FileText, Search, Plus, X } from 'lucide-react'
import { apiClient } from '@/lib/api'

export const Route = createFileRoute('/(app)/test-cases')({
  component: TestCasesPage,
})

interface Workflow {
  id: string
  name: string
  description?: string
  isActive?: boolean
  userId?: number
  createdAt?: string
  updatedAt?: string
}

const initialNodes = [
  {
    id: '1',
    type: 'input',
    data: { label: 'Start' },
    position: { x: 250, y: 5 },
  },
]

const initialEdges: any[] = []

function TestCasesPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isActive: true,
  })
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const queryClient = useQueryClient()

  // Search query
  const { data: searchResults, isLoading } = useQuery({
    queryKey: ['testCases', searchQuery],
    queryFn: async () => {
      const response = await apiClient.searchTestCases({
        query: searchQuery || undefined,
      })
      // Response is wrapped in SuccessResponse format: { success: true, data: [...], ... }
      return (response?.data || []) as Workflow[]
    },
    enabled: true,
  })

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: {
      name: string
      description?: string
      isActive?: boolean
    }) => {
      const response = await apiClient.createTestCase(data)
      // Response is wrapped in SuccessResponse format: { success: true, data: {...}, ... }
      return (response?.data || response) as Workflow
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testCases'] })
      setShowCreateForm(false)
      setFormData({
        name: '',
        description: '',
        isActive: true,
      })
      setNodes(initialNodes)
      setEdges(initialEdges)
    },
  })

  const handleCreate = () => {
    if (!formData.name.trim()) {
      alert('Please enter a workflow name')
      return
    }

    createMutation.mutate({
      name: formData.name,
      description: formData.description || undefined,
      isActive: formData.isActive,
    })
  }

  const workflows = searchResults || []

  return (
    <Navigation>
      <Container size="2xl">
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-6 h-6" />
                <CardTitle className="text-2xl">Test Cases</CardTitle>
              </div>
              <Button
                onClick={() => setShowCreateForm(!showCreateForm)}
                variant={showCreateForm ? 'outline' : 'default'}
              >
                {showCreateForm ? (
                  <>
                    <X className="w-4 h-4" />
                    Cancel
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Create Test Case
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Search Section */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search test cases..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* Create Form */}
            {showCreateForm && (
              <Card className="mb-4 border-2">
                <CardHeader>
                  <CardTitle>Create New Test Case</CardTitle>
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
                      Workflow Flow (Visual Editor)
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
                      Drag nodes to create your workflow. Connect nodes to define the sequence.
                      Note: The workflow structure will be saved when you create workflow versions.
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
                      {createMutation.isPending ? 'Creating...' : 'Create Workflow'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowCreateForm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Search Results */}
            <div>
              {isLoading ? (
                <p className="text-gray-600 dark:text-gray-400">
                  Loading workflows...
                </p>
              ) : workflows.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-400">
                  {searchQuery
                    ? 'No workflows found matching your search.'
                    : 'No workflows found. Create your first workflow!'}
                </p>
              ) : (
                <div className="space-y-4">
                  {workflows.map((workflow) => (
                    <Card key={workflow.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{workflow.name}</CardTitle>
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${
                              workflow.isActive
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                            }`}
                          >
                            {workflow.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {workflow.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            {workflow.description}
                          </p>
                        )}
                        {workflow.createdAt && (
                          <p className="text-xs text-gray-500 mt-2">
                            Created: {new Date(workflow.createdAt).toLocaleDateString()}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </Container>
    </Navigation>
  )
}

