import { useState } from 'react'
import { useNavigate, useLocation } from '@tanstack/react-router'
import { useLogout } from '@/queries/auth-queries'
import {
  LayoutDashboard,
  LogOut,
  User,
  Shield,
  FileText,
  Settings,
  Menu
} from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

interface NavItem {
  icon: React.ReactNode
  label: string
  path: string
}

const navItems: NavItem[] = [
  {
    icon: <LayoutDashboard className="w-5 h-5" />,
    label: 'Dashboard',
    path: '/',
  },
  {
    icon: <FileText className="w-5 h-5" />,
    label: 'Test Cases',
    path: '/test-cases',
  },
  {
    icon: <Shield className="w-5 h-5" />,
    label: 'Test Runs',
    path: '/test-runs',
  },
  {
    icon: <User className="w-5 h-5" />,
    label: 'Users',
    path: '/users',
  },
  {
    icon: <Settings className="w-5 h-5" />,
    label: 'Settings',
    path: '/settings',
  },
]

interface NavigationProps {
  children: React.ReactNode
}

export function Navigation({ children }: NavigationProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const logoutMutation = useLogout({
    onSuccess: () => {
      navigate({ to: '/login' })
    },
  })

  const handleLogout = () => {
    logoutMutation.mutate()
    setMobileMenuOpen(false)
  }

  const handleNavClick = (path: string) => {
    navigate({ to: path })
    setMobileMenuOpen(false)
  }

  const isActive = (path: string) => {
    return location.pathname === path
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Desktop Sidebar - hidden on mobile, visible on lg and up */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700">
          {/* Logo/Brand Section */}
          <div className="flex items-center gap-3 px-6 py-6 border-b border-gray-200 dark:border-slate-700">
            <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg">
              <LayoutDashboard className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                HAQA
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Testing Platform
              </p>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {navItems.map((item) => (
              <button
                key={item.path}
                onClick={() => handleNavClick(item.path)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors',
                  isActive(item.path)
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'
                )}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>

          {/* Logout Button */}
          <div className="px-4 py-4 border-t border-gray-200 dark:border-slate-700">
            <button
              onClick={handleLogout}
              disabled={logoutMutation.isPending}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors',
                'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              <LogOut className="w-5 h-5" />
              {logoutMutation.isPending ? 'Logging out...' : 'Logout'}
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Header - visible on mobile/tablet, hidden on lg and up */}
      <header className="lg:hidden bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 shadow-sm sticky top-0 z-40">
        <div className="px-4 sm:px-6">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg">
                <LayoutDashboard className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                  HAQA
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Testing Platform
                </p>
              </div>
            </div>
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Sidebar Sheet */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-80 p-0">
          <SheetHeader className="px-6 py-6 border-b border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg">
                <LayoutDashboard className="w-6 h-6 text-white" />
              </div>
              <div>
                <SheetTitle className="text-left text-lg font-bold text-gray-900 dark:text-white">
                  HAQA
                </SheetTitle>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Testing Platform
                </p>
              </div>
            </div>
          </SheetHeader>

          <nav className="flex-1 px-4 py-6 space-y-2">
            {navItems.map((item) => (
              <button
                key={item.path}
                onClick={() => handleNavClick(item.path)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors',
                  isActive(item.path)
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'
                )}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>

          <div className="px-4 py-4 border-t border-gray-200 dark:border-slate-700">
            <button
              onClick={handleLogout}
              disabled={logoutMutation.isPending}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors',
                'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              <LogOut className="w-5 h-5" />
              {logoutMutation.isPending ? 'Logging out...' : 'Logout'}
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Main Content Area */}
      <div className="lg:pl-64">
        {/* Desktop Header - visible on lg and up */}
        <header className="hidden lg:block bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 shadow-sm sticky top-0 z-30">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {navItems.find((item) => isActive(item.path))?.label || 'Dashboard'}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Manage your testing workflow
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  )
}

