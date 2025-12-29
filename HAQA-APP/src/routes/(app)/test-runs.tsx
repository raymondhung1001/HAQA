import { createFileRoute } from '@tanstack/react-router'
import { Container } from '@/components/ui/container'
import { Navigation } from '@/components/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Shield } from 'lucide-react'

export const Route = createFileRoute('/(app)/test-runs')({
  component: TestRunsPage,
})

function TestRunsPage() {
  return (
    <Navigation>
      <Container size="2xl">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6" />
              <CardTitle className="text-2xl">Test Runs</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 dark:text-gray-400">
              Test runs management page - Coming soon
            </p>
          </CardContent>
        </Card>
      </Container>
    </Navigation>
  )
}

