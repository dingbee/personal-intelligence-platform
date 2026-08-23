import { describe, expect, it, vi } from 'vitest'

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }))

vi.mock('@/shared/lib/supabase', () => ({
  supabase: { rpc: rpcMock },
}))

import { persistProactiveRecommendations } from '@/modules/notifications/api/proactiveRecommendations'

const recommendation = (id = 'research-topic') => ({
  command: { id, title: 'Review this topic' },
  reason: 'It connects to your recent work.',
}) as never

describe('persistProactiveRecommendations', () => {
  it('does not write when there are no recommendations', async () => {
    await persistProactiveRecommendations([], null)
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('persists at most three recommendations with the existing RPC', async () => {
    rpcMock.mockResolvedValue({ error: null })
    await persistProactiveRecommendations([recommendation('a'), recommendation('b'), recommendation('c'), recommendation('d')], 'ws-1')

    expect(rpcMock).toHaveBeenCalledTimes(3)
    expect(rpcMock).toHaveBeenCalledWith('persist_proactive_recommendation', expect.objectContaining({
      p_command_id: 'a',
      p_workspace_id: 'ws-1',
    }))
  })

  it('uses personal scope when there is no workspace', async () => {
    rpcMock.mockResolvedValue({ error: null })
    await persistProactiveRecommendations([recommendation()], null)

    expect(rpcMock).toHaveBeenCalledWith('persist_proactive_recommendation', expect.objectContaining({
      p_dedupe_key: expect.stringContaining('personal:research-topic:'),
      p_workspace_id: null,
    }))
  })

  it('propagates persistence errors so callers can failure-isolate them', async () => {
    rpcMock.mockResolvedValue({ error: new Error('notification write failed') })

    await expect(persistProactiveRecommendations([recommendation()], null)).rejects.toThrow('notification write failed')
  })
})
