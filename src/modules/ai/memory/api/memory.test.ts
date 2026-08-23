import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AiMemory } from '@/shared/types/database'

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }))

vi.mock('@/shared/lib/supabase', () => ({ supabase: { from: fromMock } }))

import { listMemories, reinforceMemory } from '@/modules/ai/memory/api/memory'

function makeMemory(overrides: Partial<AiMemory> = {}): AiMemory {
  return {
    id: 'memory-1',
    user_id: 'user-1',
    workspace_id: 'workspace-1',
    memory_type: 'learned_preference',
    content: 'User prefers concise answers.',
    source: 'conversation',
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    confidence: 0.7,
    reinforcement_count: 1,
    last_reinforced_at: '2026-01-05T00:00:00.000Z',
    ...overrides,
  }
}

describe('reinforceMemory', () => {
  let updateCall: Record<string, unknown> | undefined
  let eqCall: [string, string] | undefined

  beforeEach(() => {
    updateCall = undefined
    eqCall = undefined
    fromMock.mockReset()
  })

  function mockUpdateChain(result: AiMemory) {
    fromMock.mockReturnValue({
      update: (payload: Record<string, unknown>) => {
        updateCall = payload
        return {
          eq: (column: string, value: string) => {
            eqCall = [column, value]
            return {
              select: () => ({
                single: async () => ({ data: result, error: null }),
              }),
            }
          },
        }
      },
    })
  }

  it('updates only confidence, reinforcement_count, and last_reinforced_at — never content, source, or ownership fields', async () => {
    const updated = makeMemory({ confidence: 0.85, reinforcement_count: 2 })
    mockUpdateChain(updated)

    const result = await reinforceMemory('memory-1', { newConfidence: 0.85, newReinforcementCount: 2 })

    expect(fromMock).toHaveBeenCalledWith('ai_memory')
    expect(updateCall).toMatchObject({ confidence: 0.85, reinforcement_count: 2 })
    expect(updateCall).not.toHaveProperty('content')
    expect(updateCall).not.toHaveProperty('source')
    expect(updateCall).not.toHaveProperty('user_id')
    expect(updateCall).not.toHaveProperty('workspace_id')
    expect(typeof updateCall!.last_reinforced_at).toBe('string')
    expect(eqCall).toEqual(['id', 'memory-1'])
    expect(result).toBe(updated)
  })

  it('throws when the update fails, rather than silently succeeding', async () => {
    fromMock.mockReturnValue({
      update: () => ({
        eq: () => ({
          select: () => ({
            single: async () => ({ data: null, error: new Error('RLS: not the owner') }),
          }),
        }),
      }),
    })

    await expect(reinforceMemory('memory-1', { newConfidence: 0.85, newReinforcementCount: 2 })).rejects.toThrow('RLS: not the owner')
  })
})

describe('listMemories', () => {
  beforeEach(() => fromMock.mockReset())

  it('UX-14.2: filters to is_active=true by default — a disabled memory is excluded at the query itself, before any ranking/decay logic ever sees it', async () => {
    const eqCalls: [string, unknown][] = []
    const chain = {
      select: () => chain,
      order: () => chain,
      eq: (column: string, value: unknown) => {
        eqCalls.push([column, value])
        return chain
      },
      then: (resolve: (value: { data: AiMemory[]; error: null }) => void) => resolve({ data: [], error: null }),
    }
    fromMock.mockReturnValue(chain)

    await listMemories({ workspaceId: null })

    expect(eqCalls).toContainEqual(['is_active', true])
  })

  it('includes disabled memories only when includeInactive is explicitly requested (the management page\'s scope, not chat retrieval\'s)', async () => {
    const eqCalls: [string, unknown][] = []
    const chain = {
      select: () => chain,
      order: () => chain,
      eq: (column: string, value: unknown) => {
        eqCalls.push([column, value])
        return chain
      },
      then: (resolve: (value: { data: AiMemory[]; error: null }) => void) => resolve({ data: [], error: null }),
    }
    fromMock.mockReturnValue(chain)

    await listMemories({ workspaceId: null, includeInactive: true })

    expect(eqCalls.find(([column]) => column === 'is_active')).toBeUndefined()
  })
})
