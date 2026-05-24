import { useEffect, useMemo, useState } from 'react'
import type { Node } from '@xyflow/react'
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import {
  getLoopBodyWorkNodeDefinitions,
  getWorkflowNodeLabel,
} from '@/components/test-flow/workflow-node-definitions'
import {
  addIfElseBranch,
  addLoopBreakCondition,
  isElseBranchIndex,
  isLoopBodyBranchIndex,
  isLoopDoneBranchIndex,
  isLoopNodeType,
  normalizeIfElseBranches,
  normalizeLoopBranches,
  readIfElseBranches,
  readLoopBodyNodeIds,
  readLoopBranches,
  removeIfElseBranch,
  removeLoopBreakCondition,
  resolveLoopBodySteps,
  type IfElseBranch,
  type LoopBodyStep,
  type TestFlowNodeType,
  type WorkflowNodeData,
} from '@/lib/test-flow-graph'

const MIN_IF_ELSE_BRANCHES = 2
const MIN_LOOP_BRANCHES = 2

interface WorkflowNodeEditorProps {
  node: Node | null
  allNodes?: Node[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (nodeId: string, data: Partial<WorkflowNodeData>) => void
  onAddLoopBodyNode?: (loopNodeId: string, nodeType: TestFlowNodeType) => void
  onRemoveLoopBodyNode?: (loopNodeId: string, bodyNodeId: string) => void
  onReorderLoopBodyNode?: (loopNodeId: string, fromIndex: number, toIndex: number) => void
}

export function WorkflowNodeEditor({
  node,
  allNodes = [],
  open,
  onOpenChange,
  onSave,
  onAddLoopBodyNode,
  onRemoveLoopBodyNode,
  onReorderLoopBodyNode,
}: WorkflowNodeEditorProps) {
  const nodeData = (node?.data ?? {}) as WorkflowNodeData
  const nodeType = nodeData.nodeType ?? 'script'

  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [scriptLanguage, setScriptLanguage] = useState<'javascript' | 'python' | 'bash'>(
    'javascript',
  )
  const [scriptContent, setScriptContent] = useState('')
  const [branches, setBranches] = useState<IfElseBranch[]>([])

  const isIfElseNode = nodeType === 'if-else'
  const isLoopNode = isLoopNodeType(nodeType)
  const loopBodyWorkDefinitions = useMemo(
    () => getLoopBodyWorkNodeDefinitions() ?? [],
    [],
  )

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
    setBranches(
      isIfElseNode
        ? readIfElseBranches(nodeData.config)
        : isLoopNode
          ? readLoopBranches(nodeData.config)
          : [],
    )
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
    setBranches((current) =>
      normalizeLoopBranches(
        current.map((branch, index) =>
          branch.id === branchId &&
          !isLoopBodyBranchIndex(index) &&
          !isLoopDoneBranchIndex(index, current.length)
            ? { ...branch, label: nextLabel }
            : branch,
        ),
      ),
    )
  }

  const handleAddBranch = () => {
    setBranches((current) =>
      isLoopNode ? addLoopBreakCondition(current) : addIfElseBranch(current),
    )
  }

  const handleRemoveBranch = (branchId: string) => {
    setBranches((current) =>
      isLoopNode ? removeLoopBreakCondition(current, branchId) : removeIfElseBranch(current, branchId),
    )
  }

  const handleSave = () => {
    if (!node) return

    const trimmedLabel = label.trim()
    if (!trimmedLabel) {
      alert('Please enter a node name')
      return
    }

    const normalizedIfElseBranches = normalizeIfElseBranches(
      branches.map((branch) => ({
        ...branch,
        label: branch.label.trim() || branch.id,
      })),
    )

    if (nodeType === 'if-else' && normalizedIfElseBranches.length < MIN_IF_ELSE_BRANCHES) {
      alert('If / Else nodes need at least two output branches')
      return
    }

    const normalizedLoopBranches = normalizeLoopBranches(
      branches.map((branch) => ({
        ...branch,
        label: branch.label.trim() || branch.id,
      })),
    )

    if (isLoopNode && normalizedLoopBranches.length < MIN_LOOP_BRANCHES) {
      alert('Loop nodes need at least Loop and Done outputs')
      return
    }

    onSave(node.id, {
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
              config: {
                ...(nodeData.config ?? {}),
                branches: normalizedLoopBranches,
                bodyNodeIds: readLoopBodyNodeIds(nodeData.config),
              },
            }
          : {}),
    })
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Edit Workflow Node</SheetTitle>
          <SheetDescription>
            Update the node name, description, and configuration for this step.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Enter node name"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              rows={3}
              placeholder="Describe what this step does"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Node Type</label>
            <p className="rounded-md border bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:bg-slate-900 dark:text-gray-300">
              {getWorkflowNodeLabel(nodeType)}
            </p>
          </div>

          {nodeType === 'if-else' && (
            <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Output branches</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Add conditional paths before the reserved Else branch.
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={handleAddBranch}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add
                </Button>
              </div>

              <div className="space-y-2">
                {(branches ?? []).map((branch, index) => {
                  const isElseBranch = isElseBranchIndex(index, (branches ?? []).length)

                  return (
                    <div key={branch.id} className="flex items-center gap-2">
                      <span className="w-5 shrink-0 text-xs text-gray-400">{index + 1}.</span>
                      {isElseBranch ? (
                        <div className="min-w-0 flex-1 rounded-md border bg-white px-3 py-2 text-sm text-gray-700 dark:bg-slate-900 dark:text-gray-300">
                          Else
                          <span className="ml-2 text-xs text-gray-400">(reserved)</span>
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={branch.label}
                          onChange={(e) => handleBranchLabelChange(branch.id, e.target.value)}
                          className="min-w-0 flex-1 rounded-md border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:bg-slate-900"
                          placeholder="Branch label"
                        />
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="shrink-0"
                        disabled={isElseBranch || branches.length <= MIN_IF_ELSE_BRANCHES}
                        onClick={() => handleRemoveBranch(branch.id)}
                        title={
                          isElseBranch
                            ? 'The Else branch is always kept as the last output'
                            : branches.length <= MIN_IF_ELSE_BRANCHES
                              ? 'At least two branches are required'
                              : 'Remove branch'
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {isLoopNode && (
            <div className="space-y-3 rounded-lg border border-green-200 bg-green-50/60 p-3 dark:border-green-900/50 dark:bg-green-950/20">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Loop body steps</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Work nodes executed on each iteration via the Loop handle.
                </p>
              </div>

              <div className="space-y-2">
                {loopBodySteps.length === 0 ? (
                  <p className="rounded-md border border-dashed bg-white px-3 py-2 text-xs text-gray-500 dark:bg-slate-900 dark:text-gray-400">
                    No steps yet. Add a work node type below.
                  </p>
                ) : (
                  loopBodySteps.map((step, index) => (
                    <div key={step.id} className="flex items-center gap-2">
                      <span className="w-5 shrink-0 text-xs text-gray-400">{index + 1}.</span>
                      <div className="min-w-0 flex-1 rounded-md border bg-white px-3 py-2 text-sm text-gray-700 dark:bg-slate-900 dark:text-gray-300">
                        <span className="font-medium">{step.label}</span>
                        <span className="ml-2 text-xs text-gray-400">
                          {getWorkflowNodeLabel(step.nodeType)}
                        </span>
                      </div>
                      <div className="flex shrink-0 flex-col gap-0.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          disabled={index === 0}
                          onClick={() => onReorderLoopBodyNode?.(node!.id, index, index - 1)}
                          title="Move step up"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          disabled={index === loopBodySteps.length - 1}
                          onClick={() => onReorderLoopBodyNode?.(node!.id, index, index + 1)}
                          title="Move step down"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="shrink-0"
                        onClick={() => onRemoveLoopBodyNode?.(node!.id, step.id)}
                        title="Remove from loop body"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {loopBodyWorkDefinitions.map((definition) => {
                  const Icon = definition.icon

                  return (
                    <Button
                      key={definition.type}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onAddLoopBodyNode?.(node!.id, definition.type)}
                    >
                      <Icon className="mr-1 h-3.5 w-3.5" />
                      {definition.label}
                    </Button>
                  )
                })}
              </div>
            </div>
          )}

          {isLoopNode && (
            <div className="space-y-3 rounded-lg border border-orange-200 bg-orange-50/60 p-3 dark:border-orange-900/50 dark:bg-orange-950/20">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    Break on conditions
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Loop and Done are reserved. Add break exits between them.
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={handleAddBranch}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add
                </Button>
              </div>

              <div className="space-y-2">
                {(branches ?? []).map((branch, index) => {
                  const isLoopBody = isLoopBodyBranchIndex(index)
                  const isDoneBranch = isLoopDoneBranchIndex(index, (branches ?? []).length)

                  return (
                    <div key={branch.id} className="flex items-center gap-2">
                      <span className="w-5 shrink-0 text-xs text-gray-400">{index + 1}.</span>
                      {isLoopBody || isDoneBranch ? (
                        <div className="min-w-0 flex-1 rounded-md border bg-white px-3 py-2 text-sm text-gray-700 dark:bg-slate-900 dark:text-gray-300">
                          {isLoopBody ? 'Loop' : 'Done'}
                          <span className="ml-2 text-xs text-gray-400">(reserved)</span>
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={branch.label}
                          onChange={(e) => handleLoopBreakLabelChange(branch.id, e.target.value)}
                          className="min-w-0 flex-1 rounded-md border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:bg-slate-900"
                          placeholder="Break condition label"
                        />
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="shrink-0"
                        disabled={
                          isLoopBody || isDoneBranch || branches.length <= MIN_LOOP_BRANCHES
                        }
                        onClick={() => handleRemoveBranch(branch.id)}
                        title={
                          isLoopBody
                            ? 'The Loop output is always kept as the first path'
                            : isDoneBranch
                              ? 'The Done output is always kept as the last path'
                              : branches.length <= MIN_LOOP_BRANCHES
                                ? 'At least Loop and Done outputs are required'
                                : 'Remove break condition'
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {nodeType === 'script' && (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium">Script Language</label>
                <select
                  value={scriptLanguage}
                  onChange={(e) =>
                    setScriptLanguage(e.target.value as 'javascript' | 'python' | 'bash')
                  }
                  className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="javascript">JavaScript</option>
                  <option value="python">Python</option>
                  <option value="bash">Bash</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Script</label>
                <textarea
                  value={scriptContent}
                  onChange={(e) => setScriptContent(e.target.value)}
                  className="min-h-[220px] w-full rounded-md border px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="// Enter script code"
                  spellCheck={false}
                />
              </div>
            </>
          )}
        </div>

        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Node</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
