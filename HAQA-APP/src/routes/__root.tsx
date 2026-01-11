import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { QueryClientProvider } from '@tanstack/react-query'
import { AuthUIProvider } from '@daveyplate/better-auth-ui'
import { useNavigate, Link } from '@tanstack/react-router'

import appCss from '../styles.css?url'
import { queryClient } from '@/queries/query-client'
import { authClient } from '@/lib/auth-client'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'HAQA - Test Flow Execution System',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),

  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            {children}
          </AuthProvider>
        </QueryClientProvider>
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  // Create wrapper functions for better-auth-ui compatibility
  const navigateWrapper = (href: string) => {
    navigate({ to: href as any })
  }
  
  // Create a Link wrapper component
  const LinkWrapper = ({ href, className, children, ...props }: any) => {
    return (
      <Link to={href as any} className={className} {...props}>
        {children}
      </Link>
    )
  }
  
  return (
    <AuthUIProvider authClient={authClient} navigate={navigateWrapper} Link={LinkWrapper}>
      {children}
    </AuthUIProvider>
  )
}
