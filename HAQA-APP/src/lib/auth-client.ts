import { createAuthClient } from "better-auth/react"
import { usernameClient } from "better-auth/client/plugins"

// API base URL - defaults to localhost:3001/api (NestJS default with global prefix)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

/**
 * Create better-auth client
 * Configured to work with the existing NestJS API
 */
export const authClient = createAuthClient({
  baseURL: API_BASE_URL,
  plugins: [
    usernameClient(),
  ],
  fetchOptions: {
    credentials: 'include', // Important for HttpOnly cookies
  },
})

export type AuthClient = typeof authClient

