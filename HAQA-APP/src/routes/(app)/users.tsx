import { createFileRoute, redirect } from '@tanstack/react-router'
import { apiClient } from '@/lib/api'
import { Container } from '@/components/ui/container'
import { Navigation } from '@/components/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { User } from 'lucide-react'

export const Route = createFileRoute('/(app)/users')({
  beforeLoad: async () => {
    // Check if user is authenticated (only on client side)
    if (typeof window !== 'undefined') {
      const token = apiClient.getToken()
      const expiresAt = apiClient.getTokenExpiresAt()
      
      if (!token || !expiresAt) {
        throw redirect({
          to: '/login',
        })
      }
      
      const now = Date.now()
      const expiresAtNum = parseInt(expiresAt, 10)
      
      if (isNaN(expiresAtNum) || expiresAtNum <= now) {
        throw redirect({
          to: '/login',
        })
      }
    }
  },
  component: UsersPage,
})

function UsersPage() {
  return (
    <Navigation>
      <Container size="2xl">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="w-6 h-6" />
              <CardTitle className="text-2xl">Users</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 dark:text-gray-400">
              Users management page - Coming soon
            </p>
          </CardContent>
        </Card>
      </Container>
    </Navigation>
  )
}

