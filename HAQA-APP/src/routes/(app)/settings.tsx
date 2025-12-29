import { createFileRoute } from '@tanstack/react-router'
import { Container } from '@/components/ui/container'
import { Navigation } from '@/components/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Settings } from 'lucide-react'

export const Route = createFileRoute('/(app)/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  return (
    <Navigation>
      <Container size="2xl">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings className="w-6 h-6" />
              <CardTitle className="text-2xl">Settings</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 dark:text-gray-400">
              Settings page - Coming soon
            </p>
          </CardContent>
        </Card>
      </Container>
    </Navigation>
  )
}

