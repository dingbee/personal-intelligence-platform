import { describe, expect, it, vi } from 'vitest'

interface RpcResult<T> {
  data: T | null
  error: Error | null
}

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn<(fn: string, args?: Record<string, unknown>) => Promise<RpcResult<unknown>>>(),
}))

vi.mock('@/shared/lib/supabase', () => ({ supabase: { rpc: rpcMock } }))

import { createIntelligenceJourney } from '@/modules/intelligence-ledger/api/createIntelligenceJourney'

const ROW = {
  id: 'journey-1',
  workspace_id: 'workspace-1',
  user_id: 'user-1',
  objective_id: null,
  title: 'Q3 pricing research',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

describe('createIntelligenceJourney', () => {
  it('calls create_intelligence_journey with the given params, defaulting objectiveId to null', async () => {
    rpcMock.mockResolvedValueOnce({ data: ROW, error: null })

    await createIntelligenceJourney({ workspaceId: 'workspace-1', title: 'Q3 pricing research' })

    expect(rpcMock).toHaveBeenCalledWith('create_intelligence_journey', {
      p_workspace_id: 'workspace-1',
      p_objective_id: null,
      p_title: 'Q3 pricing research',
    })
  })

  it('passes a supplied objectiveId through unchanged', async () => {
    rpcMock.mockResolvedValueOnce({ data: ROW, error: null })

    await createIntelligenceJourney({ workspaceId: 'workspace-1', objectiveId: 'objective-1', title: 'Q3 pricing research' })

    expect(rpcMock).toHaveBeenCalledWith('create_intelligence_journey', {
      p_workspace_id: 'workspace-1',
      p_objective_id: 'objective-1',
      p_title: 'Q3 pricing research',
    })
  })

  it('maps the returned row into a domain IntelligenceJourney', async () => {
    rpcMock.mockResolvedValueOnce({ data: ROW, error: null })

    const journey = await createIntelligenceJourney({ workspaceId: 'workspace-1', title: 'Q3 pricing research' })

    expect(journey).toEqual({
      id: 'journey-1',
      workspaceId: 'workspace-1',
      userId: 'user-1',
      objectiveId: null,
      title: 'Q3 pricing research',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    })
  })

  it('throws on an RPC error rather than returning a partial/fabricated journey', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: new Error('workspace access denied') })

    await expect(createIntelligenceJourney({ workspaceId: 'workspace-1', title: 'x' })).rejects.toThrow('workspace access denied')
  })
})
