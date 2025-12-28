import {
  LayoutDashboard,
  User,
  Shield,
  FileText,
  Settings,
} from 'lucide-react'
import { type NavItemData } from './nav-item-list'

export const navItems: NavItemData[] = [
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

