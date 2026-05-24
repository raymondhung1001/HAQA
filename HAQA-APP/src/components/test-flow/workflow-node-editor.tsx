import { useEffect, useState } from 'react'
import type { Node } from '@xyflow/react'
import { Plus, Trash2 } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { getWorkflowNodeLabel } from '@/components/test-flow/workflow-node-definitions'
import {
  addIfElseBranch,
  isElseBranchIndex,
  normalizeIfElseBranches,
  readIfElseBranches,
  removeIfElseBranch,
  type IfElseBranch,
  type WorkflowNodeData,
} from '@/lib/test-flow-graph'

const MIN_IF_ELSE_BRANCHES = 2

interface WorkflowNodeEditorProps {
  node: Node | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (nodeId: string, data: Partial<WorkflowNodeData>) => void
}

export function WorkflowNodeEditor({
  node,
  open,
  onOpenChange,
  onSave,
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

  useEffect(() => {
    if (!node) return

    setLabel(nodeData.label ?? getWorkflowNodeLabel(nodeType))
    setDescription(nodeData.description ?? '')
    setScriptLanguage(nodeData.scriptLanguage ?? 'javascript')
    setScriptContent(nodeData.scriptContent ?? '')
    setBranches(readIfElseBranches(nodeData.config))
  }, [
    node,
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

  const handleAddBranch = () => {
    setBranches((current) => addIfElseBranch(current))
  }

  const handleRemoveBranch = (branchId: string) => {
    setBranches((current) => removeIfElseBranch(current, branchId))
  }

  const handleSave = () => {
    if (!node) return

    const trimmedLabel = label.trim()
    if (!trimmedLabel) {
      alert('Please enter a node name')
      return
    }

    const normalizedBranches = normalizeIfElseBranches(
      branches.map((branch) => ({
        ...branch,
        label: branch.label.trim() || branch.id,
      })),
    )

    if (nodeType === 'if-else' && normalizedBranches.length < MIN_IF_ELSE_BRANCHES) {
      alert('If / Else nodes need at least two output branches')
      return
    }

    onSave(node.id, {
      label: trimmedLabel,
      description: description.trim(),
      scriptLanguage: nodeType === 'script' ? scriptLanguage : nodeData.scriptLanguage,
      scriptContent: nodeType === 'script' ? scriptContent : nodeData.scriptContent,
      ...(nodeType === 'if-else'
        ? {
            config: {
              ...(nodeData.config ?? {}),
              branches: normalizedBranches,
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
                {branches.map((branch, index) => {
                  const isElseBranch = isElseBranchIndex(index, branches.length)

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
