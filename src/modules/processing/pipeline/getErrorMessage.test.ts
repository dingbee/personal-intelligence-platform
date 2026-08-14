import { describe, expect, it } from 'vitest'
import { getErrorMessage } from '@/modules/processing/pipeline/getErrorMessage'

describe('getErrorMessage', () => {
  it('returns a plain Error instance\'s message', () => {
    expect(getErrorMessage(new Error('database failure'))).toBe('database failure')
  })

  it('returns the message from an Error-like plain object', () => {
    expect(getErrorMessage({ message: 'database failure' })).toBe('database failure')
  })

  it('preserves code/details/hint from a PostgREST-shaped error object alongside its message', () => {
    const message = getErrorMessage({
      message: 'insert failed',
      code: '42P01',
      details: 'relation "structured_datasets" does not exist',
      hint: 'run pending migrations',
    })
    expect(message).toContain('insert failed')
    expect(message).toContain('42P01')
    expect(message).toContain('relation "structured_datasets" does not exist')
    expect(message).toContain('run pending migrations')
  })

  it('preserves code/details/hint from a real Error instance carrying those extra properties (e.g. PostgrestError)', () => {
    const err = new Error('insert failed') as Error & { code: string; details: string; hint: string }
    err.code = '42501'
    err.details = 'permission denied for table structured_datasets'
    err.hint = ''
    const message = getErrorMessage(err)
    expect(message).toContain('insert failed')
    expect(message).toContain('42501')
    expect(message).toContain('permission denied for table structured_datasets')
  })

  it('handles a thrown string', () => {
    expect(getErrorMessage('something went wrong')).toBe('something went wrong')
  })

  it('handles an empty string with the fallback', () => {
    expect(getErrorMessage('')).toBe('Unknown processing error')
    expect(getErrorMessage('   ')).toBe('Unknown processing error')
  })

  it('handles null', () => {
    expect(getErrorMessage(null)).toBe('Unknown processing error')
  })

  it('handles undefined', () => {
    expect(getErrorMessage(undefined)).toBe('Unknown processing error')
  })

  it('handles an arbitrary object with no useful diagnostic fields', () => {
    expect(getErrorMessage({ foo: 'bar', baz: 42 })).toBe('Unknown processing error')
  })

  it('handles a number, boolean, or other primitive without throwing', () => {
    expect(getErrorMessage(42)).toBe('Unknown processing error')
    expect(getErrorMessage(true)).toBe('Unknown processing error')
  })

  it('reads message from a nested {error: {...}} wrapper shape', () => {
    expect(getErrorMessage({ error: { message: 'nested failure' } })).toBe('nested failure')
  })

  it('reads a plain string error property when there is no nested message', () => {
    expect(getErrorMessage({ error: 'plain string error field' })).toBe('plain string error field')
  })

  it('falls back to the useful default rather than the old generic "Processing failed" string', () => {
    expect(getErrorMessage({})).not.toBe('Processing failed')
    expect(getErrorMessage({})).toBe('Unknown processing error')
  })

  // Security requirement — never surface credential-shaped substrings.
  describe('secret redaction', () => {
    it('redacts a Bearer token embedded in a message', () => {
      const message = getErrorMessage(new Error('request failed: Authorization Bearer sk-abcdEFGH12345678'))
      expect(message).not.toContain('sk-abcdEFGH12345678')
      expect(message).toContain('[redacted]')
    })

    it('redacts an api_key=... style key-value pair', () => {
      const message = getErrorMessage({ message: 'upstream call failed, api_key=sk-live-1234567890abcdef' })
      expect(message).not.toContain('sk-live-1234567890abcdef')
    })

    it('redacts a JWT-shaped token', () => {
      const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'
      const message = getErrorMessage(new Error(`auth failed: ${jwt}`))
      expect(message).not.toContain(jwt)
      expect(message).toContain('[redacted]')
    })

    it('redacts a signed-URL-style token query parameter', () => {
      const message = getErrorMessage({ message: 'download failed for https://x.supabase.co/storage/v1/object/sign/file.xlsx?token=abcdef123456' })
      expect(message).not.toContain('abcdef123456')
    })

    it('does not redact ordinary diagnostic text with no credential-shaped content', () => {
      const message = getErrorMessage(new Error('relation "structured_datasets" does not exist'))
      expect(message).toBe('relation "structured_datasets" does not exist')
    })
  })
})
