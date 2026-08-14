import { describe, expect, it } from 'vitest'
import { decideRetry, isRetryableFailureKind, MAX_EXECUTION_ATTEMPTS } from '@/modules/execution-foundation/api/retryPolicy'

describe('retryPolicy', () => {
  it('retries a transient failure below the attempt bound', () => {
    expect(decideRetry('transient', 1)).toEqual({ shouldRetry: true, isFinal: false })
  })

  it('retries a timeout failure below the attempt bound', () => {
    expect(decideRetry('timeout', 1)).toEqual({ shouldRetry: true, isFinal: false })
  })

  it('does not retry once the attempt bound is reached', () => {
    expect(decideRetry('transient', MAX_EXECUTION_ATTEMPTS)).toEqual({ shouldRetry: false, isFinal: true })
  })

  it('never retries a permanent failure', () => {
    expect(decideRetry('permanent', 1)).toEqual({ shouldRetry: false, isFinal: true })
  })

  it('never retries a validation failure', () => {
    expect(decideRetry('validation', 1)).toEqual({ shouldRetry: false, isFinal: true })
  })

  it('never retries an authorization failure', () => {
    expect(decideRetry('authorization', 1)).toEqual({ shouldRetry: false, isFinal: true })
  })

  it('never retries a capability_unavailable failure', () => {
    expect(decideRetry('capability_unavailable', 1)).toEqual({ shouldRetry: false, isFinal: true })
  })

  it('never retries a dependency failure', () => {
    expect(decideRetry('dependency', 1)).toEqual({ shouldRetry: false, isFinal: true })
  })

  it('never retries an external_rejection failure', () => {
    expect(decideRetry('external_rejection', 1)).toEqual({ shouldRetry: false, isFinal: true })
  })

  it('never retries an unknown failure', () => {
    expect(decideRetry('unknown', 1)).toEqual({ shouldRetry: false, isFinal: true })
  })

  it('isRetryableFailureKind matches exactly transient and timeout', () => {
    expect(isRetryableFailureKind('transient')).toBe(true)
    expect(isRetryableFailureKind('timeout')).toBe(true)
    expect(isRetryableFailureKind('permanent')).toBe(false)
  })
})
