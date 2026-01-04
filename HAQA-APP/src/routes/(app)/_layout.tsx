import { createFileRoute, Outlet } from '@tanstack/react-router'
import { requireAuth } from '@/lib/auth-guard'

/**
 * Layout route for all authenticated app routes
 * This beforeLoad will run for all routes under /(app)/*
 * Pathless route (underscore prefix) that wraps all routes in the (app) group
 */
export const Route = createFileRoute('/(app)/_layout')({
  beforeLoad: async () => {
    await requireAuth()
  },
  component: AppLayout,
})

function AppLayout() {
  return <Outlet />
}

