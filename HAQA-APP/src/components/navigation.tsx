import { useState } from 'react'
import { useNavigate, useLocation } from '@tanstack/react-router'
import { useLogout } from '@/queries/auth-queries'
import { DesktopSidebar } from './navigation/desktop-sidebar'
import { MobileHeader } from './navigation/mobile-header'
import { MobileSidebar } from './navigation/mobile-sidebar'
import { PageHeader } from './navigation/page-header'
import { navItems } from './navigation/nav-items'

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

  const activePath = location.pathname
  const activeNavItem = navItems.find((item) => activePath === item.path)
  const pageTitle = activeNavItem?.label || 'Dashboard'
  const pageSubtitle = activeNavItem?.subtitle

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <DesktopSidebar
        navItems={navItems}
        activePath={activePath}
        onNavClick={handleNavClick}
        onLogout={handleLogout}
        isLoggingOut={logoutMutation.isPending}
      />

      <MobileHeader onMenuOpen={() => setMobileMenuOpen(true)} />

      <MobileSidebar
        open={mobileMenuOpen}
        onOpenChange={setMobileMenuOpen}
        navItems={navItems}
        activePath={activePath}
        onNavClick={handleNavClick}
        onLogout={handleLogout}
        isLoggingOut={logoutMutation.isPending}
      />

      <div className="lg:pl-64">
        <PageHeader title={pageTitle} subtitle={pageSubtitle} />
        <main className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  )
}

