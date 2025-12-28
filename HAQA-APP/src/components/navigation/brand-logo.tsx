import { LayoutDashboard } from 'lucide-react'

interface BrandLogoProps {
  className?: string
}

export function BrandLogo({ className }: BrandLogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className || ''}`}>
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
  )
}


