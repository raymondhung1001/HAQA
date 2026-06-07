import { describe, expect, it } from 'vitest'

import { ensureApiPrefix, resolveBrowserDevApiBaseUrl } from '@/lib/api-base-url'

describe('ensureApiPrefix', () => {
  it('appends /api when the host URL has no prefix', () => {
    expect(ensureApiPrefix('http://127.0.0.1:3001')).toBe('http://127.0.0.1:3001/api')
  })

  it('keeps an existing /api suffix', () => {
    expect(ensureApiPrefix('http://localhost:3001/api')).toBe('http://localhost:3001/api')
  })

  it('normalizes trailing slashes', () => {
    expect(ensureApiPrefix('http://localhost:3001/api/')).toBe('http://localhost:3001/api')
    expect(ensureApiPrefix('http://127.0.0.1:3001/')).toBe('http://127.0.0.1:3001/api')
  })
})

describe('resolveBrowserDevApiBaseUrl', () => {
  it('keeps a configured non-loopback API URL', () => {
    expect(
      resolveBrowserDevApiBaseUrl('localhost', 'http://api.haqa.test:3001/api'),
    ).toBe('http://api.haqa.test:3001/api')
  })

  it('keeps a configured relative API URL', () => {
    expect(resolveBrowserDevApiBaseUrl('localhost', '/api')).toBe('/api')
  })

  it('aligns loopback API host with the browser host', () => {
    expect(
      resolveBrowserDevApiBaseUrl('127.0.0.1', 'http://localhost:3001/api'),
    ).toBe('http://127.0.0.1:3001/api')
  })

  it('derives the API URL from the browser host when no URL is configured', () => {
    expect(resolveBrowserDevApiBaseUrl('localhost')).toBe('http://localhost:3001/api')
  })
})
