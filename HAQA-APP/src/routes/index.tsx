import { createFileRoute, useNavigate, redirect } from '@tanstack/react-router'
import { apiClient } from '@/lib/api'
import { useLogout } from '@/queries/auth-queries'
import { LayoutDashboard, LogOut, User, Shield, FileText, Settings } from 'lucide-react'
import { StatCard } from '@/components/stat-card'
import { ActionButton } from '@/components/action-button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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
  const navigate = useNavigate()

  const logoutMutation = useLogout({
    onSuccess: () => {
      navigate({ to: '/login' })
    },
  })

  const handleLogout = () => {
    logoutMutation.mutate()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg">
                <LayoutDashboard className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  HAQA Dashboard
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Testing Execution Workflow System
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={handleLogout}
                disabled={logoutMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <LogOut className="w-4 h-4" />
                {logoutMutation.isPending ? 'Logging out...' : 'Logout'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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

      </main>
    </div>
  )
}

