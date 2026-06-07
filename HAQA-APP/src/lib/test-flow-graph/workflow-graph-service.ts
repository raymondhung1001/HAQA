import type { Connection, Edge, Node } from '@xyflow/react'

import type { TestFlowNodeType, WorkflowNodeData } from './types'
import { connectEdge, pruneEdgesForRemovedBranches } from './connections'
import { swapAdjacentWorkflowNode, repositionNodeForBranchConnection, getNextNodePosition } from './layout'
import { normalizeLoopBodyBreakTargetConnection } from './edge-helpers'
import {
  addNodeToLoopBody,
  appendTargetToLoopBodyOnConnect,
  applyLoopNodeConfigUpdate,
  deleteWorkflowNodes,
  removeNodeFromLoopBody,
  reorderLoopBody,
  syncLoopBodyGraphLayout,
} from './loop-body'
import { createWorkflowNode } from './nodes'
import { isLoopNodeType, migrateLoopNodeConfig, readIfElseBranches } from './branch-config'

export type WorkflowGraphState = {
  nodes: Node[]
  edges: Edge[]
}

export class WorkflowGraphService {
  applyLoopBodyRelayout(nextNodes: Node[], nextEdges: Edge[]): WorkflowGraphState {
    return syncLoopBodyGraphLayout(nextNodes, nextEdges)
  }

  deleteNodes(requestedIds: string[], state: WorkflowGraphState) {
    return deleteWorkflowNodes(requestedIds, state.nodes, state.edges)
  }

  swapAdjacent(
    state: WorkflowGraphState,
    nodeId: string,
    direction: 'left' | 'right',
  ): WorkflowGraphState {
    return swapAdjacentWorkflowNode(state.nodes, state.edges, nodeId, direction)
  }

  connect(connection: Connection, state: WorkflowGraphState): WorkflowGraphState {
    const normalized = normalizeLoopBodyBreakTargetConnection(connection, state.nodes)
    const nextEdges = connectEdge(normalized, state.edges, state.nodes)
    const nextNodes = repositionNodeForBranchConnection(state.nodes, normalized)
    return appendTargetToLoopBodyOnConnect(normalized, nextNodes, nextEdges)
  }

  addLoopBodyNode(
    loopNodeId: string,
    nodeType: TestFlowNodeType,
    state: WorkflowGraphState,
  ): WorkflowGraphState | null {
    return addNodeToLoopBody(loopNodeId, nodeType, state.nodes, state.edges)
  }

  removeLoopBodyNode(loopNodeId: string, bodyNodeId: string, state: WorkflowGraphState): WorkflowGraphState {
    return removeNodeFromLoopBody(loopNodeId, bodyNodeId, state.nodes, state.edges)
  }

  reorderLoopBody(
    loopNodeId: string,
    fromIndex: number,
    toIndex: number,
    state: WorkflowGraphState,
  ): WorkflowGraphState {
    return reorderLoopBody(loopNodeId, fromIndex, toIndex, state.nodes, state.edges)
  }

  addNode(nodeType: TestFlowNodeType, state: WorkflowGraphState): WorkflowGraphState {
    const position = getNextNodePosition(state.nodes, state.edges)
    return {
      nodes: [...state.nodes, createWorkflowNode(nodeType, position)],
      edges: state.edges,
    }
  }

  updateNode(
    nodeId: string,
    updates: Partial<WorkflowNodeData>,
    state: WorkflowGraphState,
    patchWorkflowNodeData: (
      nodes: Node[],
      nodeId: string,
      updates: Partial<WorkflowNodeData>,
    ) => Node[],
    patchLoopNodeData: (
      nodes: Node[],
      nodeId: string,
      updates: Partial<WorkflowNodeData>,
    ) => Node[],
  ): WorkflowGraphState {
    const existing = state.nodes.find((node) => node.id === nodeId)
    const nodeType = (existing?.data as WorkflowNodeData | undefined)?.nodeType

    let nextEdges = state.edges
    if (updates.config?.branches && nodeType === 'if-else') {
      const branches = readIfElseBranches(updates.config)
      if (branches.length > 0) {
        nextEdges = pruneEdgesForRemovedBranches(nextEdges, nodeId, branches)
      }
    }

    if (isLoopNodeType(nodeType ?? '') && updates.config) {
      const mergedConfig = migrateLoopNodeConfig({
        ...((existing?.data as WorkflowNodeData | undefined)?.config ?? {}),
        ...updates.config,
      })
      return applyLoopNodeConfigUpdate(
        nodeId,
        mergedConfig,
        patchLoopNodeData(state.nodes, nodeId, updates),
        nextEdges,
      )
    }

    return {
      nodes: patchWorkflowNodeData(state.nodes, nodeId, updates),
      edges: nextEdges,
    }
  }
}
