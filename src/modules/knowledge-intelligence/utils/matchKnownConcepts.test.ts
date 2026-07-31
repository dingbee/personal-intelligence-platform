import { describe, expect, it } from 'vitest'
import { matchKnownConcepts } from '@/modules/knowledge-intelligence/utils/matchKnownConcepts'

const mtoni = { id: 'node-1', title: 'Mtoni River Lodge', titleNormalized: 'mtoni river lodge' }
const revenue = { id: 'node-2', title: 'Revenue', titleNormalized: 'revenue' }
const ok = { id: 'node-3', title: 'OK', titleNormalized: 'ok' }
const googleAds = { id: 'node-4', title: 'Google Ads', titleNormalized: 'google ads' }

describe('matchKnownConcepts', () => {
  it('matches a multi-word title mentioned in the text', () => {
    const matches = matchKnownConcepts('We should promote Mtoni River Lodge on social media.', [mtoni])
    expect(matches).toEqual([{ nodeId: 'node-1', title: 'Mtoni River Lodge' }])
  })

  it('matches regardless of punctuation/casing differences', () => {
    const matches = matchKnownConcepts("MTONI RIVER LODGE's bookings are up!", [mtoni])
    expect(matches).toEqual([{ nodeId: 'node-1', title: 'Mtoni River Lodge' }])
  })

  it('does not match a title whose words appear out of order', () => {
    const matches = matchKnownConcepts('The river lodge at Mtoni is popular.', [mtoni])
    expect(matches).toEqual([])
  })

  it('does not match a title as a substring of a longer unrelated word', () => {
    const matches = matchKnownConcepts('Our revenues grew significantly this quarter.', [revenue])
    expect(matches).toEqual([])
  })

  it('matches a single-word title as a whole word', () => {
    const matches = matchKnownConcepts('Revenue grew significantly this quarter.', [revenue])
    expect(matches).toEqual([{ nodeId: 'node-2', title: 'Revenue' }])
  })

  it('skips short single-word titles to avoid false positives', () => {
    const matches = matchKnownConcepts('ok, sounds good', [ok])
    expect(matches).toEqual([])
  })

  it('returns multiple matches when several known concepts are mentioned', () => {
    const matches = matchKnownConcepts('Google Ads spend is funding the Mtoni River Lodge campaign, driving Revenue.', [
      mtoni,
      revenue,
      googleAds,
    ])
    expect(matches.map((m) => m.nodeId).sort()).toEqual(['node-1', 'node-2', 'node-4'])
  })

  it('returns no matches for empty or whitespace-only text', () => {
    expect(matchKnownConcepts('', [mtoni])).toEqual([])
    expect(matchKnownConcepts('   ', [mtoni])).toEqual([])
  })

  it('returns no matches when no nodes are known yet', () => {
    expect(matchKnownConcepts('Mtoni River Lodge is great', [])).toEqual([])
  })
})
