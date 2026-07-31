import { describe, expect, it } from 'vitest'
import { MAX_ASSET_UPLOAD_BYTES, validateImageFile } from '@/modules/assets/validation'

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
