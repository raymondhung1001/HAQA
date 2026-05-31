import type { IfElseBranch } from './types'

export { WORKFLOW_CONNECTION_GAP } from '@/components/test-flow/workflow-node-layout'

import { WORKFLOW_CONNECTION_GAP } from '@/components/test-flow/workflow-node-layout'

export const WORKFLOW_NODE_TYPE = 'workflow' as const

export const HORIZONTAL_NODE_GAP = WORKFLOW_CONNECTION_GAP
export const VERTICAL_BRANCH_OFFSET = 120
export const LOOP_BODY_GROUP_NODE_TYPE = 'loop-body-group' as const
export const FLOW_BOARD_Y = 200
export const FLOW_BOARD_START_X = 40
export const POSITION_TOLERANCE = 10

/** Vertical center anchor — position.y aligns handle line without custom handle offsets. */
export const WORKFLOW_NODE_ORIGIN: [number, number] = [0, 0.5]

/** Loop body container uses top-left anchoring; layout math is from the box top edge. */
export const LOOP_BODY_GROUP_ORIGIN: [number, number] = [0, 0]

/** Shared React Flow edge styling for workflow connections. */
export const WORKFLOW_EDGE_OPTIONS = {
  type: 'smoothstep' as const,
  animated: true,
  pathOptions: {
    borderRadius: 10,
    offset: 10,
  },
  style: {
    strokeWidth: 2,
  },
} as const

export const MIN_IF_ELSE_BRANCHES = 2
export const IF_ELSE_ELSE_BRANCH_ID = 'false'
export const IF_ELSE_ELSE_BRANCH_LABEL = 'Else'
export const BRANCH_HANDLE_COLORS = [
  '!border-green-500',
  '!border-red-500',
  '!border-blue-500',
  '!border-violet-500',
  '!border-orange-500',
  '!border-cyan-500',
]

export const LOOP_BODY_BRANCH_ID = 'loop'
export const LOOP_DONE_BRANCH_ID = 'done'
export const LOOP_CONTINUE_SOURCE_HANDLE = 'continue'

export const DEFAULT_LOOP_BRANCHES: IfElseBranch[] = [
  { id: LOOP_BODY_BRANCH_ID, label: 'Loop' },
  { id: LOOP_DONE_BRANCH_ID, label: 'Done' },
]

export const MIN_LOOP_BRANCHES = 2
export const LOOP_BODY_BRANCH_LABEL = 'Loop'
export const LOOP_DONE_BRANCH_LABEL = 'Done'
export const LOOP_CONFIG_VERSION = 2

export const LOOP_BODY_BRANCH_STACK_GAP = 24

export const DEFAULT_IF_ELSE_BRANCHES: IfElseBranch[] = [
  { id: 'true', label: 'Yes' },
  { id: IF_ELSE_ELSE_BRANCH_ID, label: 'Else' },
]
