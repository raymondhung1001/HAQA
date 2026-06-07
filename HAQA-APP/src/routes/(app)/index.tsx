import { createFileRoute } from '@tanstack/react-router'
import { User, Shield, FileText, Settings } from 'lucide-react'

import { StatCard } from '@/components/stat-card'
import { ActionButton } from '@/components/action-button'
import { AppPage } from '@/components/app-page'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const DashboardPage = () => {
  return (
    <AppPage>
      <div className="mb-8">
        <h2 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">Welcome back!</h2>
        <p className="text-gray-600 dark:text-gray-400">
          You have successfully logged in to the HAQA Testing Platform.
        </p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<FileText className="h-6 w-6" />}
          title="Test Cases"
          value="0"
          description="Total test cases"
          color="blue"
        />
        <StatCard
          icon={<Shield className="h-6 w-6" />}
          title="Test Runs"
          value="0"
          description="Completed runs"
          color="green"
        />
        <StatCard
          icon={<User className="h-6 w-6" />}
          title="Users"
          value="1"
          description="Active users"
          color="purple"
        />
        <StatCard
          icon={<Settings className="h-6 w-6" />}
          title="Projects"
          value="0"
          description="Active projects"
          color="orange"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <ActionButton
              icon={<FileText className="h-5 w-5" />}
              label="Create Test Case"
              description="Add a new test case"
              onClick={() => {}}
            />
            <ActionButton
              icon={<Shield className="h-5 w-5" />}
              label="Run Tests"
              description="Execute test suite"
              onClick={() => {}}
            />
            <ActionButton
              icon={<Settings className="h-5 w-5" />}
              label="Settings"
              description="Configure system"
              onClick={() => {}}
            />
          </div>
        </CardContent>
      </Card>
    </AppPage>
  )
}

export const Route = createFileRoute('/(app)/')({
  component: DashboardPage,
})
