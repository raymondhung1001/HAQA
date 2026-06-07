import { useNavigate, useLocation } from '@tanstack/react-router'
import { useStore } from '@tanstack/react-store'

import { DesktopSidebar } from './desktop-sidebar'
import { MobileHeader } from './mobile-header'
import { MobileSidebar } from './mobile-sidebar'
import { PageHeader } from './page-header'
import { navItems } from './nav-items'
import { desktopSidebarOffsetClass } from './sidebar-layout'
import { useLogoutHandler } from '@/lib/hooks'
import { uiActions, uiStore } from '@/stores'
import { cn } from '@/lib/utils'

interface NavigationProps {
  children: React.ReactNode
}

export const Navigation = ({ children }: NavigationProps) => {
  const navigate = useNavigate()
  const location = useLocation()
  const uiState = useStore(uiStore)
  const { handleLogout, isLoggingOut } = useLogoutHandler()

  const handleNavClick = (path: string) => {
    navigate({ to: path })
    uiActions.closeMobileMenu()
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
        isLoggingOut={isLoggingOut}
      />

      <MobileHeader onMenuOpen={() => uiActions.openMobileMenu()} />

      <MobileSidebar
        open={uiState.mobileMenuOpen}
        onOpenChange={uiActions.setMobileMenuOpen}
        navItems={navItems}
        activePath={activePath}
        onNavClick={handleNavClick}
        onLogout={handleLogout}
        isLoggingOut={isLoggingOut}
      />

      <div className={cn(desktopSidebarOffsetClass)}>
        <PageHeader title={pageTitle} subtitle={pageSubtitle} />
        <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  )
}
