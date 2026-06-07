import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
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
  WORKFLOW_NODE_ORIGIN,
  createDefaultEdges,
  createDefaultNodes,
  hasEndNode,
  hasStartNode,
  isLoopNodeType,
  isValidWorkflowConnection,
  normalizeLoopBodyBreakTargetConnection,
  LOOP_BODY_GROUP_NODE_TYPE,
  LOOP_BODY_GROUP_ORIGIN,
  readLoopBodyNodeIds,
  buildWorkflowNodeDisplayLabels,
  getWorkflowNodeType,
  resolveLoopBodySteps,
  getLoopBodyLayoutDigest,
  toWorkflowNodeData,
  withWorkflowEdgeDefaults,
  WorkflowGraphService,
  type TestFlowNodeType,
  type WorkflowNodeData,
} from '@/lib/test-flow-graph'

import type { UseWorkflowGraphOptions, UseWorkflowGraphReturn } from '@/types'

const patchWorkflowNodeData = (
  nodes: Node[],
  nodeId: string,
  updates: Partial<WorkflowNodeData>,
): Node[] => {
  return nodes.map((node) =>
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
}

const patchLoopNodeData = (
  nodes: Node[],
  nodeId: string,
  updates: Partial<WorkflowNodeData>,
): Node[] => {
  return nodes.map((node) =>
    node.id === nodeId
      ? {
          ...node,
          data: {
            ...node.data,
            ...updates,
          },
        }
      : node,
  )
}

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
  const editingNodeIdRef = useRef(editingNodeId)
  const graphService = useMemo(() => new WorkflowGraphService(), [])

  nodesRef.current = nodes
  edgesRef.current = edges
  editingNodeIdRef.current = editingNodeId

  const applyLoopBodyRelayout = useCallback(
    (nextNodes: Node[], nextEdges: Edge[]) => {
      const layout = graphService.applyLoopBodyRelayout(nextNodes, nextEdges)
      layoutDigestRef.current = getLoopBodyLayoutDigest(layout.nodes, layout.edges)
      return layout
    },
    [graphService],
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

      const removeIds = filtered
        .filter((change): change is NodeChange & { type: 'remove'; id: string } => change.type === 'remove')
        .map((change) => change.id)
      const otherChanges = filtered.filter((change) => change.type !== 'remove')

      if (removeIds.length > 0) {
        const result = graphService.deleteNodes(removeIds, {
          nodes: nodesRef.current,
          edges: edgesRef.current,
        })

        if (result.deletedNodeIds.length === 0) {
          return
        }

        if (result.deletedNodeIds.includes(editingNodeIdRef.current ?? '')) {
          setEditingNodeId(null)
        }

        const layout = applyLoopBodyRelayout(result.nodes, result.edges)
        commitGraph(layout.nodes, layout.edges)
      }

      if (otherChanges.length === 0) return

      setNodes((currentNodes) => {
        const nextNodes = applyNodeChanges(otherChanges, currentNodes)
        nodesRef.current = nextNodes
        return nextNodes
      })
    },
    [applyLoopBodyRelayout, commitGraph, graphService, setNodes],
  )

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (changes.length === 0) return

      let blockedSystemEdge = false
      const filtered = changes.filter((change) => {
        if (change.type !== 'remove') return true

        const edge = edgesRef.current.find((candidate) => candidate.id === change.id)
        if (edge?.deletable === false || edge?.data?.system === true) {
          blockedSystemEdge = true
          return false
        }

        return true
      })

      if (blockedSystemEdge) {
        toast.error('This connection is managed automatically and cannot be removed.')
      }

      if (filtered.length === 0) return

      setEdges((currentEdges) => {
        const nextEdges = applyEdgeChanges(filtered, currentEdges)
        edgesRef.current = nextEdges
        return nextEdges
      })
    },
    [setEdges],
  )

  useEffect(() => {
    const layout = graphService.applyLoopBodyRelayout(nodes, edges)
    const digest = getLoopBodyLayoutDigest(layout.nodes, layout.edges)
    if (digest === layoutDigestRef.current) return

    layoutDigestRef.current = digest
    commitGraph(layout.nodes, layout.edges)
  }, [nodes, edges, commitGraph, graphService])

  const startNodeExists = useMemo(() => hasStartNode(nodes), [nodes])
  const endNodeExists = useMemo(() => hasEndNode(nodes), [nodes])

  const editingNode = useMemo(
    () => nodes.find((node) => node.id === editingNodeId) ?? null,
    [nodes, editingNodeId],
  )

  const handleSwapNode = useCallback(
    (nodeId: string, direction: 'left' | 'right') => {
      const result = graphService.swapAdjacent(
        {
          nodes: nodesRef.current,
          edges: edgesRef.current,
        },
        nodeId,
        direction,
      )
      commitGraph(result.nodes, result.edges)
    },
    [commitGraph, graphService],
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

        const data = toWorkflowNodeData(node)
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
      if (!isValidWorkflowConnection(normalized, currentNodes, currentEdges)) {
        toast.error('This connection is not allowed for this workflow.')
        return
      }

      const loopBodyResult = graphService.connect(connection, {
        nodes: currentNodes,
        edges: currentEdges,
      })
      const layout = applyLoopBodyRelayout(loopBodyResult.nodes, loopBodyResult.edges)
      commitGraph(layout.nodes, layout.edges)
    },
    [applyLoopBodyRelayout, commitGraph, graphService],
  )

  const isValidConnection = useCallback((connection: Connection) => {
    const currentNodes = nodesRef.current
    return isValidWorkflowConnection(
      normalizeLoopBodyBreakTargetConnection(connection, currentNodes),
      currentNodes,
      edgesRef.current,
    )
  }, [])

  const handleAddLoopBodyNode = useCallback(
    (loopNodeId: string, nodeType: TestFlowNodeType) => {
      const result = graphService.addLoopBodyNode(loopNodeId, nodeType, {
        nodes: nodesRef.current,
        edges: edgesRef.current,
      })
      if (!result) return
      const layout = applyLoopBodyRelayout(result.nodes, result.edges)
      commitGraph(layout.nodes, layout.edges)
    },
    [applyLoopBodyRelayout, commitGraph, graphService],
  )

  const handleRemoveLoopBodyNode = useCallback(
    (loopNodeId: string, bodyNodeId: string) => {
      const result = graphService.removeLoopBodyNode(
        loopNodeId,
        bodyNodeId,
        {
          nodes: nodesRef.current,
          edges: edgesRef.current,
        },
      )
      const layout = applyLoopBodyRelayout(result.nodes, result.edges)
      commitGraph(layout.nodes, layout.edges)
    },
    [applyLoopBodyRelayout, commitGraph, graphService],
  )

  const handleReorderLoopBodyNode = useCallback(
    (loopNodeId: string, fromIndex: number, toIndex: number) => {
      const result = graphService.reorderLoopBody(
        loopNodeId,
        fromIndex,
        toIndex,
        {
          nodes: nodesRef.current,
          edges: edgesRef.current,
        },
      )
      const layout = applyLoopBodyRelayout(result.nodes, result.edges)
      commitGraph(layout.nodes, layout.edges)
    },
    [applyLoopBodyRelayout, commitGraph, graphService],
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

      const next = graphService.addNode(nodeType, {
        nodes: currentNodes,
        edges: currentEdges,
      })
      commitGraph(next.nodes, next.edges)
    },
    [commitGraph, graphService],
  )

  const handleUpdateNode = useCallback(
    (nodeId: string, updates: Partial<WorkflowNodeData>) => {
      const result = graphService.updateNode(
        nodeId,
        updates,
        {
          nodes: nodesRef.current,
          edges: edgesRef.current,
        },
        patchWorkflowNodeData,
        patchLoopNodeData,
      )
      const maybeLoopNode = nodesRef.current.find((node) => node.id === nodeId)
      const shouldRelayout =
        (maybeLoopNode ? isLoopNodeType(getWorkflowNodeType(maybeLoopNode) ?? '') : false) ||
        Boolean(updates.config?.branches)

      if (!shouldRelayout) {
        commitGraph(result.nodes, result.edges)
        return
      }

      const layout = applyLoopBodyRelayout(result.nodes, result.edges)
      commitGraph(layout.nodes, layout.edges)
    },
    [applyLoopBodyRelayout, commitGraph, graphService],
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
