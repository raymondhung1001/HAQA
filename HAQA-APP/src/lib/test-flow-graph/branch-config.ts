import type { WorkflowNodeData, IfElseBranch, TestFlowNodeType, LoopBodyStep } from './types'
import {
  DEFAULT_IF_ELSE_BRANCHES,
  IF_ELSE_ELSE_BRANCH_ID,
  MIN_IF_ELSE_BRANCHES,
  IF_ELSE_ELSE_BRANCH_LABEL,
  LOOP_BODY_BRANCH_ID,
  LOOP_DONE_BRANCH_ID,
  DEFAULT_LOOP_BRANCHES,
  MIN_LOOP_BRANCHES,
  LOOP_CONFIG_VERSION,
} from './constants'
import { createNodeId } from './nodes'
import {
  IF_ELSE_NODE_LAYOUT,
} from '@/components/test-flow/workflow-node-layout'
import {
  getWorkflowNodeLabel,
  getWorkflowNodeTypeOrdinals,
  resolveWorkflowNodeDisplayLabel,
} from '@/components/test-flow/workflow-node-definitions'
import type { Node } from '@xyflow/react'

function isIfElseBranch(value: unknown): value is IfElseBranch {
  if (!value || typeof value !== 'object') return false
  const branch = value as IfElseBranch
  return typeof branch.id === 'string' && branch.id.length > 0 && typeof branch.label === 'string'
}

export function readIfElseBranches(config?: Record<string, unknown> | null): IfElseBranch[] {
  const raw = config?.branches
  if (!Array.isArray(raw)) return [...DEFAULT_IF_ELSE_BRANCHES]

  const branches = raw.filter(isIfElseBranch).map((branch) => ({
    id: branch.id,
    label: branch.label.trim() || branch.id,
  }))

  if (branches.length < MIN_IF_ELSE_BRANCHES) return [...DEFAULT_IF_ELSE_BRANCHES]

  return normalizeIfElseBranches(branches)
}

export function isElseBranchIndex(index: number, count: number): boolean {
  return count > 0 && index === count - 1
}

export function normalizeIfElseBranches(branches: IfElseBranch[]): IfElseBranch[] {
  if (branches.length < MIN_IF_ELSE_BRANCHES) return [...DEFAULT_IF_ELSE_BRANCHES]

  const normalized = branches.map((branch) => ({ ...branch }))
  const lastIndex = normalized.length - 1

  for (let index = 0; index < lastIndex; index += 1) {
    if (normalized[index].id === IF_ELSE_ELSE_BRANCH_ID) {
      normalized[index] = { ...normalized[index], id: createNodeId() }
    }
  }

  normalized[lastIndex] = {
    id: IF_ELSE_ELSE_BRANCH_ID,
    label: IF_ELSE_ELSE_BRANCH_LABEL,
  }

  return normalized
}

export function addIfElseBranch(branches: IfElseBranch[], label?: string): IfElseBranch[] {
  const normalized = normalizeIfElseBranches(branches)
  const elseBranch = normalized[normalized.length - 1]
  const newBranch = createIfElseBranch(label ?? `Branch ${normalized.length}`)

  return normalizeIfElseBranches([
    ...normalized.slice(0, normalized.length - 1),
    newBranch,
    elseBranch,
  ])
}

export function removeIfElseBranch(branches: IfElseBranch[], branchId: string): IfElseBranch[] {
  const normalized = normalizeIfElseBranches(branches)
  if (normalized.length <= MIN_IF_ELSE_BRANCHES) return normalized

  const branchIndex = normalized.findIndex((branch) => branch.id === branchId)
  if (branchIndex === -1 || isElseBranchIndex(branchIndex, normalized.length)) {
    return normalized
  }

  return normalizeIfElseBranches(normalized.filter((branch) => branch.id !== branchId))
}

export function getIfElseBranches(data: WorkflowNodeData): IfElseBranch[] {
  return readIfElseBranches(data.config)
}

export function readLoopBreakExits(config?: Record<string, unknown> | null): IfElseBranch[] {
  const raw = config?.breakExits
  if (Array.isArray(raw)) {
    return raw
      .filter(isIfElseBranch)
      .map((branch) => ({ id: branch.id, label: branch.label.trim() || branch.id }))
  }

  return extractLegacyLoopBreakExits(config)
}

function extractLegacyLoopBreakExits(config?: Record<string, unknown> | null): IfElseBranch[] {
  const raw = config?.branches
  if (!Array.isArray(raw)) return []

  const branches = raw.filter(isIfElseBranch)
  if (branches.length <= MIN_LOOP_BRANCHES) return []

  return branches.slice(1, -1).map((branch) => ({
    id: branch.id,
    label: branch.label.trim() || branch.id,
  }))
}

export function normalizeLoopBreakExits(breakExits: IfElseBranch[]): IfElseBranch[] {
  return breakExits.map((branch) => ({
    id: branch.id,
    label: branch.label.trim() || branch.id,
  }))
}

export function addLoopBreakExit(breakExits: IfElseBranch[], label?: string): IfElseBranch[] {
  const count = breakExits.length
  return normalizeLoopBreakExits([
    ...breakExits,
    createIfElseBranch(label ?? `Break ${count + 1}`),
  ])
}

export function removeLoopBreakExit(breakExits: IfElseBranch[], branchId: string): IfElseBranch[] {
  return normalizeLoopBreakExits(breakExits.filter((branch) => branch.id !== branchId))
}

/** @deprecated Use addLoopBreakExit on breakExits */
export function addLoopBreakCondition(_branches: IfElseBranch[], label?: string): IfElseBranch[] {
  return addLoopBreakExit([], label)
}

export function isLoopNodeType(nodeType: string): nodeType is 'for-loop' | 'do-while' {
  return nodeType === 'for-loop' || nodeType === 'do-while'
}

export function isBranchingNodeType(nodeType: string): boolean {
  return nodeType === 'if-else' || isLoopNodeType(nodeType)
}

export function readLoopBranches(_config?: Record<string, unknown> | null): IfElseBranch[] {
  return [...DEFAULT_LOOP_BRANCHES]
}

export function isLoopBodyBranchIndex(index: number): boolean {
  return index === 0
}

export function isLoopDoneBranchIndex(index: number, count: number): boolean {
  return count > 0 && index === count - 1
}

export function normalizeLoopBranches(_branches: IfElseBranch[]): IfElseBranch[] {
  return [...DEFAULT_LOOP_BRANCHES]
}

/** @deprecated Use removeLoopBreakExit on breakExits */
export function removeLoopBreakCondition(breakExits: IfElseBranch[], branchId: string): IfElseBranch[] {
  return removeLoopBreakExit(breakExits, branchId)
}

export function migrateLoopNodeConfig(
  config?: Record<string, unknown> | null,
): Record<string, unknown> {
  const next = { ...(config ?? {}) }
  const legacyBreaks = extractLegacyLoopBreakExits(next)
  const existingBreaks = Array.isArray(next.breakExits)
    ? (next.breakExits as IfElseBranch[]).filter(isIfElseBranch)
    : []

  next.breakExits = normalizeLoopBreakExits(
    existingBreaks.length > 0 ? existingBreaks : legacyBreaks,
  )
  next.branches = [...DEFAULT_LOOP_BRANCHES]
  next.loopConfigVersion = LOOP_CONFIG_VERSION
  return next
}

export function getLoopBranches(data: WorkflowNodeData): IfElseBranch[] {
  return readLoopBranches(data.config)
}

export function getNodeOutputBranches(data: WorkflowNodeData): IfElseBranch[] {
  const nodeType = data.nodeType ?? 'script'
  if (nodeType === 'if-else') return getIfElseBranches(data)
  if (isLoopNodeType(nodeType)) return getLoopBranches(data)
  return []
}

export interface LoopBodyStep {
  id: string
  label: string
  /** Type label with optional ordinal when duplicates exist (e.g. "Script 1"). */
  displayLabel: string
  nodeType: TestFlowNodeType
  typeOrdinal?: number
}

export function readLoopBodyNodeIds(config?: Record<string, unknown> | null): string[] {
  const raw = config?.bodyNodeIds
  if (!Array.isArray(raw)) return []

  return raw.filter((value): value is string => typeof value === 'string' && value.length > 0)
}

export function normalizeLoopBodyNodeIds(
  bodyNodeIds: string[],
  validNodeIds: Set<string>,
): string[] {
  const seen = new Set<string>()

  return bodyNodeIds.filter((id) => {
    if (!validNodeIds.has(id) || seen.has(id)) return false
    seen.add(id)
    return true
  })
}

function getNodeTypeFromMap(
  nodeMap: Map<string, Node>,
  nodeId: string,
): TestFlowNodeType | undefined {
  const node = nodeMap.get(nodeId)
  if (!node) return undefined
  return (node.data as WorkflowNodeData).nodeType ?? 'script'
}


export function resolveLoopBodySteps(
  bodyNodeIds: string[] | undefined | null,
  nodes: Node[] | undefined | null,
): LoopBodyStep[] {
  const ids = Array.isArray(bodyNodeIds) ? bodyNodeIds : []
  const nodeList = Array.isArray(nodes) ? nodes : []
  const nodeMap = new Map(nodeList.map((node) => [node.id, node]))
  const ordinals = getWorkflowNodeTypeOrdinals(ids, (nodeId) => getNodeTypeFromMap(nodeMap, nodeId))

  return ids
    .map((id) => nodeMap.get(id))
    .filter((node): node is Node => Boolean(node))
    .map((node) => {
      const data = node.data as WorkflowNodeData
      const nodeType = data.nodeType ?? 'script'
      const typeOrdinal = ordinals.get(node.id)
      const label = data.label?.trim() || getWorkflowNodeLabel(nodeType)
      const displayLabel = resolveWorkflowNodeDisplayLabel(nodeType, data.label, typeOrdinal)

      return {
        id: node.id,
        label,
        displayLabel,
        nodeType,
        typeOrdinal,
      }
    })
}

export function getLoopBranchRowCount(hasLoopBody: boolean): number {
  return hasLoopBody ? 1 : 2
}

export function getLoopNodeHeight(showFooter: boolean, branchRowCount = 2): number {
  const { paddingY, headerHeight, branchRowHeight, footerHeight } = IF_ELSE_NODE_LAYOUT

  return (
    paddingY * 2 +
    headerHeight +
    branchRowHeight * branchRowCount +
    (showFooter ? footerHeight : 0)
  )
}

export function getLoopBranchHandleTopPercent(
  rowIndex: number,
  showFooter: boolean,
  branchRowCount = 2,
): string {
  const nodeHeight = getLoopNodeHeight(showFooter, branchRowCount)
  const { paddingY, headerHeight, branchRowHeight } = IF_ELSE_NODE_LAYOUT

  const centerY =
    paddingY +
    headerHeight +
    rowIndex * branchRowHeight +
    branchRowHeight / 2

  return `${(centerY / nodeHeight) * 100}%`
}


export function createIfElseBranch(label?: string): IfElseBranch {
  return {
    id: createNodeId(),
    label: label?.trim() || `Branch`,
  }
}

function getBranchOffsetY(index: number, count: number): number {
  if (count <= 1) return 0
  const step = (VERTICAL_BRANCH_OFFSET * 2) / (count - 1)
  return (index - (count - 1) / 2) * step
}

export function getBranchHandleTopPercent(
  index: number,
  count: number,
  reserveHeader = false,
): string {
  if (count <= 1) return reserveHeader ? '58%' : '50%'

  const topPadding = reserveHeader ? 38 : 18
  const bottomPadding = reserveHeader ? 22 : 18
  const range = 100 - topPadding - bottomPadding

  return `${topPadding + (index / (count - 1)) * range}%`
}

export function getBranchHandleColorClass(
  index: number,
  count?: number,
  layout: 'if-else' | 'loop' = 'if-else',
): string {
  if (count !== undefined) {
    if (layout === 'loop') {
      if (index === 0) return '!border-green-500'
      if (index === count - 1) return '!border-blue-500'
      return BRANCH_HANDLE_COLORS[(index - 1) % BRANCH_HANDLE_COLORS.length]
    }

    if (isElseBranchIndex(index, count)) {
      return '!border-red-500'
    }
  }

  return BRANCH_HANDLE_COLORS[index % BRANCH_HANDLE_COLORS.length]
}

export { IF_ELSE_NODE_LAYOUT } from '@/components/test-flow/workflow-node-layout'

export function getIfElseNodeHeight(branchCount: number, showFooter: boolean): number {
  const { paddingY, headerHeight, branchRowHeight, footerHeight } = IF_ELSE_NODE_LAYOUT

  return (
    paddingY * 2 +
    headerHeight +
    branchCount * branchRowHeight +
    (showFooter ? footerHeight : 0)
  )
}

export function getIfElseBranchHandleTopPercent(
  rowIndex: number,
  branchCount: number,
  showFooter: boolean,
): string {
  const nodeHeight = getIfElseNodeHeight(branchCount, showFooter)
  const { paddingY, headerHeight, branchRowHeight } = IF_ELSE_NODE_LAYOUT
  const centerY = paddingY + headerHeight + rowIndex * branchRowHeight + branchRowHeight / 2

  return `${(centerY / nodeHeight) * 100}%`
}

