import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet'
import { BrandLogo } from './brand-logo'
import { NavItemList, type NavItemData } from './nav-item-list'
import { LogoutButton } from './logout-button'

interface MobileSidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  navItems: NavItemData[]
  activePath: string
  onNavClick: (path: string) => void
  onLogout: () => void
  isLoggingOut: boolean
}

export function MobileSidebar({
  open,
  onOpenChange,
  navItems,
  activePath,
  onNavClick,
  onLogout,
  isLoggingOut,
}: MobileSidebarProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-80 p-0">
        <SheetHeader className="px-6 py-6 border-b border-gray-200 dark:border-slate-700">
          <div className="text-left">
            <BrandLogo />
          </div>
        </SheetHeader>

        <NavItemList items={navItems} activePath={activePath} onItemClick={onNavClick} />

        <LogoutButton isLoading={isLoggingOut} onLogout={onLogout} />
      </SheetContent>
    </Sheet>
  )
}

