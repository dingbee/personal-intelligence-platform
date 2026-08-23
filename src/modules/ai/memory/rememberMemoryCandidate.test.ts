import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AiMemory } from '@/shared/types/database'
import type { MemoryCandidate } from '@/modules/ai/memory/memoryDetection/types'
import { reinforceConfidence } from '@/modules/ai/memory/reinforceMemoryConfidence'

const { listMemoriesMock, createMemoryMock, reinforceMemoryMock } = vi.hoisted(() => ({
  listMemoriesMock: vi.fn(),
  createMemoryMock: vi.fn(),
  reinforceMemoryMock: vi.fn(),
}))

vi.mock('@/modules/ai/memory/api/memory', () => ({
  listMemories: listMemoriesMock,
  createMemory: createMemoryMock,
  reinforceMemory: reinforceMemoryMock,
}))

import { rememberMemoryCandidate } from '@/modules/ai/memory/rememberMemoryCandidate'

const CONTEXT = { userId: 'user-1', workspaceId: 'workspace-1' }

let counter = 0
function makeMemory(overrides: Partial<AiMemory> = {}): AiMemory {
  counter += 1
  return {
    id: `memory-${counter}`,
    user_id: 'user-1',
    workspace_id: 'workspace-1',
    memory_type: 'learned_preference',
    content: `Content ${counter}`,
    source: 'conversation',
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    confidence: 0.8,
    reinforcement_count: 0,
    last_reinforced_at: null,
    ...overrides,
  }
}

function makeCandidate(overrides: Partial<MemoryCandidate> = {}): MemoryCandidate {
  return { content: 'User prefers concise answers.', type: 'learned_preference', confidence: 0.85, sourceConversationId: 'conv-1', ...overrides }
}

describe('rememberMemoryCandidate', () => {
  beforeEach(() => {
    listMemoriesMock.mockReset()
    createMemoryMock.mockReset()
    reinforceMemoryMock.mockReset()
  })

  it('first memory creation — with no existing memories, creates a new row rather than trying to reinforce anything', async () => {
    listMemoriesMock.mockResolvedValueOnce([])
    const created = makeMemory()
    createMemoryMock.mockResolvedValueOnce(created)

    const result = await rememberMemoryCandidate(makeCandidate(), CONTEXT)

    expect(reinforceMemoryMock).not.toHaveBeenCalled()
    expect(createMemoryMock).toHaveBeenCalledWith({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      memoryType: 'learned_preference',
      content: 'User prefers concise answers.',
      source: 'conversation',
      confidence: 0.85,
    })
    expect(result).toBe(created)
  })

  it('an exact repeat reinforces the existing memory instead of creating a duplicate row', async () => {
    const existing = makeMemory({ content: 'User prefers concise answers.', confidence: 0.6, reinforcement_count: 0 })
    listMemoriesMock.mockResolvedValueOnce([existing])
    reinforceMemoryMock.mockResolvedValueOnce(makeMemory({ id: existing.id }))

    await rememberMemoryCandidate(makeCandidate({ content: 'User prefers concise answers.' }), CONTEXT)

    expect(createMemoryMock).not.toHaveBeenCalled()
    expect(reinforceMemoryMock).toHaveBeenCalledTimes(1)
    const [targetId, params] = reinforceMemoryMock.mock.calls[0]!
    expect(targetId).toBe(existing.id)
    expect(params.newConfidence).toBeGreaterThan(0.6)
    expect(params.newConfidence).toBeLessThanOrEqual(1)
    expect(params.newReinforcementCount).toBe(1)
  })

  it('a manually-authored memory with no stored confidence is still a valid reinforcement target — the new confidence comes from the candidate\'s own scored evidence, not a fabricated backfill', async () => {
    const existing = makeMemory({ content: 'User prefers concise answers.', confidence: null, reinforcement_count: 0 })
    listMemoriesMock.mockResolvedValueOnce([existing])
    reinforceMemoryMock.mockResolvedValueOnce(makeMemory({ id: existing.id }))

    await rememberMemoryCandidate(makeCandidate({ content: 'User prefers concise answers.', confidence: 0.7 }), CONTEXT)

    const [, params] = reinforceMemoryMock.mock.calls[0]!
    // Base was the candidate's own 0.7 (the existing row had no confidence to evolve from), bumped upward from there.
    expect(params.newConfidence).toBeGreaterThan(0.7)
  })

  it('repeated reinforcement has diminishing returns — each successive repeat adds a smaller confidence increment', async () => {
    let currentConfidence = 0.5
    let currentCount = 0
    const increments: number[] = []

    for (let i = 0; i < 3; i += 1) {
      const existing = makeMemory({ content: 'User prefers concise answers.', confidence: currentConfidence, reinforcement_count: currentCount })
      listMemoriesMock.mockResolvedValueOnce([existing])
      reinforceMemoryMock.mockResolvedValueOnce(makeMemory({ id: existing.id }))

      await rememberMemoryCandidate(makeCandidate({ content: 'User prefers concise answers.' }), CONTEXT)

      const [, params] = reinforceMemoryMock.mock.calls[i]!
      // The orchestration's output must match the pure diminishing-return
      // function exactly — this is what proves rememberMemoryCandidate
      // actually uses it, not just that confidence went up by some amount.
      expect(params.newConfidence).toBeCloseTo(reinforceConfidence(currentConfidence), 10)
      increments.push(params.newConfidence - currentConfidence)
      currentConfidence = params.newConfidence
      currentCount = params.newReinforcementCount
    }

    expect(increments[1]).toBeLessThan(increments[0]!)
    expect(increments[2]).toBeLessThan(increments[1]!)
    expect(currentConfidence).toBeLessThan(1)
    expect(currentCount).toBe(3)
  })

  it('confidence never exceeds 1 even after many reinforcements of an already-high-confidence memory', async () => {
    const existing = makeMemory({ content: 'User prefers concise answers.', confidence: 0.98, reinforcement_count: 50 })
    listMemoriesMock.mockResolvedValueOnce([existing])
    reinforceMemoryMock.mockResolvedValueOnce(makeMemory({ id: existing.id }))

    await rememberMemoryCandidate(makeCandidate({ content: 'User prefers concise answers.' }), CONTEXT)

    const [, params] = reinforceMemoryMock.mock.calls[0]!
    expect(params.newConfidence).toBeLessThanOrEqual(1)
  })

  it('a contradictory statement is never merged into the conflicting memory — both are preserved as separate rows', async () => {
    const existing = makeMemory({ content: 'User prefers concise answers.', confidence: 0.8 })
    listMemoriesMock.mockResolvedValueOnce([existing])
    const created = makeMemory({ content: 'User prefers detailed answers.' })
    createMemoryMock.mockResolvedValueOnce(created)

    const result = await rememberMemoryCandidate(makeCandidate({ content: 'User prefers detailed answers.' }), CONTEXT)

    expect(reinforceMemoryMock).not.toHaveBeenCalled()
    expect(createMemoryMock).toHaveBeenCalledWith(expect.objectContaining({ content: 'User prefers detailed answers.' }))
    expect(result).toBe(created)
  })

  it('an explicit_profile candidate is never auto-reinforced — always creates a new row, even when an identical one already exists', async () => {
    const existingProfile = makeMemory({ memory_type: 'explicit_profile', content: "User's name is Alex.", confidence: 0.95 })
    const created = makeMemory({ memory_type: 'explicit_profile', content: "User's name is Alex." })
    createMemoryMock.mockResolvedValueOnce(created)

    const result = await rememberMemoryCandidate(
      makeCandidate({ type: 'explicit_profile', content: "User's name is Alex.", confidence: 0.95 }),
      CONTEXT,
    )

    // listMemories is never even consulted for explicit_profile — no duplicate lookup happens at all.
    expect(listMemoriesMock).not.toHaveBeenCalled()
    expect(reinforceMemoryMock).not.toHaveBeenCalled()
    expect(createMemoryMock).toHaveBeenCalledWith(expect.objectContaining({ memoryType: 'explicit_profile' }))
    expect(result).toBe(created)
    void existingProfile
  })

  it('a disabled memory is never a reinforcement target — listMemories\' active-only scope means a repeated statement about something the user turned off starts a fresh row', async () => {
    // listMemoriesMock simulates the real active-only default: the disabled duplicate is simply never returned.
    listMemoriesMock.mockResolvedValueOnce([])
    const created = makeMemory({ content: 'User prefers concise answers.' })
    createMemoryMock.mockResolvedValueOnce(created)

    const result = await rememberMemoryCandidate(makeCandidate({ content: 'User prefers concise answers.' }), CONTEXT)

    expect(reinforceMemoryMock).not.toHaveBeenCalled()
    expect(result).toBe(created)
  })

  it('scopes the duplicate lookup to the candidate\'s own workspace and memory type, respecting existing privacy boundaries', async () => {
    listMemoriesMock.mockResolvedValueOnce([])
    createMemoryMock.mockResolvedValueOnce(makeMemory())

    await rememberMemoryCandidate(makeCandidate({ type: 'conversation_memory' }), { userId: 'user-1', workspaceId: 'workspace-2' })

    expect(listMemoriesMock).toHaveBeenCalledWith({ workspaceId: 'workspace-2', memoryType: 'conversation_memory' })
  })
})
