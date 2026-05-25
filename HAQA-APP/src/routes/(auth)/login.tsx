import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { LogIn, Loader2 } from 'lucide-react'

import { FormField } from '@/components/form-field'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLogin } from '@/queries/auth-queries'
import { getAuthSession } from '@/lib/auth-session'

export const Route = createFileRoute('/(auth)/login')({
  validateSearch: (search: Record<string, unknown>) => ({
    returnUrl: typeof search.returnUrl === 'string' ? search.returnUrl : undefined,
  }),
  beforeLoad: async () => {
    try {
      const { isValid } = await getAuthSession()
      if (isValid) {
        throw redirect({ to: '/' })
      }
    } catch (error) {
      if (error && typeof error === 'object' && 'to' in error) {
        throw error
      }
    }
  },
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const { returnUrl } = Route.useSearch()

  const loginMutation = useLogin({
    onSuccess: async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))

      if (returnUrl && returnUrl.startsWith('/')) {
        navigate({ to: returnUrl as '/' })
      } else {
        navigate({ to: '/' })
      }
    },
  })

  const form = useForm({
    defaultValues: {
      username: '',
      password: '',
      rememberMe: false,
    },
    onSubmit: async ({ value }) => {
      loginMutation.mutate(value)
    },
  })

  const error = loginMutation.error?.message || ''
  const isLoading = loginMutation.isPending

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 px-4 py-12 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg">
            <LogIn className="h-8 w-8 text-white" />
          </div>
          <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">
            HAQA Testing Platform
          </h1>
          <p className="text-gray-600 dark:text-gray-400">Sign in to your account to continue</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-xl dark:border-slate-700 dark:bg-slate-800">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              e.stopPropagation()
              form.handleSubmit()
            }}
            className="space-y-6"
          >
            <form.Field
              name="username"
              validators={{
                onChange: ({ value }) => (!value ? 'Username is required' : undefined),
              }}
            >
              {(field) => (
                <FormField
                  label="Username"
                  htmlFor={field.name}
                  required
                  error={field.state.meta.errors[0]}
                >
                  <Input
                    id={field.name}
                    name={field.name}
                    type="text"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Enter your username"
                  />
                </FormField>
              )}
            </form.Field>

            <form.Field
              name="password"
              validators={{
                onChange: ({ value }) => (!value ? 'Password is required' : undefined),
              }}
            >
              {(field) => (
                <FormField
                  label="Password"
                  htmlFor={field.name}
                  required
                  error={field.state.meta.errors[0]}
                >
                  <Input
                    id={field.name}
                    name={field.name}
                    type="password"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Enter your password"
                  />
                </FormField>
              )}
            </form.Field>

            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <form.Field name="rememberMe">
              {(field) => (
                <div className="flex items-center justify-between">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700"
                    />
                    <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                      Remember me
                    </span>
                  </label>
                  <a
                    href="#"
                    className="text-sm font-medium text-blue-600 transition-colors hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Forgot password?
                  </a>
                </div>
              )}
            </form.Field>

            <Button
              type="submit"
              disabled={isLoading || !form.state.canSubmit}
              className="h-auto w-full bg-gradient-to-r from-blue-600 to-indigo-600 py-3 hover:from-blue-700 hover:to-indigo-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn className="h-5 w-5" />
                  Sign In
                </>
              )}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          Test Flow Execution System
        </p>
      </div>
    </div>
  )
}
