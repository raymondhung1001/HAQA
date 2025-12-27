import { createFileRoute, useNavigate, redirect } from '@tanstack/react-router'
import { apiClient } from '@/lib/api'
import { useLogout } from '@/lib/auth-queries'
import { LayoutDashboard, LogOut, User, Shield, FileText, Settings } from 'lucide-react'
import { useState, useEffect } from 'react'

export const Route = createFileRoute('/dashboard')({
  beforeLoad: async () => {
    // Check if user is authenticated (only on client side)
    if (typeof window !== 'undefined') {
      const isAuth = apiClient.isAuthenticated()
      if (!isAuth) {
        // Redirect to login page if not authenticated
        throw redirect({
          to: '/',
        })
      }
    }
  },
  component: DashboardPage,
})

function DashboardPage() {
  const navigate = useNavigate()
  const [tokenInfo, setTokenInfo] = useState<{
    expiresAt: Date
    isExpired: boolean
  } | null>(null)
  const [token, setToken] = useState<string | null>(null)

  // Safely access localStorage only on client side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const accessToken = apiClient.getToken()
      const expiresAt = apiClient.getTokenExpiresAt()
      
      setToken(accessToken)
      
      if (expiresAt) {
        setTokenInfo({
          expiresAt: new Date(parseInt(expiresAt, 10)),
          isExpired: Date.now() >= parseInt(expiresAt, 10),
        })
      }
    }
  }, [])

  const logoutMutation = useLogout({
    onSuccess: () => {
      navigate({ to: '/' })
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
              {tokenInfo && (
                <div className="hidden sm:flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Shield
                    className={`w-4 h-4 ${
                      tokenInfo.isExpired ? 'text-red-500' : 'text-green-500'
                    }`}
                  />
                  <span>
                    {tokenInfo.isExpired
                      ? 'Token Expired'
                      : `Expires: ${tokenInfo.expiresAt.toLocaleTimeString()}`}
                  </span>
                </div>
              )}
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
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 border border-gray-200 dark:border-slate-700">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Quick Actions
          </h3>
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
        </div>

        {/* Authentication Status Card */}
        <div className="mt-8 bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 border border-gray-200 dark:border-slate-700">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Authentication Status
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Token Status:
              </span>
              <span
                className={`text-sm font-medium ${
                  typeof window !== 'undefined' && apiClient.isAuthenticated()
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {typeof window !== 'undefined' && apiClient.isAuthenticated()
                  ? 'Valid'
                  : 'Invalid'}
              </span>
            </div>
            {tokenInfo && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Token Expires:
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {tokenInfo.expiresAt.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Time Remaining:
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {tokenInfo.isExpired
                      ? 'Expired'
                      : `${Math.floor(
                          (tokenInfo.expiresAt.getTime() - Date.now()) / 1000 / 60
                        )} minutes`}
                  </span>
                </div>
              </>
            )}
            {token && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Token Preview:
                </span>
                <span className="text-xs font-mono text-gray-500 dark:text-gray-400 truncate max-w-xs">
                  {token.substring(0, 20)}...
                </span>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

interface StatCardProps {
  icon: React.ReactNode
  title: string
  value: string
  description: string
  color: 'blue' | 'green' | 'purple' | 'orange'
}

function StatCard({ icon, title, value, description, color }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
    orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md p-6 border border-gray-200 dark:border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>{icon}</div>
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
          {value}
        </p>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {title}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
      </div>
    </div>
  )
}

interface ActionButtonProps {
  icon: React.ReactNode
  label: string
  description: string
  onClick: () => void
}

function ActionButton({ icon, label, description, onClick }: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-slate-700/50 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg border border-gray-200 dark:border-slate-600 transition-colors text-left group"
    >
      <div className="p-2 bg-white dark:bg-slate-800 rounded-lg text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
        {icon}
      </div>
      <div>
        <p className="font-semibold text-gray-900 dark:text-white mb-1">{label}</p>
        <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
      </div>
    </button>
  )
}

