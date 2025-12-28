import { createFileRoute, redirect } from '@tanstack/react-router'
import { apiClient } from '@/lib/api'
import { User, Shield, FileText, Settings } from 'lucide-react'
import { StatCard } from '@/components/stat-card'
import { ActionButton } from '@/components/action-button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Container } from '@/components/ui/container'
import { Navigation } from '@/components/navigation'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    // Check if user is authenticated (only on client side)
    // This runs before the component renders, preventing any flash
    if (typeof window !== 'undefined') {
      // Fast synchronous check
      const token = apiClient.getToken()
      const expiresAt = apiClient.getTokenExpiresAt()
      
      if (!token || !expiresAt) {
        throw redirect({
          to: '/login',
        })
      }
      
      // Check if token is expired
      const now = Date.now()
      const expiresAtNum = parseInt(expiresAt, 10)
      
      if (isNaN(expiresAtNum) || expiresAtNum <= now) {
        throw redirect({
          to: '/login',
        })
      }
    }
  },
  component: DashboardPage,
})

function DashboardPage() {
  return (
    <Navigation>
      <Container size="2xl">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Welcome back!
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            You have successfully logged in to the HAQA Testing Platform.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={<FileText className="w-6 h-6" />}
            title="Test Cases"
            value="0"
            description="Total test cases"
            color="blue"
          />
          <StatCard
            icon={<Shield className="w-6 h-6" />}
            title="Test Runs"
            value="0"
            description="Completed runs"
            color="green"
          />
          <StatCard
            icon={<User className="w-6 h-6" />}
            title="Users"
            value="1"
            description="Active users"
            color="purple"
          />
          <StatCard
            icon={<Settings className="w-6 h-6" />}
            title="Projects"
            value="0"
            description="Active projects"
            color="orange"
          />
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ActionButton
                icon={<FileText className="w-5 h-5" />}
                label="Create Test Case"
                description="Add a new test case"
                onClick={() => {}}
              />
              <ActionButton
                icon={<Shield className="w-5 h-5" />}
                label="Run Tests"
                description="Execute test suite"
                onClick={() => {}}
              />
              <ActionButton
                icon={<Settings className="w-5 h-5" />}
                label="Settings"
                description="Configure system"
                onClick={() => {}}
              />
            </div>
          </CardContent>
        </Card>
      </Container>
    </Navigation>
  )
}

