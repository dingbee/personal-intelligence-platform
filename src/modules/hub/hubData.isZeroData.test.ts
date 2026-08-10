import { describe, expect, it } from 'vitest'
import { computeIsZeroData } from '@/modules/hub/hubData'

/**
 * ARRIYIA Product Completion Phase 2 — the decision logic behind the Hub's
 * first-run onboarding: a workspace only counts as zero-data when every
 * one of its three primary content types (documents, notes, conversations)
 * is genuinely empty, never just one of them. Kept as its own tiny test
 * file (rather than folded into a hubData.test.ts covering the whole
 * async orchestrator) since computeIsZeroData is the one piece of
 * buildWorkspaceHubState simple enough to unit test without mocking a
 * half-dozen API modules.
 */
describe('computeIsZeroData', () => {
  it('is true when documents, notes, and conversations are all empty', () => {
    expect(computeIsZeroData(0, 0, 0)).toBe(true)
  })

  it('is false when only documents exist', () => {
    expect(computeIsZeroData(3, 0, 0)).toBe(false)
  })

  it('is false when only notes exist', () => {
    expect(computeIsZeroData(0, 2, 0)).toBe(false)
  })

  it('is false when only conversations exist', () => {
    expect(computeIsZeroData(0, 0, 1)).toBe(false)
  })

  it('is false for an established user with plenty of everything', () => {
    expect(computeIsZeroData(42, 17, 9)).toBe(false)
  })

  // The explicit case the audit called out: an established user with one
  // empty section (e.g. no notes yet) must never be treated as zero-data.
  it('is false for an established user whose notes happen to be empty', () => {
    expect(computeIsZeroData(12, 0, 5)).toBe(false)
  })
})
