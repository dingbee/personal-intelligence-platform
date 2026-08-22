import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isChunkLoadError, loadResilientChunk } from '@/shared/lib/resilientDynamicImport'

const RELOAD_KEY = 'arriyia:chunk-reload-attempted'

function chunkLoadError(message = 'Failed to fetch dynamically imported module: https://app.example.com/assets/pdf-BBqTl0sV.js'): Error {
  return new Error(message)
}

describe('isChunkLoadError', () => {
  it('recognizes every major browser\'s dynamic-import failure message', () => {
    expect(isChunkLoadError(new Error('Failed to fetch dynamically imported module: https://x/y.js'))).toBe(true)
    expect(isChunkLoadError(new Error('error loading dynamically imported module: https://x/y.js'))).toBe(true)
    expect(isChunkLoadError(new Error('Importing a module script failed.'))).toBe(true)
    expect(isChunkLoadError(new Error('Loading chunk 4 failed.'))).toBe(true)
  })

  it('does not misclassify a genuine, unrelated error as a chunk-load failure', () => {
    expect(isChunkLoadError(new Error('OpenAI embeddings error: 429 rate limited'))).toBe(false)
    expect(isChunkLoadError(new Error('Network request failed'))).toBe(false)
    expect(isChunkLoadError(new TypeError('Cannot read properties of undefined'))).toBe(false)
  })

  it('never treats a non-Error thrown value as a chunk-load failure', () => {
    expect(isChunkLoadError('Failed to fetch dynamically imported module: x')).toBe(false)
    expect(isChunkLoadError(undefined)).toBe(false)
    expect(isChunkLoadError({ message: 'Failed to fetch dynamically imported module' })).toBe(false)
  })
})

describe('loadResilientChunk', () => {
  let reloadSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    sessionStorage.clear()
    reloadSpy = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload: reloadSpy })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    sessionStorage.clear()
  })

  it('resolves normally on success, never touching reload or sessionStorage', async () => {
    const result = await loadResilientChunk(async () => 'ok')
    expect(result).toBe('ok')
    expect(reloadSpy).not.toHaveBeenCalled()
    expect(sessionStorage.getItem(RELOAD_KEY)).toBeNull()
  })

  it('on the first chunk-load failure in this tab, reloads once and still rejects (this attempt genuinely failed)', async () => {
    await expect(loadResilientChunk(async () => { throw chunkLoadError() })).rejects.toThrow(/Failed to fetch dynamically imported module/)
    expect(reloadSpy).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem(RELOAD_KEY)).toBe('1')
  })

  it('never reloads a second time in the same tab — the sessionStorage guard survives a reload the way an in-memory flag could not', async () => {
    // Simulates the state *after* a reload already happened once: the flag
    // was written to sessionStorage (which, unlike a module-level variable,
    // actually survives a real page reload) before this call ever runs.
    sessionStorage.setItem(RELOAD_KEY, '1')

    await expect(loadResilientChunk(async () => { throw chunkLoadError() })).rejects.toThrow(/Failed to fetch dynamically imported module/)
    expect(reloadSpy).not.toHaveBeenCalled()
  })

  it('propagates a genuine, non-chunk-load error without ever reloading — this is not a generic retry-on-any-failure mechanism', async () => {
    await expect(loadResilientChunk(async () => { throw new Error('OpenAI embeddings error: 429 rate limited') })).rejects.toThrow('OpenAI embeddings error')
    expect(reloadSpy).not.toHaveBeenCalled()
    expect(sessionStorage.getItem(RELOAD_KEY)).toBeNull()
  })

  it('fails safe (never reloads) when sessionStorage itself is unavailable, e.g. private browsing', async () => {
    const originalGetItem = Storage.prototype.getItem
    const originalSetItem = Storage.prototype.setItem
    Storage.prototype.getItem = () => {
      throw new Error('SecurityError: storage disabled')
    }
    Storage.prototype.setItem = () => {
      throw new Error('SecurityError: storage disabled')
    }
    try {
      await expect(loadResilientChunk(async () => { throw chunkLoadError() })).rejects.toThrow(/Failed to fetch dynamically imported module/)
      expect(reloadSpy).not.toHaveBeenCalled()
    } finally {
      Storage.prototype.getItem = originalGetItem
      Storage.prototype.setItem = originalSetItem
    }
  })
})
