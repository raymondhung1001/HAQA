import { createFileRoute } from '@tanstack/react-router'
import { requireAuth } from '@/lib/auth-guard'

/**
 * Layout route for all authenticated app routes
 * This beforeLoad will run for all routes under /(app)/*
 * Note: The route tree will need to be regenerated after creating this file
 */
export const Route = createFileRoute('/(app)' as any)({
  beforeLoad: async () => {
    await requireAuth()
  },
})

