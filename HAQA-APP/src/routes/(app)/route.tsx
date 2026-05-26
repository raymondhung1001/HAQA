import { createFileRoute, Outlet } from '@tanstack/react-router'
import { requireAuth } from '@/lib/auth-guard'

const AppLayout = () => {
  return <Outlet />
}

export const Route = createFileRoute('/(app)')({
  beforeLoad: async () => {
    await requireAuth()
  },
  component: AppLayout,
})
