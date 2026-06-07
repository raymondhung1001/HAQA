import type { Connection, Edge, Node } from '@xyflow/react'
import { Position } from '@xyflow/react'
import { WORKFLOW_EDGE_OPTIONS } from './constants'
import {
  LOOP_BODY_BRANCH_ID,
  LOOP_DONE_BRANCH_ID,
  LOOP_CONTINUE_SOURCE_HANDLE,
} from './constants'
import { getBreakExitsForLoopBodyGroup, isLoopBodyGroupNode } from './loop-body'

export function isLoopBodyBreakTargetEdge(edge: Edge): boolean {
  return (
    typeof edge.target === 'string' &&
    edge.target.endsWith('-loop-body') &&
    typeof edge.targetHandle === 'string' &&
    edge.targetHandle.endsWith('-target')
  )
}

function isLoopToBodyEntryEdge(edge: Edge): boolean {
  return (
    edge.sourceHandle === LOOP_BODY_BRANCH_ID &&
    typeof edge.target === 'string' &&
    !edge.target.endsWith('-loop-body')
  )
}

/** Map drops on the visible break source dot to the target handle id. */
export function normalizeLoopBodyBreakTargetConnection(
  connection: Connection,
  nodes: Node[],
): Connection {
  if (!connection.target) return connection

  const targetNode = nodes.find((node) => node.id === connection.target)
  if (!targetNode || !isLoopBodyGroupNode(targetNode)) return connection

  const breakExits = getBreakExitsForLoopBodyGroup(targetNode, nodes)
  if (breakExits.length === 0) return connection

  if (connection.targetHandle?.endsWith('-target')) return connection

  if (connection.targetHandle) {
    const branch = breakExits.find((exit) => exit.id === connection.targetHandle)
    if (branch) {
      return { ...connection, targetHandle: `${branch.id}-target` }
    }
  }

  if (breakExits.length === 1) {
    return { ...connection, targetHandle: `${breakExits[0].id}-target` }
  }

  return connection
}

export function withWorkflowEdgeDefaults(edge: Edge): Edge {
  const isBreakTarget = isLoopBodyBreakTargetEdge(edge)
  const isLoopToBodyEntry = isLoopToBodyEntryEdge(edge)
  const isLoopBack =
    edge.sourceHandle === LOOP_CONTINUE_SOURCE_HANDLE || edge.data?.loopBack === true
  const isDoneFromLoopBody =
    typeof edge.source === 'string' &&
    edge.source.endsWith('-loop-body') &&
    edge.sourceHandle === LOOP_DONE_BRANCH_ID
  const isBreakFromLoopBody =
    typeof edge.source === 'string' &&
    edge.source.endsWith('-loop-body') &&
    Boolean(edge.sourceHandle) &&
    edge.sourceHandle !== LOOP_DONE_BRANCH_ID

  return {
    ...edge,
    ...WORKFLOW_EDGE_OPTIONS,
    ...(typeof edge.label === 'string' && edge.label.length > 0
      ? {
          label: edge.label,
          labelShowBg: true,
          labelStyle: { fontSize: 11, fontWeight: 500 },
          labelBgStyle: { fill: 'rgba(255,255,255,0.92)' },
        }
      : {}),
    ...(isBreakTarget
      ? { targetPosition: Position.Left, sourcePosition: Position.Right }
      : {}),
    ...(isLoopToBodyEntry
      ? { targetPosition: Position.Left, sourcePosition: Position.Right }
      : {}),
    ...(isLoopBack
      ? { targetPosition: Position.Left, sourcePosition: Position.Right, zIndex: -1 }
      : {}),
    pathOptions: {
      ...WORKFLOW_EDGE_OPTIONS.pathOptions,
      ...(edge.pathOptions ?? {}),
      ...(isLoopToBodyEntry ? { borderRadius: 0 } : {}),
      ...(isLoopBack ? { borderRadius: 10 } : {}),
    },
    style: {
      ...WORKFLOW_EDGE_OPTIONS.style,
      ...(edge.style ?? {}),
      ...(isBreakTarget || isBreakFromLoopBody ? { stroke: '#f97316' } : {}),
      ...(isDoneFromLoopBody ? { stroke: '#3b82f6' } : {}),
      ...(isLoopBack ? { strokeDasharray: '6 4', opacity: 0.45 } : {}),
    },
  }
}

export function isLoopBackEdge(edge: Edge): boolean {
  return edge.sourceHandle === LOOP_CONTINUE_SOURCE_HANDLE || edge.data?.loopBack === true
}

/** UI-only edges excluded from persisted workflow graphs. */
export function isUiOnlyEdge(edge: Edge): boolean {
  return isLoopBackEdge(edge) || isLoopBodyBreakTargetEdge(edge)
}
