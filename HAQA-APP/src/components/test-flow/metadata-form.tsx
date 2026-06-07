import { FormField } from '@/components/form-field'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import type { TestFlowEditorFormData } from '@/types'

interface TestFlowMetadataFormProps {
  formData: TestFlowEditorFormData
  onChange: (formData: TestFlowEditorFormData) => void
}

export const TestFlowMetadataForm = ({ formData, onChange }: TestFlowMetadataFormProps) => {
  return (
    <div className="space-y-4 border-b border-gray-200 p-4 dark:border-slate-700">
      <FormField label="Name" required>
        <Input
          value={formData.name}
          onChange={(e) => onChange({ ...formData, name: e.target.value })}
          placeholder="Enter test flow name"
        />
      </FormField>

      <FormField label="Description">
        <Textarea
          value={formData.description}
          onChange={(e) => onChange({ ...formData, description: e.target.value })}
          rows={3}
          placeholder="Enter test flow description"
        />
      </FormField>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-800/50">
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">Flow status</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {formData.isActive
              ? 'Active — this flow can be executed'
              : 'Inactive — this flow is disabled'}
          </p>
        </div>
        <Switch
          checked={formData.isActive}
          onCheckedChange={(isActive) => onChange({ ...formData, isActive })}
          aria-label="Toggle flow active status"
        />
      </div>
    </div>
  )
}
