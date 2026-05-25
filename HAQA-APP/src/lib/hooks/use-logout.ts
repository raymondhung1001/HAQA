import { useQueryClient } from '@tanstack/react-query'

import { useLogout as useLogoutMutation } from '@/queries/auth-queries'
import { uiActions } from '@/stores'
import { redirectToLoginIfNeeded } from '@/lib/hooks/use-session-redirect'

export function useLogoutHandler() {
  const queryClient = useQueryClient()

  const logoutMutation = useLogoutMutation({
    onSuccess: () => {
      queryClient.clear()
      redirectToLoginIfNeeded()
    },
  })

  const handleLogout = () => {
    logoutMutation.mutate()
    uiActions.closeMobileMenu()
  }

  return {
    handleLogout,
    isLoggingOut: logoutMutation.isPending,
  }
}
