import { createAuthClient } from "better-auth/react"
import { usernameClient } from "better-auth/client/plugins"

// API base URL - defaults to localhost:3001/api (NestJS default with global prefix)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

/**
 * Create better-auth client
 * Configured to work with the existing NestJS API
 * Note: We use this mainly for UI components, not for session management
 * Session is managed via cache after login
 */
export const authClient = createAuthClient({
  baseURL: API_BASE_URL,
  plugins: [
    usernameClient(),
  ],
  fetchOptions: {
    credentials: 'include', // Important for HttpOnly cookies
  },
  // Override session endpoint to prevent calls to /api/get-session
  // Since we manage session via cache, we don't need better-auth's session endpoint
})

// Override getSession to prevent API calls
// This prevents the "Cannot GET /api/get-session" error
const originalGetSession = authClient.getSession
authClient.getSession = async () => {
  // Return empty session - we manage session via cache instead
  return {
    data: {
      session: null,
    },
    error: null,
  } as any
}

export type AuthClient = typeof authClient

