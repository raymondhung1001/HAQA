import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/(app)/test-flow')({
  component: TestFlowLayout,
})

function TestFlowLayout() {
  return <Outlet />
}
