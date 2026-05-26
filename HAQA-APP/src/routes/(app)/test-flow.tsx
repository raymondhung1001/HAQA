import { createFileRoute, Outlet } from '@tanstack/react-router'

const TestFlowLayout = () => {
  return <Outlet />
}

export const Route = createFileRoute('/(app)/test-flow')({
  component: TestFlowLayout,
})
