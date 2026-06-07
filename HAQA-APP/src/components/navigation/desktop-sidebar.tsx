import { BrandLogo } from './brand-logo'
import { NavItemList, type NavItemData } from './nav-item-list'
import { LogoutButton } from './logout-button'
import { desktopSidebarWidthClass } from './sidebar-layout'
import { cn } from '@/lib/utils'

interface DesktopSidebarProps {
  navItems: NavItemData[]
  activePath: string
  onNavClick: (path: string) => void
  onLogout: () => void
  isLoggingOut: boolean
}

export const DesktopSidebar = ({
  navItems,
  activePath,
  onNavClick,
  onLogout,
  isLoggingOut,
}: DesktopSidebarProps) => {
  return (
    <aside
      className={cn(
        'hidden lg:fixed lg:inset-y-0 lg:flex lg:flex-col',
        desktopSidebarWidthClass,
      )}
    >
      <div className="flex flex-col flex-grow bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700">
        {/* Logo/Brand Section */}
        <div className="border-b border-gray-200 px-4 py-5 dark:border-slate-700">
          <BrandLogo />
        </div>

        {/* Navigation Items */}
        <NavItemList items={navItems} activePath={activePath} onItemClick={onNavClick} />

        {/* Logout Button */}
        <LogoutButton isLoading={isLoggingOut} onLogout={onLogout} />
      </div>
    </aside>
  )
}


