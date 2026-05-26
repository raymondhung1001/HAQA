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

export const useWorkflowGraph = ({
  initialNodes,
  initialEdges,
}: UseWorkflowGraphOptions = {}): UseWorkflowGraphReturn => {
  const defaultNodes = initialNodes ?? createDefaultNodes()
  const defaultEdges = initialEdges ?? createDefaultEdges(defaultNodes)
  const [nodes, setNodes] = useNodesState(defaultNodes)
  const [edges, setEdges] = useEdgesState(defaultEdges)
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const layoutDigestRef = useRef(getLoopBodyLayoutDigest(defaultNodes, defaultEdges))
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)

  nodesRef.current = nodes
  edgesRef.current = edges

  const applyLoopBodyRelayout = useCallback(
    (nextNodes: Node[], nextEdges: Edge[]) => {
      const layout = syncLoopBodyGraphLayout(nextNodes, nextEdges)
      layoutDigestRef.current = getLoopBodyLayoutDigest(layout.nodes, layout.edges)
      return layout
    },
    [],
  )

  const commitGraph = useCallback(
    (nextNodes: Node[], nextEdges: Edge[]) => {
      nodesRef.current = nextNodes
      edgesRef.current = nextEdges
      setNodes(nextNodes)
      setEdges(nextEdges)
    },
    [setNodes, setEdges],
  )

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const filtered = changes.filter((change) => change.type !== 'position')
      if (filtered.length === 0) return

      setNodes((currentNodes) => {
        const nextNodes = applyNodeChanges(filtered, currentNodes)
        nodesRef.current = nextNodes
        return nextNodes
      })
    },
    [setNodes],
  )

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (changes.length === 0) return

      setEdges((currentEdges) => {
        const nextEdges = applyEdgeChanges(changes, currentEdges)
        edgesRef.current = nextEdges
        return nextEdges
      })
    },
    [setEdges],
  )

  useEffect(() => {
    const layout = syncLoopBodyGraphLayout(nodes, edges)
    const digest = getLoopBodyLayoutDigest(layout.nodes, layout.edges)
    if (digest === layoutDigestRef.current) return

    layoutDigestRef.current = digest
    commitGraph(layout.nodes, layout.edges)
  }, [nodes, edges, commitGraph])

  const startNodeExists = useMemo(() => hasStartNode(nodes), [nodes])
  const endNodeExists = useMemo(() => hasEndNode(nodes), [nodes])

  const editingNode = useMemo(
    () => nodes.find((node) => node.id === editingNodeId) ?? null,
    [nodes, editingNodeId],
  )

  const handleSwapNode = useCallback(
    (nodeId: string, direction: 'left' | 'right') => {
      const result = swapAdjacentWorkflowNode(
        nodesRef.current,
        edgesRef.current,
        nodeId,
        direction,
      )
      commitGraph(result.nodes, result.edges)
    },
    [commitGraph],
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
      commitGraph(layout.nodes, layout.edges)
    },
    [applyLoopBodyRelayout, commitGraph],
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
      const result = addNodeToLoopBody(loopNodeId, nodeType, nodesRef.current, edgesRef.current)
      if (!result) return
      const layout = applyLoopBodyRelayout(result.nodes, result.edges)
      commitGraph(layout.nodes, layout.edges)
    },
    [applyLoopBodyRelayout, commitGraph],
  )

  const handleRemoveLoopBodyNode = useCallback(
    (loopNodeId: string, bodyNodeId: string) => {
      const result = removeNodeFromLoopBody(
        loopNodeId,
        bodyNodeId,
        nodesRef.current,
        edgesRef.current,
      )
      const layout = applyLoopBodyRelayout(result.nodes, result.edges)
      commitGraph(layout.nodes, layout.edges)
    },
    [applyLoopBodyRelayout, commitGraph],
  )

  const handleReorderLoopBodyNode = useCallback(
    (loopNodeId: string, fromIndex: number, toIndex: number) => {
      const result = reorderLoopBody(
        loopNodeId,
        fromIndex,
        toIndex,
        nodesRef.current,
        edgesRef.current,
      )
      const layout = applyLoopBodyRelayout(result.nodes, result.edges)
      commitGraph(layout.nodes, layout.edges)
    },
    [applyLoopBodyRelayout, commitGraph],
  )

  const handleAddNode = useCallback(
    (nodeType: TestFlowNodeType) => {
      const currentNodes = nodesRef.current
      const currentEdges = edgesRef.current

      if (nodeType === 'start' && hasStartNode(currentNodes)) {
        return
      }
      if (nodeType === 'end' && hasEndNode(currentNodes)) {
        return
      }

      const position = getNextNodePosition(currentNodes, currentEdges)
      commitGraph([...currentNodes, createWorkflowNode(nodeType, position)], currentEdges)
    },
    [commitGraph],
  )

  const handleUpdateNode = useCallback(
    (nodeId: string, updates: Partial<WorkflowNodeData>) => {
      const currentNodes = nodesRef.current
      const currentEdges = edgesRef.current
      const existing = currentNodes.find((node) => node.id === nodeId)
      const nodeType = (existing?.data as WorkflowNodeData)?.nodeType

      let nextEdges = currentEdges

      if (updates.config?.branches && nodeType === 'if-else') {
        const branches = readIfElseBranches(updates.config)
        if (branches.length > 0) {
          nextEdges = pruneEdgesForRemovedBranches(nextEdges, nodeId, branches)
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
          currentNodes.map((node) =>
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
          nextEdges,
        )
        const layout = applyLoopBodyRelayout(result.nodes, result.edges)
        commitGraph(layout.nodes, layout.edges)
        return
      }

      const nextNodes = currentNodes.map((node) =>
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
      )

      commitGraph(nextNodes, nextEdges)
    },
    [applyLoopBodyRelayout, commitGraph],
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
