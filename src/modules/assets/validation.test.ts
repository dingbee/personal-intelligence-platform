import { describe, expect, it } from 'vitest'
import { MAX_ASSET_UPLOAD_BYTES, resolveFileSize, validateImageFile } from '@/modules/assets/validation'

describe('validateImageFile', () => {
  it('accepts a normal jpeg', () => {
    expect(validateImageFile({ type: 'image/jpeg', size: 1024 })).toEqual({ valid: true, error: null })
  })

  it('accepts png, webp, and gif', () => {
    expect(validateImageFile({ type: 'image/png', size: 1024 }).valid).toBe(true)
    expect(validateImageFile({ type: 'image/webp', size: 1024 }).valid).toBe(true)
    expect(validateImageFile({ type: 'image/gif', size: 1024 }).valid).toBe(true)
  })

  it('rejects unsupported types, including svg', () => {
    const result = validateImageFile({ type: 'image/svg+xml', size: 1024 })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Unsupported')
  })

  it('rejects a file over the size limit', () => {
    const result = validateImageFile({ type: 'image/jpeg', size: MAX_ASSET_UPLOAD_BYTES + 1 })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('exceeds')
  })

  it('accepts a file exactly at the size limit', () => {
    expect(validateImageFile({ type: 'image/jpeg', size: MAX_ASSET_UPLOAD_BYTES }).valid).toBe(true)
  })

  it('rejects an empty file', () => {
    const result = validateImageFile({ type: 'image/jpeg', size: 0 })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('empty')
  })
})

describe('resolveFileSize', () => {
  it('returns file.size directly when it is already populated', async () => {
    const file = new File([new Uint8Array(1024)], 'photo.jpg', { type: 'image/jpeg' })
    await expect(resolveFileSize(file)).resolves.toBe(1024)
  })

  it('falls back to reading the actual bytes when file.size reads 0', async () => {
    // Simulates the mobile quirk this exists for: a File whose metadata
    // hasn't materialized yet reports size 0, but the underlying blob
    // (read via arrayBuffer) has real content.
    const mobileQuirkFile = {
      size: 0,
      arrayBuffer: async () => new ArrayBuffer(2048),
    } as unknown as File
    await expect(resolveFileSize(mobileQuirkFile)).resolves.toBe(2048)
  })

  it('returns 0 when the file is genuinely empty', async () => {
    const file = new File([], 'empty.jpg', { type: 'image/jpeg' })
    await expect(resolveFileSize(file)).resolves.toBe(0)
  })
})
