import { createFileRoute, Outlet } from '@tanstack/react-router'

/**
 * Layout route for all app routes
 * Pathless route (underscore prefix) that wraps all routes in the (app) group
 */
export const Route = createFileRoute('/(app)/_layout')({
  component: AppLayout,
})

function AppLayout() {
  return <Outlet />
}

