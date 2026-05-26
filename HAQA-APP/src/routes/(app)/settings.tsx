import { createFileRoute } from '@tanstack/react-router'
import { Settings } from 'lucide-react'

import { AppPage } from '@/components/app-page'
import { PageCard } from '@/components/page-card'

const SettingsPage = () => {
  return (
    <AppPage>
      <PageCard icon={Settings} title="Settings">
        <p className="text-gray-600 dark:text-gray-400">Settings page - Coming soon</p>
      </PageCard>
    </AppPage>
  )
}

export const Route = createFileRoute('/(app)/settings')({
  component: SettingsPage,
})
