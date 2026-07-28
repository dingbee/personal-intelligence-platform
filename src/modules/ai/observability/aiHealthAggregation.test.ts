import { describe, expect, it } from 'vitest'
import type { AiRequest } from '@/shared/types/database'
import type { AIProviderDescriptor } from '@/modules/core/providers/types'
import {
  calculateHealthTrend,
  computeCapabilityHealth,
  computeErrorIntelligence,
  computeProviderHealth,
  computeUsageOverview,
  findLastSuccess,
} from '@/modules/ai/observability/aiHealthAggregation'

let counter = 0
function makeRequest(overrides: Partial<AiRequest> = {}): AiRequest {
  counter += 1
  return {
    id: `req-${counter}`,
    user_id: 'user-1',
    workspace_id: null,
    feature: 'chat',
    provider: 'openai',
    model: 'gpt-5.1',
    tokens_input: 10,
    tokens_output: 20,
    latency_ms: 100,
    status: 'success',
    error_message: null,
    requested_provider: null,
    fallback_reason: null,
    created_at: new Date(2026, 0, 1, 0, 0, counter).toISOString(),
    ...overrides,
  }
}

const CHAT_PROVIDERS: AIProviderDescriptor[] = [
  { id: 'openai', label: 'OpenAI (GPT)', kind: 'chat', status: 'available' },
  { id: 'anthropic', label: 'Anthropic (Claude)', kind: 'chat', status: 'available' },
]

describe('computeProviderHealth', () => {
  it('includes a provider with zero requests', () => {
    const result = computeProviderHealth([], CHAT_PROVIDERS)
    expect(result).toEqual([
      { providerId: 'openai', label: 'OpenAI (GPT)', requestCount: 0, successCount: 0, failureCount: 0, successRate: null, avgLatencyMs: null, p95LatencyMs: null, lastFailure: null },
      { providerId: 'anthropic', label: 'Anthropic (Claude)', requestCount: 0, successCount: 0, failureCount: 0, successRate: null, avgLatencyMs: null, p95LatencyMs: null, lastFailure: null },
    ])
  })

  it('computes counts, success rate, and average latency per provider', () => {
    const requests = [
      makeRequest({ provider: 'openai', status: 'success', latency_ms: 100 }),
      makeRequest({ provider: 'openai', status: 'success', latency_ms: 200 }),
      makeRequest({ provider: 'openai', status: 'error', latency_ms: 50, error_message: 'boom' }),
    ]
    const [openai] = computeProviderHealth(requests, [CHAT_PROVIDERS[0]!])
    expect(openai).toMatchObject({
      requestCount: 3,
      successCount: 2,
      failureCount: 1,
      successRate: 2 / 3,
      avgLatencyMs: 117,
    })
  })

  it('surfaces the most recent failure (input assumed newest-first)', () => {
    const requests = [
      makeRequest({ provider: 'openai', status: 'error', feature: 'chat', error_message: 'newest failure' }),
      makeRequest({ provider: 'openai', status: 'error', feature: 'summarize', error_message: 'older failure' }),
    ]
    const [openai] = computeProviderHealth(requests, [CHAT_PROVIDERS[0]!])
    expect(openai!.lastFailure).toMatchObject({ feature: 'chat', message: 'newest failure' })
  })
})

describe('computeCapabilityHealth', () => {
  it('groups by feature and sorts by request volume', () => {
    const requests = [
      makeRequest({ feature: 'chat', status: 'success' }),
      makeRequest({ feature: 'summarize', status: 'success' }),
      makeRequest({ feature: 'summarize', status: 'error', error_message: 'x' }),
      makeRequest({ feature: 'summarize', status: 'success' }),
    ]
    const result = computeCapabilityHealth(requests)
    expect(result[0]).toMatchObject({ feature: 'summarize', requestCount: 3, successRate: 2 / 3 })
    expect(result[1]).toMatchObject({ feature: 'chat', requestCount: 1, successRate: 1 })
  })
})

describe('computeErrorIntelligence', () => {
  it('categorizes failures and ignores successes', () => {
    const requests = [
      makeRequest({ status: 'success' }),
      makeRequest({ status: 'error', provider: 'anthropic', error_message: 'AI request failed (500): {"error":"ANTHROPIC_API_KEY is not configured"}' }),
      makeRequest({ status: 'error', provider: 'openai', error_message: 'AI request failed (502): {"error":"OpenAI error: 429 rate limit exceeded"}' }),
    ]
    const { groups, recentFailures } = computeErrorIntelligence(requests)

    expect(groups).toEqual(
      expect.arrayContaining([
        { category: 'provider_unavailable', count: 1, providers: ['anthropic'] },
        { category: 'rate_limited', count: 1, providers: ['openai'] },
      ]),
    )
    expect(recentFailures).toHaveLength(2)
    expect(recentFailures[0]).toMatchObject({ category: 'provider_unavailable', provider: 'anthropic' })
  })

  it('caps recentFailures at 10 even with more failures', () => {
    const requests = Array.from({ length: 15 }, () => makeRequest({ status: 'error', error_message: 'boom' }))
    const { recentFailures } = computeErrorIntelligence(requests)
    expect(recentFailures).toHaveLength(10)
  })
})

describe('findLastSuccess', () => {
  it('returns the first success in a newest-first list', () => {
    const requests = [
      makeRequest({ status: 'error', provider: 'anthropic', error_message: 'x' }),
      makeRequest({ status: 'success', provider: 'openai', feature: 'chat' }),
      makeRequest({ status: 'success', provider: 'openai', feature: 'summarize' }),
    ]
    expect(findLastSuccess(requests)).toMatchObject({ provider: 'openai', feature: 'chat' })
  })

  it('returns null when there are no successes', () => {
    const requests = [makeRequest({ status: 'error', error_message: 'x' })]
    expect(findLastSuccess(requests)).toBeNull()
  })
})

describe('computeUsageOverview', () => {
  it('combines request stats with live provider availability', () => {
    const requests = [
      makeRequest({ status: 'success', latency_ms: 100 }),
      makeRequest({ status: 'success', latency_ms: 200 }),
      makeRequest({ status: 'error', latency_ms: 50, error_message: 'x' }),
    ]
    const overview = computeUsageOverview(requests, CHAT_PROVIDERS, { openai: true, anthropic: false, google: false })
    expect(overview).toEqual({
      totalRequests: 3,
      successRate: 2 / 3,
      avgLatencyMs: 117,
      availableProviderCount: 1,
      totalProviderCount: 2,
    })
  })
})

describe('calculateHealthTrend', () => {
  const NOW = new Date('2026-01-08T00:00:00.000Z').getTime()
  const HOUR = 60 * 60 * 1000

  it('compares the last 24h against the previous 24h', () => {
    const requests = [
      // current period (last 24h): 2 successes
      makeRequest({ status: 'success', latency_ms: 100, created_at: new Date(NOW - 2 * HOUR).toISOString() }),
      makeRequest({ status: 'success', latency_ms: 200, created_at: new Date(NOW - 3 * HOUR).toISOString() }),
      // previous period (24-48h ago): 1 success, 1 error
      makeRequest({ status: 'success', latency_ms: 100, created_at: new Date(NOW - 26 * HOUR).toISOString() }),
      makeRequest({ status: 'error', latency_ms: 100, error_message: 'x', created_at: new Date(NOW - 30 * HOUR).toISOString() }),
      // older than 48h — excluded entirely
      makeRequest({ status: 'success', created_at: new Date(NOW - 72 * HOUR).toISOString() }),
    ]

    const trend = calculateHealthTrend(requests, undefined, NOW)
    expect(trend.current).toMatchObject({ requestCount: 2, successRate: 1, avgLatencyMs: 150 })
    expect(trend.previous).toMatchObject({ requestCount: 2, successRate: 0.5, errorCount: 1 })
    expect(trend.requestCountChangePercent).toBe(0)
    expect(trend.successRateChangePoints).toBe(50)
  })

  it('scopes to one provider when providerId is given', () => {
    const requests = [
      makeRequest({ provider: 'openai', status: 'success', created_at: new Date(NOW - 1 * HOUR).toISOString() }),
      makeRequest({ provider: 'anthropic', status: 'success', created_at: new Date(NOW - 1 * HOUR).toISOString() }),
    ]
    const trend = calculateHealthTrend(requests, 'openai', NOW)
    expect(trend.current.requestCount).toBe(1)
  })

  it('returns null percent-change when the previous period has no data', () => {
    const requests = [makeRequest({ status: 'success', created_at: new Date(NOW - 1 * HOUR).toISOString() })]
    const trend = calculateHealthTrend(requests, undefined, NOW)
    expect(trend.requestCountChangePercent).toBeNull()
    expect(trend.avgLatencyChangePercent).toBeNull()
  })
})
