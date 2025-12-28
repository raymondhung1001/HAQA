import { LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LogoutButtonProps {
  isLoading: boolean
  onLogout: () => void
  className?: string
}

export function LogoutButton({ isLoading, onLogout, className }: LogoutButtonProps) {
  return (
    <div className={cn('px-4 py-4 border-t border-gray-200 dark:border-slate-700', className)}>
      <button
        onClick={onLogout}
        disabled={isLoading}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors',
          'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        <LogOut className="w-5 h-5" />
        {isLoading ? 'Logging out...' : 'Logout'}
      </button>
    </div>
  )
}


