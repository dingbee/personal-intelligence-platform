import { describe, expect, it } from 'vitest'
import { canAuthorize, canCancel, canExpire, canStart, getValidNextStatuses, isTerminalStatus, isValidTransition } from '@/modules/execution-foundation/api/executionStateMachine'

describe('executionStateMachine', () => {
  it('allows awaiting_approval -> approved and -> rejected', () => {
    expect(isValidTransition('awaiting_approval', 'approved')).toBe(true)
    expect(isValidTransition('awaiting_approval', 'rejected')).toBe(true)
  })

  it('allows approved -> executing', () => {
    expect(isValidTransition('approved', 'executing')).toBe(true)
  })

  it('allows executing -> succeeded and executing -> failed', () => {
    expect(isValidTransition('executing', 'succeeded')).toBe(true)
    expect(isValidTransition('executing', 'failed')).toBe(true)
  })

  it('allows executing -> executing (a non-final failed attempt awaiting retry)', () => {
    expect(isValidTransition('executing', 'executing')).toBe(true)
  })

  it('rejects rejected -> executing', () => {
    expect(isValidTransition('rejected', 'executing')).toBe(false)
  })

  it('rejects expired -> executing', () => {
    expect(isValidTransition('expired', 'executing')).toBe(false)
  })

  it('rejects succeeded -> anything (terminal)', () => {
    expect(getValidNextStatuses('succeeded')).toEqual([])
  })

  it('rejects cancelled -> anything (terminal)', () => {
    expect(getValidNextStatuses('cancelled')).toEqual([])
  })

  it('rejects failed -> executing (a failed request cannot silently resume)', () => {
    expect(isValidTransition('failed', 'executing')).toBe(false)
  })

  it('treats rejected/succeeded/failed/cancelled/expired as terminal', () => {
    expect(isTerminalStatus('rejected')).toBe(true)
    expect(isTerminalStatus('succeeded')).toBe(true)
    expect(isTerminalStatus('failed')).toBe(true)
    expect(isTerminalStatus('cancelled')).toBe(true)
    expect(isTerminalStatus('expired')).toBe(true)
  })

  it('does not treat proposed/awaiting_approval/approved/executing as terminal', () => {
    expect(isTerminalStatus('proposed')).toBe(false)
    expect(isTerminalStatus('awaiting_approval')).toBe(false)
    expect(isTerminalStatus('approved')).toBe(false)
    expect(isTerminalStatus('executing')).toBe(false)
  })

  it('canAuthorize is true only for proposed/awaiting_approval', () => {
    expect(canAuthorize('proposed')).toBe(true)
    expect(canAuthorize('awaiting_approval')).toBe(true)
    expect(canAuthorize('approved')).toBe(false)
    expect(canAuthorize('executing')).toBe(false)
  })

  it('canStart is true only for approved', () => {
    expect(canStart('approved')).toBe(true)
    expect(canStart('awaiting_approval')).toBe(false)
    expect(canStart('executing')).toBe(false)
  })

  it('canCancel is true for proposed/awaiting_approval/approved/executing, false once terminal', () => {
    expect(canCancel('proposed')).toBe(true)
    expect(canCancel('awaiting_approval')).toBe(true)
    expect(canCancel('approved')).toBe(true)
    expect(canCancel('executing')).toBe(true)
    expect(canCancel('succeeded')).toBe(false)
    expect(canCancel('cancelled')).toBe(false)
  })

  it('canExpire is true only for proposed/awaiting_approval/approved (not executing — an in-flight attempt is cancelled, not expired)', () => {
    expect(canExpire('proposed')).toBe(true)
    expect(canExpire('awaiting_approval')).toBe(true)
    expect(canExpire('approved')).toBe(true)
    expect(canExpire('executing')).toBe(false)
  })
})
