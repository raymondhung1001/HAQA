import { Menu } from 'lucide-react'
import { BrandLogo } from './brand-logo'

interface MobileHeaderProps {
  onMenuOpen: () => void
}

export function MobileHeader({ onMenuOpen }: MobileHeaderProps) {
  return (
    <header className="lg:hidden bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 shadow-sm sticky top-0 z-40">
      <div className="px-4 sm:px-6">
        <div className="flex justify-between items-center h-16">
          <BrandLogo />
          <button
            onClick={onMenuOpen}
            className="p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </div>
    </header>
  )
}


