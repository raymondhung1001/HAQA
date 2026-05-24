import { useEffect, useState } from 'react'
import type { Node } from '@xyflow/react'
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
import type { WorkflowNodeData } from '@/lib/test-flow-graph'

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

  useEffect(() => {
    if (!node) return

    setLabel(nodeData.label ?? getWorkflowNodeLabel(nodeType))
    setDescription(nodeData.description ?? '')
    setScriptLanguage(nodeData.scriptLanguage ?? 'javascript')
    setScriptContent(nodeData.scriptContent ?? '')
  }, [node, nodeData.description, nodeData.label, nodeData.scriptContent, nodeData.scriptLanguage, nodeType])

  const handleSave = () => {
    if (!node) return

    const trimmedLabel = label.trim()
    if (!trimmedLabel) {
      alert('Please enter a node name')
      return
    }

    onSave(node.id, {
      label: trimmedLabel,
      description: description.trim(),
      scriptLanguage: nodeType === 'script' ? scriptLanguage : nodeData.scriptLanguage,
      scriptContent: nodeType === 'script' ? scriptContent : nodeData.scriptContent,
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
