import { ArrowLeft, FileText } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface EditorHeaderProps {
  title: string
  subtitle?: string
  submitLabel: string
  isSubmitting?: boolean
  onCancel: () => void
  onSubmit: () => void
}

export function EditorHeader({
  title,
  subtitle = 'Configure flow details, add steps, and connect them on the canvas',
  submitLabel,
  isSubmitting = false,
  onCancel,
  onSubmit,
}: EditorHeaderProps) {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-slate-700 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Button variant="outline" size="sm" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 shrink-0 text-primary" />
            <h1 className="truncate text-lg font-semibold text-gray-900 dark:text-white sm:text-xl">
              {title}
            </h1>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onSubmit} disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : submitLabel}
        </Button>
      </div>
    </div>
  )
}
