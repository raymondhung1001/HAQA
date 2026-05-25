import { useState } from 'react'
import type { Node } from '@xyflow/react'
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'

import { BranchListInputRow } from '@/components/test-flow/branch-list-row'
import { Callout } from '@/components/callout'
import { FormField } from '@/components/form-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  getLoopBodyWorkNodeDefinitions,
  getWorkflowNodeLabel,
} from '@/components/test-flow/workflow-node-definitions'
import { useWorkflowNodeEditorForm } from '@/lib/hooks/use-workflow-node-editor-form'
import { isElseBranchIndex, type TestFlowNodeType, type WorkflowNodeData } from '@/lib/test-flow-graph'
import type { ScriptLanguage } from '@/types/workflow'

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
  const [nameError, setNameError] = useState<string | undefined>()
  const [branchError, setBranchError] = useState<string | undefined>()

  const {
    nodeType,
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
    minIfElseBranches,
    handleBranchLabelChange,
    handleLoopBreakLabelChange,
    handleAddBranch,
    handleRemoveBranch,
    buildSavePayload,
  } = useWorkflowNodeEditorForm(node, allNodes)

  const loopBodyWorkDefinitions = getLoopBodyWorkNodeDefinitions() ?? []

  const handleSave = () => {
    setNameError(undefined)
    setBranchError(undefined)

    if (!label.trim()) {
      setNameError('Please enter a node name')
      return
    }

    if (nodeType === 'if-else' && branches.length < minIfElseBranches) {
      setBranchError('If / Else nodes need at least two output branches')
      return
    }

    const payload = buildSavePayload()
    if (!payload || !node) return

    onSave(node.id, payload)
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
          <FormField label="Name" required error={nameError}>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Enter node name"
            />
          </FormField>

          <FormField label="Description">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Describe what this step does"
            />
          </FormField>

          <FormField label="Node Type">
            <p className="rounded-md border bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:bg-slate-900 dark:text-gray-300">
              {getWorkflowNodeLabel(nodeType)}
            </p>
          </FormField>

          {isIfElseNode && (
            <Callout
              variant="warning"
              title="Output branches"
              description="Add conditional paths before the reserved Else branch."
            >
              {branchError ? (
                <p className="text-sm text-red-600 dark:text-red-400">{branchError}</p>
              ) : null}
              <div className="flex justify-end">
                <Button type="button" variant="outline" size="sm" onClick={handleAddBranch}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add
                </Button>
              </div>

              <div className="space-y-2">
                {branches.map((branch, index) => {
                  const isElseBranch = isElseBranchIndex(index, branches.length)

                  return (
                    <BranchListInputRow
                      key={branch.id}
                      index={index}
                      value={branch.label}
                      onChange={(value) => handleBranchLabelChange(branch.id, value)}
                      placeholder="Branch label"
                      readOnly={isElseBranch}
                      readOnlyLabel={
                        isElseBranch ? (
                          <>
                            Else
                            <span className="ml-2 text-xs text-gray-400">(reserved)</span>
                          </>
                        ) : undefined
                      }
                      onRemove={() => handleRemoveBranch(branch.id)}
                      removeDisabled={isElseBranch || branches.length <= minIfElseBranches}
                      removeTitle={
                        isElseBranch
                          ? 'The Else branch is always kept as the last output'
                          : branches.length <= minIfElseBranches
                            ? 'At least two branches are required'
                            : 'Remove branch'
                      }
                    />
                  )
                })}
              </div>
            </Callout>
          )}

          {isLoopNode && (
            <Callout variant="orange">
              <p>
                <span className="font-medium text-gray-800 dark:text-gray-100">Loop</span> enters the
                body. After each iteration the flow returns to the loop node.{' '}
                <span className="font-medium text-gray-800 dark:text-gray-100">Done</span> on the loop
                body box continues the main flow when the loop finishes (on the loop node only when the
                body is empty).
              </p>
            </Callout>
          )}

          {isLoopNode && (
            <Callout
              variant="success"
              title="Loop body steps"
              description="Wire steps as a tree: connect outputs to the next step. If / Else uses branch handles; other steps use the right handle. Multiple paths can end at different leaves."
            >
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
            </Callout>
          )}

          {isLoopNode && (
            <Callout
              variant="orange"
              title="Break exits (end of body)"
              description="Break handles appear on the upper-right of the loop body box; Done is on the lower-right. Wire If / Else branch outputs to main-flow steps for mid-body breaks, or to other body steps inside the iteration."
            >
              <div className="flex justify-end">
                <Button type="button" variant="outline" size="sm" onClick={handleAddBranch}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add
                </Button>
              </div>

              <div className="space-y-2">
                {breakExits.length === 0 ? (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    No break exits yet. Add one to expose a handle after the body completes.
                  </p>
                ) : (
                  breakExits.map((branch, index) => (
                    <BranchListInputRow
                      key={branch.id}
                      index={index}
                      value={branch.label}
                      onChange={(value) => handleLoopBreakLabelChange(branch.id, value)}
                      placeholder="Break condition label"
                      onRemove={() => handleRemoveBranch(branch.id)}
                      removeTitle="Remove break exit"
                    />
                  ))
                )}
              </div>
            </Callout>
          )}

          {nodeType === 'script' && (
            <>
              <FormField label="Script Language">
                <select
                  value={scriptLanguage}
                  onChange={(e) =>
                    setScriptLanguage(e.target.value as ScriptLanguage)
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="javascript">JavaScript</option>
                  <option value="python">Python</option>
                  <option value="bash">Bash</option>
                </select>
              </FormField>

              <FormField label="Script">
                <Textarea
                  value={scriptContent}
                  onChange={(e) => setScriptContent(e.target.value)}
                  className="min-h-[220px] font-mono text-sm"
                  placeholder="// Enter script code"
                  spellCheck={false}
                />
              </FormField>
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
