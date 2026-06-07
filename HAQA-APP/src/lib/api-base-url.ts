const DEFAULT_API_PORT = '3001'
const DEFAULT_API_PREFIX = '/api'

const trimTrailingSlash = (url: string): string => url.replace(/\/$/, '')
const isLoopbackHostname = (hostname: string): boolean =>
  hostname === 'localhost' || hostname === '127.0.0.1'

/** Nest global prefix is `/api`; ensure every resolved base URL includes it. */
export const ensureApiPrefix = (url: string): string => {
  const trimmed = trimTrailingSlash(url)
  if (trimmed.endsWith('/api')) {
    return trimmed
  }
  return `${trimmed}/api`
}

export const resolveBrowserDevApiBaseUrl = (
  browserHostname: string,
  configured?: string,
  port: string = DEFAULT_API_PORT,
  prefix: string = DEFAULT_API_PREFIX,
): string => {
  if (configured) {
    if (!configured.startsWith('http://') && !configured.startsWith('https://')) {
      return configured
    }

    const configuredUrl = new URL(configured)

    if (
      isLoopbackHostname(configuredUrl.hostname) &&
      isLoopbackHostname(browserHostname) &&
      configuredUrl.hostname !== browserHostname
    ) {
      configuredUrl.hostname = browserHostname
      return ensureApiPrefix(configuredUrl.toString())
    }

    return configured
  }

  const normalizedPrefix = prefix.startsWith('/') ? prefix : `/${prefix}`
  return ensureApiPrefix(`http://${browserHostname}:${port}${normalizedPrefix}`)
}

/**
 * Resolve the API base URL for the current runtime.
 *
 * In browser dev, derive the host from `window.location.hostname` so auth cookies
 * stay on the same site (e.g. both app and API use localhost, not localhost vs
 * 127.0.0.1). A relative `/api` proxy does not work with TanStack Start/Nitro
 * because Nitro returns SPA HTML for those routes.
 */
export const getApiBaseUrl = (): string => {
  const configured = import.meta.env.VITE_API_URL
    ? ensureApiPrefix(trimTrailingSlash(import.meta.env.VITE_API_URL))
    : undefined

  if (import.meta.env.DEV && typeof window !== 'undefined') {
    if (import.meta.env.VITE_API_DIRECT === 'true' && configured) {
      return configured
    }

    const port = import.meta.env.VITE_API_PORT || DEFAULT_API_PORT
    const prefix = import.meta.env.VITE_API_PREFIX || DEFAULT_API_PREFIX

    return resolveBrowserDevApiBaseUrl(window.location.hostname, configured, port, prefix)
  }

  return configured ?? ensureApiPrefix(`http://localhost:${DEFAULT_API_PORT}${DEFAULT_API_PREFIX}`)
}