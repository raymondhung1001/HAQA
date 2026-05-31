/**
 * Extract a human-readable message from API errors (NestJS validation, HTTP failures, etc.).
 */
export function parseApiErrorMessage(error: unknown, fallback = 'An unexpected error occurred'): string {
  if (!error) return fallback

  if (typeof error === 'string' && error.trim()) {
    return error.trim()
  }

  if (error instanceof Error && error.message) {
    const trimmed = error.message.trim()
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed) as { message?: unknown }
        return formatNestMessage(parsed.message) ?? trimmed
      } catch {
        return trimmed
      }
    }
    return trimmed
  }

  if (typeof error === 'object' && error !== null) {
    const record = error as Record<string, unknown>
    const fromMessage = formatNestMessage(record.message)
    if (fromMessage) return fromMessage

    const fromError = record.error
    if (typeof fromError === 'string' && fromError.trim()) {
      return fromError.trim()
    }
  }

  return fallback
}

function formatNestMessage(message: unknown): string | undefined {
  if (typeof message === 'string' && message.trim()) {
    return message.trim()
  }

  if (Array.isArray(message)) {
    const parts = message
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean)
    if (parts.length > 0) return parts.join('; ')
  }

  return undefined
}
