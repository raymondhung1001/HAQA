import { createFileRoute } from '@tanstack/react-router'
import { Shield } from 'lucide-react'

import { AppPage } from '@/components/app-page'
import { PageCard } from '@/components/page-card'

export const Route = createFileRoute('/(app)/test-runs')({
  component: TestRunsPage,
})

function TestRunsPage() {
  return (
    <AppPage>
      <PageCard icon={Shield} title="Test Runs">
        <p className="text-gray-600 dark:text-gray-400">Test runs management page - Coming soon</p>
      </PageCard>
    </AppPage>
  )
}
