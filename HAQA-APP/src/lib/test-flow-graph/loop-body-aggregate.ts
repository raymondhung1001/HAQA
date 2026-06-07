import type { Connection, Edge, Node } from '@xyflow/react'

import type { TestFlowNodeType, WorkflowNodeData } from './types'
import {
  LOOP_BODY_BRANCH_ID,
  LOOP_CONTINUE_SOURCE_HANDLE,
} from './constants'
import {
  isLoopNodeType,
  migrateLoopNodeConfig,
  normalizeLoopBodyNodeIds,
  readLoopBodyNodeIds,
} from './branch-config'
import { createWorkflowNode } from './nodes'
import {
  connectEdge,
  pruneEdgesForRemovedBranches,
} from './connections'
import {
  findLoopBodyLeafNodeIds,
  isBranchingWorkNodeType,
} from './loop-body-selectors'
import { getLoopBodyGroupId } from './loop-body-ids'
import { isLoopBodyWorkNodeType } from './workflow-node-meta'

type LoopBodyGraphState = { nodes: Node[]; edges: Edge[] }

type LoopBodyAggregateDependencies = {
  layoutLoopBodyNodes: (
    loopNode: Node,
    bodyNodeIds: string[],
    nodes: Node[],
    edges?: Edge[],
  ) => Node[]
  syncLoopBodyEdges: (
    loopNodeId: string,
    bodyNodeIds: string[],
    nodes: Node[],
    edges: Edge[],
  ) => Edge[]
}

function loopBodyHasIfElseNode(
  loopNodeId: string,
  bodyNodeIds: string[],
  nodes: Node[],
): boolean {
  if (
    bodyNodeIds.some((id) => {
      const member = nodes.find((node) => node.id === id)
      return (member?.data as WorkflowNodeData)?.nodeType === 'if-else'
    })
  ) {
    return true
  }

  const groupId = getLoopBodyGroupId(loopNodeId)
  return nodes.some(
    (node) =>
      node.parentId === groupId &&
      (node.data as WorkflowNodeData)?.nodeType === 'if-else',
  )
}

function normalizeLoopConfigForBody(
  loopNodeId: string,
  config: Record<string, unknown> | undefined,
  bodyNodeIds: string[],
  nodes: Node[],
): { config: Record<string, unknown>; hasIfElse: boolean } {
  const hasIfElse = loopBodyHasIfElseNode(loopNodeId, bodyNodeIds, nodes)
  const migrated = migrateLoopNodeConfig(config)

  return {
    config: {
      ...migrated,
      bodyNodeIds,
      ...(hasIfElse ? {} : { breakExits: [] }),
    },
    hasIfElse,
  }
}

function connectNewLoopBodyMember(
  currentIds: string[],
  newNodeId: string,
  nodes: Node[],
  edges: Edge[],
): Edge[] {
  if (currentIds.length === 0) return edges

  const leaves = findLoopBodyLeafNodeIds(currentIds, edges)

  if (leaves.length === 1) {
    const leafId = leaves[0]
    const leafNode = nodes.find((node) => node.id === leafId)
    const leafType = (leafNode?.data as WorkflowNodeData)?.nodeType ?? ''

    if (!isBranchingWorkNodeType(leafType)) {
      if (!hasWorkflowEdge(edges, leafId, newNodeId, undefined)) {
        return connectEdge({ source: leafId, target: newNodeId }, edges)
      }
    }
  }

  return edges
}

function hasWorkflowEdge(
  edges: Edge[],
  source: string,
  target: string,
  sourceHandle?: string | null,
): boolean {
  return edges.some(
    (edge) =>
      edge.source === source &&
      edge.target === target &&
      (sourceHandle === undefined
        ? !edge.sourceHandle
        : edge.sourceHandle === sourceHandle),
  )
}

export class LoopBodyAggregate {
  constructor(
    private readonly dependencies: LoopBodyAggregateDependencies,
    private readonly state: LoopBodyGraphState,
  ) {}

  applyLoopBodyUpdate(loopNodeId: string, bodyNodeIds: string[]): LoopBodyGraphState {
    const loopNode = this.state.nodes.find((node) => node.id === loopNodeId)
    if (!loopNode) return this.state

    const validIds = normalizeLoopBodyNodeIds(
      bodyNodeIds,
      new Set(this.state.nodes.map((node) => node.id)),
    )

    const { config: nextLoopConfig, hasIfElse } = normalizeLoopConfigForBody(
      loopNodeId,
      (loopNode.data as WorkflowNodeData).config as Record<string, unknown> | undefined,
      validIds,
      this.state.nodes,
    )

    const nextLoopNode = {
      ...loopNode,
      data: {
        ...loopNode.data,
        config: nextLoopConfig,
      },
    }

    const positionedNodes = this.dependencies
      .layoutLoopBodyNodes(nextLoopNode, validIds, this.state.nodes, this.state.edges)
      .map((node) => {
        if (node.id !== loopNodeId) return node

        return {
          ...node,
          data: {
            ...node.data,
            config: nextLoopConfig,
          },
        }
      })

    let nextEdges = this.state.edges
    if (!hasIfElse) {
      nextEdges = pruneEdgesForRemovedBranches(nextEdges, getLoopBodyGroupId(loopNodeId), [])
    }

    return {
      nodes: positionedNodes,
      edges: this.dependencies.syncLoopBodyEdges(
        loopNodeId,
        validIds,
        positionedNodes,
        nextEdges,
      ),
    }
  }

  addNodeToLoopBody(
    loopNodeId: string,
    nodeType: TestFlowNodeType,
  ): LoopBodyGraphState | null {
    if (!isLoopBodyWorkNodeType(nodeType)) return null

    const loopNode = this.state.nodes.find((node) => node.id === loopNodeId)
    if (!loopNode) return null

    const currentIds = readLoopBodyNodeIds((loopNode.data as WorkflowNodeData).config)
    const newNode = createWorkflowNode(nodeType, loopNode.position)
    const nextEdges = connectNewLoopBodyMember(
      currentIds,
      newNode.id,
      this.state.nodes,
      this.state.edges,
    )

    return new LoopBodyAggregate(this.dependencies, {
      nodes: [...this.state.nodes, newNode],
      edges: nextEdges,
    }).applyLoopBodyUpdate(loopNodeId, [...currentIds, newNode.id])
  }

  removeNodeFromLoopBody(loopNodeId: string, bodyNodeId: string): LoopBodyGraphState {
    const loopNode = this.state.nodes.find((node) => node.id === loopNodeId)
    if (!loopNode) return this.state

    const currentIds = readLoopBodyNodeIds((loopNode.data as WorkflowNodeData).config)
    const nextIds = currentIds.filter((id) => id !== bodyNodeId)
    const prunedEdges = this.state.edges.filter(
      (edge) => edge.source !== bodyNodeId && edge.target !== bodyNodeId,
    )
    const nextNodes = this.state.nodes.filter((node) => node.id !== bodyNodeId)

    return new LoopBodyAggregate(this.dependencies, {
      nodes: nextNodes,
      edges: prunedEdges,
    }).applyLoopBodyUpdate(loopNodeId, nextIds)
  }

  reorderLoopBody(
    loopNodeId: string,
    fromIndex: number,
    toIndex: number,
  ): LoopBodyGraphState {
    const loopNode = this.state.nodes.find((node) => node.id === loopNodeId)
    if (!loopNode) return this.state

    const currentIds = readLoopBodyNodeIds((loopNode.data as WorkflowNodeData).config)
    const nextIds = [...currentIds]
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= nextIds.length ||
      toIndex >= nextIds.length
    ) {
      return this.state
    }

    const [moved] = nextIds.splice(fromIndex, 1)
    nextIds.splice(toIndex, 0, moved)

    return this.applyLoopBodyUpdate(loopNodeId, nextIds)
  }

  appendTargetToLoopBodyOnConnect(connection: Connection): LoopBodyGraphState {
    if (
      !connection.source ||
      !connection.target ||
      connection.sourceHandle !== LOOP_BODY_BRANCH_ID
    ) {
      return this.state
    }

    const sourceNode = this.state.nodes.find((node) => node.id === connection.source)
    if (!sourceNode || !isLoopNodeType((sourceNode.data as WorkflowNodeData).nodeType ?? '')) {
      return this.state
    }

    const targetNode = this.state.nodes.find((node) => node.id === connection.target)
    const targetType = (targetNode?.data as WorkflowNodeData | undefined)?.nodeType ?? 'script'
    if (!targetNode || !isLoopBodyWorkNodeType(targetType as TestFlowNodeType)) {
      return this.state
    }

    const currentIds = readLoopBodyNodeIds((sourceNode.data as WorkflowNodeData).config)
    if (currentIds.includes(connection.target)) {
      return this.applyLoopBodyUpdate(connection.source, currentIds)
    }

    return this.applyLoopBodyUpdate(connection.source, [...currentIds, connection.target])
  }

  static loopBackHandle(): string {
    return LOOP_CONTINUE_SOURCE_HANDLE
  }
}
