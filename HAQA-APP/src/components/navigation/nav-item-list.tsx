import { NavItem } from './nav-item'

export interface NavItemData {
  icon: React.ReactNode
  label: string
  path: string
  subtitle?: string
}

interface NavItemListProps {
  items: NavItemData[]
  activePath: string
  onItemClick: (path: string) => void
}

export function NavItemList({ items, activePath, onItemClick }: NavItemListProps) {
  return (
    <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
      {items.map((item) => (
        <NavItem
          key={item.path}
          icon={item.icon}
          label={item.label}
          isActive={activePath === item.path}
          onClick={() => onItemClick(item.path)}
        />
      ))}
    </nav>
  )
}


