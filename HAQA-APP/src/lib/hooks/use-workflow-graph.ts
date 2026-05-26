import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  applyEdgeChanges,
  applyNodeChanges,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type EdgeChange,
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
  createDefaultEdges,
  createDefaultNodes,
  createWorkflowNode,
  getNextNodePosition,
  hasEndNode,
  hasStartNode,
  isLoopNodeType,
  isValidWorkflowConnection,
  migrateLoopNodeConfig,
  normalizeLoopBodyBreakTargetConnection,
  pruneEdgesForRemovedBranches,
  LOOP_BODY_GROUP_NODE_TYPE,
  LOOP_BODY_GROUP_ORIGIN,
  readIfElseBranches,
  readLoopBodyNodeIds,
  removeNodeFromLoopBody,
  repositionNodeForBranchConnection,
  buildWorkflowNodeDisplayLabels,
  resolveLoopBodySteps,
  reorderLoopBody,
  getLoopBodyLayoutDigest,
  syncLoopBodyGraphLayout,
  withWorkflowEdgeDefaults,
  type TestFlowNodeType,
  type WorkflowNodeData,
} from '@/lib/test-flow-graph'

import type { UseWorkflowGraphOptions, UseWorkflowGraphReturn } from '@/types'

export function useWorkflowGraph({
  initialNodes,
  initialEdges,
}: UseWorkflowGraphOptions = {}): UseWorkflowGraphReturn {
  const defaultNodes = initialNodes ?? createDefaultNodes()
  const defaultEdges = initialEdges ?? createDefaultEdges(defaultNodes)
  const [nodes, setNodes] = useNodesState(defaultNodes)
  const [edges, setEdges] = useEdgesState(defaultEdges)
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const layoutDigestRef = useRef(getLoopBodyLayoutDigest(defaultNodes, defaultEdges))

  const applyLoopBodyRelayout = useCallback(
    (nextNodes: Node[], nextEdges: Edge[]) => {
      const layout = syncLoopBodyGraphLayout(nextNodes, nextEdges)
      layoutDigestRef.current = getLoopBodyLayoutDigest(layout.nodes, layout.edges)
      return layout
    },
    [],
  )

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const filtered = changes.filter((change) => change.type !== 'position')
      if (filtered.length === 0) return

      setNodes((currentNodes) => applyNodeChanges(filtered, currentNodes))
    },
    [setNodes],
  )

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (changes.length === 0) return

      setEdges((currentEdges) => applyEdgeChanges(changes, currentEdges))
    },
    [setEdges],
  )

  useEffect(() => {
    const layout = syncLoopBodyGraphLayout(nodes, edges)
    const digest = getLoopBodyLayoutDigest(layout.nodes, layout.edges)
    if (digest === layoutDigestRef.current) return

    layoutDigestRef.current = digest
    setNodes(layout.nodes)
    setEdges(layout.edges)
  }, [nodes, edges, setNodes, setEdges])

  const startNodeExists = useMemo(() => hasStartNode(nodes), [nodes])
  const endNodeExists = useMemo(() => hasEndNode(nodes), [nodes])

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

  const displayLabelByNodeId = useMemo(() => buildWorkflowNodeDisplayLabels(nodes), [nodes])

  const flowNodes = useMemo(
    () =>
      (nodes ?? []).map((node) => {
        if (node.type === LOOP_BODY_GROUP_NODE_TYPE) {
          return {
            ...node,
            origin: LOOP_BODY_GROUP_ORIGIN,
            draggable: false,
            selectable: false,
            focusable: false,
            ...(node.parentId
              ? { extent: 'parent' as const, expandParent: false }
              : {}),
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
            displayLabel: displayLabelByNodeId.get(node.id),
            loopBodySteps,
            onEdit: () => setEditingNodeId(node.id),
            onSwapLeft: isMainFlowNode ? () => handleSwapNode(node.id, 'left') : undefined,
            onSwapRight: isMainFlowNode ? () => handleSwapNode(node.id, 'right') : undefined,
            canSwapLeft: isMainFlowNode ? canSwapWorkflowNode(nodes, node.id, 'left') : false,
            canSwapRight: isMainFlowNode ? canSwapWorkflowNode(nodes, node.id, 'right') : false,
          },
        }
      }),
    [nodes, handleSwapNode, displayLabelByNodeId],
  )

  const editorNodeTypes = useMemo(
    () => ({
      ...workflowNodeTypes,
      [LOOP_BODY_GROUP_NODE_TYPE]: LoopBodyGroupNode,
    }),
    [],
  )

  const flowEdges = useMemo(() => edges.map(withWorkflowEdgeDefaults), [edges])

  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  nodesRef.current = nodes
  edgesRef.current = edges

  const onConnect = useCallback(
    (connection: Connection) => {
      const currentNodes = nodesRef.current
      const currentEdges = edgesRef.current
      const normalized = normalizeLoopBodyBreakTargetConnection(connection, currentNodes)
      if (!isValidWorkflowConnection(normalized, currentNodes)) return

      let nextEdges = connectEdge(normalized, currentEdges)
      let nextNodes = repositionNodeForBranchConnection(currentNodes, normalized)
      const loopBodyResult = appendTargetToLoopBodyOnConnect(normalized, nextNodes, nextEdges)
      const layout = applyLoopBodyRelayout(loopBodyResult.nodes, loopBodyResult.edges)
      setEdges(layout.edges)
      setNodes(layout.nodes)
    },
    [setEdges, setNodes, applyLoopBodyRelayout],
  )

  const isValidConnection = useCallback((connection: Connection) => {
    const currentNodes = nodesRef.current
    return isValidWorkflowConnection(
      normalizeLoopBodyBreakTargetConnection(connection, currentNodes),
      currentNodes,
    )
  }, [])

  const handleAddLoopBodyNode = useCallback(
    (loopNodeId: string, nodeType: TestFlowNodeType) => {
      const result = addNodeToLoopBody(loopNodeId, nodeType, nodes, edges)
      if (!result) return
      const layout = applyLoopBodyRelayout(result.nodes, result.edges)
      setNodes(layout.nodes)
      setEdges(layout.edges)
    },
    [nodes, edges, setNodes, setEdges, applyLoopBodyRelayout],
  )

  const handleRemoveLoopBodyNode = useCallback(
    (loopNodeId: string, bodyNodeId: string) => {
      const result = removeNodeFromLoopBody(loopNodeId, bodyNodeId, nodes, edges)
      const layout = applyLoopBodyRelayout(result.nodes, result.edges)
      setNodes(layout.nodes)
      setEdges(layout.edges)
    },
    [nodes, edges, setNodes, setEdges, applyLoopBodyRelayout],
  )

  const handleReorderLoopBodyNode = useCallback(
    (loopNodeId: string, fromIndex: number, toIndex: number) => {
      const result = reorderLoopBody(loopNodeId, fromIndex, toIndex, nodes, edges)
      const layout = applyLoopBodyRelayout(result.nodes, result.edges)
      setNodes(layout.nodes)
      setEdges(layout.edges)
    },
    [nodes, edges, setNodes, setEdges, applyLoopBodyRelayout],
  )

  const handleAddNode = useCallback(
    (nodeType: TestFlowNodeType) => {
      if (nodeType === 'start' && hasStartNode(nodes)) {
        return
      }
      if (nodeType === 'end' && hasEndNode(nodes)) {
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
        const layout = applyLoopBodyRelayout(result.nodes, result.edges)
        setNodes(layout.nodes)
        setEdges(layout.edges)
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
    [nodes, edges, setNodes, setEdges, applyLoopBodyRelayout],
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
    isValidConnection,
    startNodeExists,
    endNodeExists,
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
