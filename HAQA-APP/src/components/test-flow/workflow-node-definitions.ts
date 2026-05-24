import {
  Play,
  Square,
  Code2,
  Globe,
  GitBranch,
  Repeat,
  RefreshCw,
  Clock,
  type LucideIcon,
} from 'lucide-react'
import type { TestFlowNodeType } from '@/lib/test-flow-graph'

export interface WorkflowNodeDefinition {
  type: TestFlowNodeType
  label: string
  description: string
  icon: LucideIcon
}

export const WORKFLOW_NODE_DEFINITIONS: WorkflowNodeDefinition[] = [
  { type: 'start', label: 'Start', description: 'Flow entry point', icon: Play },
  { type: 'end', label: 'End', description: 'Flow exit point', icon: Square },
  { type: 'script', label: 'Script', description: 'Run custom code', icon: Code2 },
  { type: 'api-call', label: 'API Call', description: 'HTTP request step', icon: Globe },
  { type: 'if-else', label: 'If / Else', description: 'Conditional branch', icon: GitBranch },
  { type: 'for-loop', label: 'For Loop', description: 'Iterate a fixed count', icon: Repeat },
  { type: 'do-while', label: 'Do While', description: 'Loop until condition', icon: RefreshCw },
  { type: 'wait', label: 'Wait', description: 'Pause execution', icon: Clock },
]

/** Work node types that can be placed inside a loop body. */
export const LOOP_BODY_WORK_NODE_TYPES: TestFlowNodeType[] = [
  'script',
  'api-call',
  'wait',
  'if-else',
]

export function isLoopBodyWorkNodeType(nodeType: TestFlowNodeType): boolean {
  return LOOP_BODY_WORK_NODE_TYPES.includes(nodeType)
}

export function getLoopBodyWorkNodeDefinitions(): WorkflowNodeDefinition[] {
  return WORKFLOW_NODE_DEFINITIONS.filter((def) => isLoopBodyWorkNodeType(def.type))
}

export function isTestFlowNodeType(value: string): value is TestFlowNodeType {
  return WORKFLOW_NODE_DEFINITIONS.some((def) => def.type === value)
}

export function getWorkflowNodeLabel(nodeType: TestFlowNodeType): string {
  return WORKFLOW_NODE_DEFINITIONS.find((def) => def.type === nodeType)?.label ?? nodeType
}
