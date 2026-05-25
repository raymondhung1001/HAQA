import { createFileRoute } from '@tanstack/react-router'
import { User } from 'lucide-react'

import { AppPage } from '@/components/app-page'
import { PageCard } from '@/components/page-card'

export const Route = createFileRoute('/(app)/users')({
  component: UsersPage,
})

function UsersPage() {
  return (
    <AppPage>
      <PageCard icon={User} title="Users">
        <p className="text-gray-600 dark:text-gray-400">Users management page - Coming soon</p>
      </PageCard>
    </AppPage>
  )
}
