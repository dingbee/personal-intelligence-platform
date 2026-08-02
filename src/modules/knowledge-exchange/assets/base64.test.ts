import { describe, expect, it } from 'vitest'
import { base64ToUint8Array, estimateBase64DecodedByteLength, uint8ArrayToBase64 } from '@/modules/knowledge-exchange/assets/base64'

describe('uint8ArrayToBase64 / base64ToUint8Array', () => {
  it('round-trips an empty array', () => {
    const bytes = new Uint8Array(0)
    expect(base64ToUint8Array(uint8ArrayToBase64(bytes))).toEqual(bytes)
  })

  it('round-trips small binary content, including bytes across the full 0-255 range', () => {
    const bytes = new Uint8Array(256)
    for (let i = 0; i < 256; i++) bytes[i] = i
    const roundTripped = base64ToUint8Array(uint8ArrayToBase64(bytes))
    expect(roundTripped).toEqual(bytes)
  })

  it('round-trips content larger than one chunk (0x8000 bytes) without corruption', () => {
    const bytes = new Uint8Array(0x8000 * 2 + 137)
    for (let i = 0; i < bytes.length; i++) bytes[i] = i % 256
    const roundTripped = base64ToUint8Array(uint8ArrayToBase64(bytes))
    expect(roundTripped).toEqual(bytes)
  })

  it('produces standard base64 text', () => {
    const bytes = new TextEncoder().encode('hello world')
    expect(uint8ArrayToBase64(bytes)).toBe(btoa('hello world'))
  })
})

describe('estimateBase64DecodedByteLength', () => {
  it('estimates 0 for an empty string', () => {
    expect(estimateBase64DecodedByteLength('')).toBe(0)
  })

  it('matches the real decoded length for unpadded, singly-padded, and doubly-padded base64', () => {
    const cases = [
      new Uint8Array(9), // no padding
      new Uint8Array(10), // one '=' padding char
      new Uint8Array(11), // two '=' padding chars
    ]
    for (const bytes of cases) {
      const base64 = uint8ArrayToBase64(bytes)
      expect(estimateBase64DecodedByteLength(base64)).toBe(bytes.length)
    }
  })

  it('scales roughly linearly for large inputs (sanity check against a ~25MB-scale payload)', () => {
    const bytes = new Uint8Array(1_000_000)
    const base64 = uint8ArrayToBase64(bytes)
    expect(estimateBase64DecodedByteLength(base64)).toBe(bytes.length)
  })
})
