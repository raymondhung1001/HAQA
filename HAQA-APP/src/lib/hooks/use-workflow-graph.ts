import { useCallback, useMemo, useState } from 'react'
import {
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
} from '@xyflow/react'

import { LoopBodyGroupNode } from '@/components/test-flow/loop-body-group-node'
import { workflowNodeTypes } from '@/components/test-flow/workflow-node-types'
import {
  canSwapWorkflowNode,
  swapAdjacentWorkflowNode,
  WORKFLOW_NODE_ORIGIN,
  addNodeToLoopBody,
  appendTargetToLoopBodyOnConnect,
  applyLoopNodeConfigUpdate,
  connectEdge,
  createDefaultNodes,
  createWorkflowNode,
  getNextNodePosition,
  hasStartNode,
  isLoopNodeType,
  isValidWorkflowConnection,
  migrateLoopNodeConfig,
  normalizeLoopBodyBreakTargetConnection,
  pruneEdgesForRemovedBranches,
  LOOP_BODY_GROUP_NODE_TYPE,
  readIfElseBranches,
  readLoopBodyNodeIds,
  removeNodeFromLoopBody,
  repositionNodeForBranchConnection,
  resolveLoopBodySteps,
  reorderLoopBody,
  syncAllLoopBodyEdges,
  syncAllLoopBodyGroups,
  withWorkflowEdgeDefaults,
  type TestFlowNodeType,
  type WorkflowNodeData,
} from '@/lib/test-flow-graph'

import type { UseWorkflowGraphOptions, UseWorkflowGraphReturn } from '@/types'

export function useWorkflowGraph({
  initialNodes,
  initialEdges,
}: UseWorkflowGraphOptions = {}): UseWorkflowGraphReturn {
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
      const normalized = normalizeLoopBodyBreakTargetConnection(connection, nodes)
      if (!isValidWorkflowConnection(normalized, nodes)) return

      let nextEdges = connectEdge(normalized, edges)
      let nextNodes = repositionNodeForBranchConnection(nodes, normalized)
      const loopBodyResult = appendTargetToLoopBodyOnConnect(normalized, nextNodes, nextEdges)
      nextNodes = loopBodyResult.nodes
      nextEdges = syncAllLoopBodyEdges(loopBodyResult.nodes, loopBodyResult.edges)
      nextNodes = syncAllLoopBodyGroups(loopBodyResult.nodes, nextEdges)
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
      const existing = nodes.find((node) => node.id === nodeId)
      const nodeType = (existing?.data as WorkflowNodeData)?.nodeType

      if (updates.config?.branches && nodeType === 'if-else') {
        const branches = readIfElseBranches(updates.config)
        if (branches.length > 0) {
          setEdges((current) => pruneEdgesForRemovedBranches(current, nodeId, branches))
        }
      }

      if (isLoopNodeType(nodeType ?? '') && updates.config) {
        const mergedConfig = migrateLoopNodeConfig({
          ...((existing?.data as WorkflowNodeData)?.config ?? {}),
          ...updates.config,
        })
        const result = applyLoopNodeConfigUpdate(
          nodeId,
          mergedConfig,
          nodes.map((node) =>
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
          edges,
        )
        setNodes(result.nodes)
        setEdges(result.edges)
        return
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
                    ? {
                        ...(node.data?.config as Record<string, unknown> | undefined),
                        ...updates.config,
                      }
                    : node.data?.config,
                },
              }
            : node,
        ),
      )
    },
    [nodes, edges, setNodes, setEdges],
  )

  const closeNodeEditor = useCallback(() => setEditingNodeId(null), [])

  const openNodeEditor = useCallback((nodeId: string) => setEditingNodeId(nodeId), [])

  return {
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
    setEditingNodeId,
    handleAddNode,
    handleUpdateNode,
    handleAddLoopBodyNode,
    handleRemoveLoopBodyNode,
    handleReorderLoopBodyNode,
  }
}
