import { useEffect, useMemo, useState } from 'react'
import type { Node } from '@xyflow/react'

import { getWorkflowNodeLabel } from '@/components/test-flow/workflow-node-definitions'
import {
  addIfElseBranch,
  addLoopBreakExit,
  DEFAULT_LOOP_BRANCHES,
  isElseBranchIndex,
  isLoopNodeType,
  migrateLoopNodeConfig,
  normalizeIfElseBranches,
  normalizeLoopBreakExits,
  readIfElseBranches,
  readLoopBodyNodeIds,
  readLoopBreakExits,
  removeIfElseBranch,
  removeLoopBreakExit,
  resolveLoopBodySteps,
  type IfElseBranch,
  type LoopBodyStep,
  type WorkflowNodeData,
} from '@/lib/test-flow-graph'

const MIN_IF_ELSE_BRANCHES = 2

export function useWorkflowNodeEditorForm(node: Node | null, allNodes: Node[] = []) {
  const nodeData = (node?.data ?? {}) as WorkflowNodeData
  const nodeType = nodeData.nodeType ?? 'script'

  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [scriptLanguage, setScriptLanguage] = useState<'javascript' | 'python' | 'bash'>(
    'javascript',
  )
  const [scriptContent, setScriptContent] = useState('')
  const [branches, setBranches] = useState<IfElseBranch[]>([])
  const [breakExits, setBreakExits] = useState<IfElseBranch[]>([])

  const isIfElseNode = nodeType === 'if-else'
  const isLoopNode = isLoopNodeType(nodeType)

  const loopBodySteps = useMemo<LoopBodyStep[]>(() => {
    if (!node || !isLoopNode) return []
    return resolveLoopBodySteps(readLoopBodyNodeIds(nodeData.config), allNodes)
  }, [allNodes, isLoopNode, node, nodeData.config])

  useEffect(() => {
    if (!node) return

    setLabel(nodeData.label ?? getWorkflowNodeLabel(nodeType))
    setDescription(nodeData.description ?? '')
    setScriptLanguage(nodeData.scriptLanguage ?? 'javascript')
    setScriptContent(nodeData.scriptContent ?? '')
    setBranches(isIfElseNode ? readIfElseBranches(nodeData.config) : [])
    setBreakExits(isLoopNode ? readLoopBreakExits(nodeData.config) : [])
  }, [
    node,
    isIfElseNode,
    isLoopNode,
    nodeData.config,
    nodeData.description,
    nodeData.label,
    nodeData.scriptContent,
    nodeData.scriptLanguage,
    nodeType,
  ])

  const handleBranchLabelChange = (branchId: string, nextLabel: string) => {
    setBranches((current) =>
      normalizeIfElseBranches(
        current.map((branch, index) =>
          branch.id === branchId && !isElseBranchIndex(index, current.length)
            ? { ...branch, label: nextLabel }
            : branch,
        ),
      ),
    )
  }

  const handleLoopBreakLabelChange = (branchId: string, nextLabel: string) => {
    setBreakExits((current) =>
      normalizeLoopBreakExits(
        current.map((branch) =>
          branch.id === branchId ? { ...branch, label: nextLabel } : branch,
        ),
      ),
    )
  }

  const handleAddBranch = () => {
    setBranches((current) => (isLoopNode ? current : addIfElseBranch(current)))
    if (isLoopNode) {
      setBreakExits((current) => addLoopBreakExit(current))
    }
  }

  const handleRemoveBranch = (branchId: string) => {
    if (isLoopNode) {
      setBreakExits((current) => removeLoopBreakExit(current, branchId))
      return
    }
    setBranches((current) => removeIfElseBranch(current, branchId))
  }

  const buildSavePayload = (): Partial<WorkflowNodeData> | null => {
    if (!node) return null

    const trimmedLabel = label.trim()
    if (!trimmedLabel) {
      return null
    }

    const normalizedIfElseBranches = normalizeIfElseBranches(
      branches.map((branch) => ({
        ...branch,
        label: branch.label.trim() || branch.id,
      })),
    )

    if (nodeType === 'if-else' && normalizedIfElseBranches.length < MIN_IF_ELSE_BRANCHES) {
      return null
    }

    const normalizedLoopBreakExits = normalizeLoopBreakExits(
      breakExits.map((branch) => ({
        ...branch,
        label: branch.label.trim() || branch.id,
      })),
    )

    return {
      label: trimmedLabel,
      description: description.trim(),
      scriptLanguage: nodeType === 'script' ? scriptLanguage : nodeData.scriptLanguage,
      scriptContent: nodeType === 'script' ? scriptContent : nodeData.scriptContent,
      ...(isIfElseNode
        ? {
            config: {
              ...(nodeData.config ?? {}),
              branches: normalizedIfElseBranches,
            },
          }
        : isLoopNode
          ? {
              config: migrateLoopNodeConfig({
                ...(nodeData.config ?? {}),
                branches: [...DEFAULT_LOOP_BRANCHES],
                breakExits: normalizedLoopBreakExits,
                bodyNodeIds: readLoopBodyNodeIds(nodeData.config),
              }),
            }
          : {}),
    }
  }

  return {
    nodeType,
    nodeData,
    label,
    setLabel,
    description,
    setDescription,
    scriptLanguage,
    setScriptLanguage,
    scriptContent,
    setScriptContent,
    branches,
    breakExits,
    isIfElseNode,
    isLoopNode,
    loopBodySteps,
    minIfElseBranches: MIN_IF_ELSE_BRANCHES,
    handleBranchLabelChange,
    handleLoopBreakLabelChange,
    handleAddBranch,
    handleRemoveBranch,
    buildSavePayload,
  }
}
