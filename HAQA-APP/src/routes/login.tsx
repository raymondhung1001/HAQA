import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { LogIn, Loader2 } from 'lucide-react'
import { useLogin } from '@/queries/auth-queries'
import { apiClient } from '@/lib/api'

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    // If already authenticated, redirect to home (dashboard) (only on client side)
    // This runs before the component renders, preventing any flash
    if (typeof window !== 'undefined') {
      // Use a synchronous check - localStorage/sessionStorage are synchronous
      const token = apiClient.getToken()
      const expiresAt = apiClient.getTokenExpiresAt()
      
      if (token && expiresAt) {
        // Check if token is expired
        const now = Date.now()
        const expiresAtNum = parseInt(expiresAt, 10)
        
        if (!isNaN(expiresAtNum) && expiresAtNum > now) {
          // Token is valid, redirect immediately to home
          throw redirect({
            to: '/',
          })
        }
      }
    }
  },
  component: LoginPage,
})

function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)

  // Pre-fetch CSRF token when component mounts
  useEffect(() => {
    // Fetch CSRF token by making a GET request to ensure it's available
    // This will set the cookie and make the token ready for the login request
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/`, {
      method: 'GET',
      credentials: 'include',
    }).catch((error) => {
      console.warn('Failed to pre-fetch CSRF token:', error)
    })
  }, [])

  const loginMutation = useLogin({
    onSuccess: async () => {
      // Login successful - tokens are already set by apiClient.login()
      // Wait a moment to ensure tokens are stored (in localStorage or sessionStorage based on rememberMe)
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Verify tokens are stored before navigating
      if (typeof window !== 'undefined') {
        const token = apiClient.getToken()
        const expiresAt = apiClient.getTokenExpiresAt()
        
        console.log('[Login Success] Before navigation:', {
          hasToken: !!token,
          hasExpiresAt: !!expiresAt,
          tokenLength: token?.length || 0,
          expiresAt: expiresAt,
          localStorageKeys: typeof window !== 'undefined' ? Object.keys(localStorage) : [],
        })
        
        if (token && expiresAt) {
          // Tokens are stored, navigate to home (dashboard)
          window.location.href = '/'
        } else {
          console.error('[Login Success] Tokens not stored!', {
            token,
            expiresAt,
            localStorage: Object.keys(localStorage),
          })
          alert('Login successful but tokens were not stored. Please try again.')
        }
      }
    },
    onError: (error) => {
      console.error('Login error:', error)
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    loginMutation.mutate({ username, password, rememberMe })
  }

  const error = loginMutation.error?.message || ''
  const isLoading = loginMutation.isPending

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo/Title Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl shadow-lg mb-4">
            <LogIn className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            HAQA Testing Platform
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Sign in to your account to continue
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 border border-gray-200 dark:border-slate-700">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Username Field */}
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                placeholder="Enter your username"
              />
            </div>

            {/* Password Field */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                placeholder="Enter your password"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700"
                />
                <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                  Remember me
                </span>
              </label>
              <a
                href="#"
                className="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
              >
                Forgot password?
              </a>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 px-4 rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Sign In
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          Testing Execution Workflow System
        </p>
      </div>
    </div>
  )
}

