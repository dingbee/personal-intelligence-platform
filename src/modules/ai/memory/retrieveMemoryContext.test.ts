import { describe, expect, it, vi } from 'vitest'

const { listMemoriesMock } = vi.hoisted(() => ({ listMemoriesMock: vi.fn() }))
vi.mock('@/modules/ai/memory/api/memory', () => ({ listMemories: listMemoriesMock }))

import { retrieveMemoryContext } from '@/modules/ai/memory/retrieveMemoryContext'
import type { AiMemory } from '@/shared/types/database'

let counter = 0
function makeMemory(overrides: Partial<AiMemory> = {}): AiMemory {
  counter += 1
  return {
    id: `memory-${counter}`,
    user_id: 'user-1',
    workspace_id: null,
    memory_type: 'explicit_profile',
    content: `Content ${counter}`,
    source: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    confidence: null,
    ...overrides,
  }
}

/**
 * PIP Sprint 6/10 — the memory-retrieval counterpart of Sprint 4/5's
 * retrieval tests: proves the actual objects/text reaching the prompt,
 * not any particular LLM's wording (per the sprint's own Phase 9
 * instruction). No prior test file covered retrieveMemoryContext itself
 * (only its dependencies formatMemoriesForPrompt/rankMemories were
 * tested) — this fills that real, pre-existing coverage gap too.
 */
describe('retrieveMemoryContext', () => {
  it('returns null when there are no stored memories at all — never fabricates', async () => {
    listMemoriesMock.mockResolvedValueOnce([])
    const result = await retrieveMemoryContext({ userId: 'user-1', workspaceId: null, text: 'anything' })
    expect(result).toBeNull()
  })

  it('includes an explicit_profile memory regardless of the current question (Test A/B: durable personalization applies without repeating)', async () => {
    listMemoriesMock.mockResolvedValueOnce([
      makeMemory({ memory_type: 'explicit_profile', content: 'User prefers concise executive summaries.' }),
    ])
    const result = await retrieveMemoryContext({ userId: 'user-1', workspaceId: null, text: 'Can you draft a report on Q3?' })
    expect(result).toContain('User prefers concise executive summaries.')
  })

  it('excludes a conversation_memory unrelated to the current question (Test C)', async () => {
    listMemoriesMock.mockResolvedValueOnce([
      makeMemory({ memory_type: 'conversation_memory', content: 'User is researching the Northern Expansion project.' }),
    ])
    const result = await retrieveMemoryContext({ userId: 'user-1', workspaceId: null, text: 'What is my favorite color?' })
    expect(result).toBeNull()
  })

  it('includes a conversation_memory relevant to the current question', async () => {
    listMemoriesMock.mockResolvedValueOnce([
      makeMemory({ memory_type: 'conversation_memory', content: 'User is researching the Northern Expansion project.' }),
    ])
    const result = await retrieveMemoryContext({ userId: 'user-1', workspaceId: null, text: 'Any news on Northern Expansion?' })
    expect(result).toContain('Northern Expansion')
  })

  it('passes workspaceId through to listMemories unchanged', async () => {
    listMemoriesMock.mockResolvedValueOnce([])
    await retrieveMemoryContext({ userId: 'user-1', workspaceId: 'workspace-1', text: 'hello' })
    expect(listMemoriesMock).toHaveBeenCalledWith({ workspaceId: 'workspace-1' })
  })

  it('never throws — a listMemories failure returns null, same never-throws contract as retrieveGraphContext', async () => {
    listMemoriesMock.mockRejectedValueOnce(new Error('network error'))
    const result = await retrieveMemoryContext({ userId: 'user-1', workspaceId: null, text: 'hello' })
    expect(result).toBeNull()
  })

  it('returns null when every memory is filtered out by relevance, even though memories exist', async () => {
    listMemoriesMock.mockResolvedValueOnce([
      makeMemory({ memory_type: 'conversation_memory', content: 'User is planning a birthday party.' }),
    ])
    const result = await retrieveMemoryContext({ userId: 'user-1', workspaceId: null, text: 'what is up' })
    expect(result).toBeNull()
  })
})
