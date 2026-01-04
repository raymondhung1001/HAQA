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
    path: '/'
  },
  {
    icon: <FileText className="w-5 h-5" />,
    label: 'Test Flow',
    path: '/test-flow',
    subtitle: 'Manage your testing workflow',
  },
  {
    icon: <Shield className="w-5 h-5" />,
    label: 'Test Runs',
    path: '/test-runs',
    subtitle: 'View and manage test executions',
  },
  {
    icon: <User className="w-5 h-5" />,
    label: 'Users',
    path: '/users',
    subtitle: 'Manage user accounts and permissions',
  },
  {
    icon: <Settings className="w-5 h-5" />,
    label: 'Settings',
    path: '/settings',
    subtitle: 'Configure system settings',
  },
]

