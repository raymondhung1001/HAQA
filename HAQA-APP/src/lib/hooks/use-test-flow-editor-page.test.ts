import { describe, expect, it, vi } from 'vitest'

import { saveExistingFlow } from '@/lib/hooks/use-test-flow-editor-page'

describe('saveExistingFlow', () => {
  it('returns success when metadata and graph save both succeed', async () => {
    const updateMetadata = vi.fn(async () => undefined)
    const saveGraph = vi.fn(async () => undefined)

    await expect(saveExistingFlow({ updateMetadata, saveGraph })).resolves.toBe('success')
    expect(updateMetadata).toHaveBeenCalledTimes(1)
    expect(saveGraph).toHaveBeenCalledTimes(1)
  })

  it('returns failed when metadata save fails and skips graph save', async () => {
    const updateMetadata = vi.fn(async () => {
      throw new Error('metadata failed')
    })
    const saveGraph = vi.fn(async () => undefined)

    await expect(saveExistingFlow({ updateMetadata, saveGraph })).resolves.toBe('failed')
    expect(updateMetadata).toHaveBeenCalledTimes(1)
    expect(saveGraph).not.toHaveBeenCalled()
  })

  it('returns partial when metadata saves but graph save fails', async () => {
    const updateMetadata = vi.fn(async () => undefined)
    const saveGraph = vi.fn(async () => {
      throw new Error('graph failed')
    })

    await expect(saveExistingFlow({ updateMetadata, saveGraph })).resolves.toBe('partial')
    expect(updateMetadata).toHaveBeenCalledTimes(1)
    expect(saveGraph).toHaveBeenCalledTimes(1)
  })
})
