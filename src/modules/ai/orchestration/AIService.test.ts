import { beforeAll, describe, expect, it, vi } from 'vitest'
import { promptRegistry } from '@/modules/core/prompts/registry'

// vi.mock calls are hoisted above these imports by Vitest — vi.hoisted is
// what lets a mock factory safely close over a variable this file also
// asserts against later (retrieveMemoryContextMock).
const { retrieveMemoryContextMock, retrieveGraphContextMock, retrieveContextMock, streamChatCompletionMock } =
  vi.hoisted(() => ({
    retrieveMemoryContextMock: vi.fn(async () => null as string | null),
    retrieveGraphContextMock: vi.fn(async () => null as string | null),
    retrieveContextMock: vi.fn(async () => [] as { chunkId: string; documentId: string; content: string; similarity: number }[]),
    streamChatCompletionMock: vi.fn(async (_params: { system: string }) => ({ content: 'Hello there.', model: 'test-model' })),
  }))

vi.mock('@/modules/ai/chat/api/messages', () => ({
  insertMessage: vi.fn(
    async (params: { conversationId: string; userId: string; role: string; content: string; contextChunkIds?: string[] }) => ({
      id: `message-${Math.random()}`,
      conversation_id: params.conversationId,
      user_id: params.userId,
      role: params.role,
      content: params.content,
      context_chunk_ids: params.contextChunkIds ?? [],
      created_at: new Date().toISOString(),
    }),
  ),
}))
vi.mock('@/modules/ai/chat/api/conversations', () => ({
  touchConversation: vi.fn(async () => {}),
  listConversations: vi.fn(async () => []),
}))
vi.mock('@/modules/search/indexing/indexMessage', () => ({ indexMessage: vi.fn(async () => {}) }))
vi.mock('@/modules/knowledge-intelligence/api/linkKnownConcepts', () => ({ linkKnownConceptsToSource: vi.fn(async () => {}) }))
vi.mock('@/modules/ai/orchestration/retrieveContext', () => ({ retrieveContext: retrieveContextMock }))
vi.mock('@/modules/knowledge-intelligence/api/retrieveGraphContext', () => ({ retrieveGraphContext: retrieveGraphContextMock }))
vi.mock('@/modules/ai/memory/retrieveMemoryContext', () => ({ retrieveMemoryContext: retrieveMemoryContextMock }))
vi.mock('@/modules/ai/orchestration/streamChatCompletion', () => ({ streamChatCompletion: streamChatCompletionMock }))
// UX-6: the NOVA Context Engine's own data sources — mocked here the same
// way retrieveGraphContext/retrieveMemoryContext are, so this test suite
// never makes a real Supabase call.
vi.mock('@/modules/workspaces/api/workspaces', () => ({
  getWorkspaceHeaderSummary: vi.fn(async () => ({ documentCount: 0, lastActivityAt: null })),
  getWorkspaceName: vi.fn(async () => null),
}))
vi.mock('@/modules/reader/api/readingProgress', () => ({ getMostRecentReadingProgress: vi.fn(async () => null) }))
vi.mock('@/modules/settings/api/profile', () => ({ getProfile: vi.fn(async () => ({ display_name: null })) }))
// UX-7: the reference resolver's own lookups — same reasoning, no real Supabase call from this suite.
vi.mock('@/modules/processing/api/chunks', () => ({ getChunkLocations: vi.fn(async () => []) }))
vi.mock('@/modules/library/api/documents', () => ({ getDocumentTitles: vi.fn(async () => []) }))
// AI Workspace Actions v1 — the router itself is unit-tested in
// workspace-actions/registry.test.ts; here it's mocked so this suite can
// assert on how sendMessage wires its result, without depending on which
// actions happen to be registered.
const { runWorkspaceActionMock } = vi.hoisted(() => ({
  runWorkspaceActionMock: vi.fn(async () => null as { responseText: string; references?: unknown[] } | null),
}))
vi.mock('@/modules/workspace-actions/registry', () => ({ runWorkspaceAction: runWorkspaceActionMock }))

// getChatProvider/the real chat provider instances aren't mocked — they're
// plain, hardcoded objects (see providers/registry.ts), and since
// streamChatCompletion is mocked above, `provider.chat()` never actually
// runs, so using the real registry here carries no network risk.
import { sendMessage } from '@/modules/ai/orchestration/AIService'

beforeAll(() => {
  promptRegistry.register({
    id: 'test-chat@1.0',
    capabilityId: 'chat',
    version: '1.0',
    active: true,
    template: 'Context:\n{{context}}',
  })
})

function baseParams() {
  return {
    conversationId: 'conv-1',
    userId: 'user-1',
    workspaceId: 'workspace-1' as string | null,
    providerChain: ['anthropic'],
    history: [],
    text: 'What have I learned about hospitality?',
  }
}

describe('sendMessage', () => {
  it('calls retrieveMemoryContext with the userId/workspaceId, wiring it into the request exactly like retrieveGraphContext', async () => {
    await sendMessage(baseParams())
    expect(retrieveMemoryContextMock).toHaveBeenCalledWith({ userId: 'user-1', workspaceId: 'workspace-1' })
  })

  it('completes and returns the assistant reply even when memory retrieval yields nothing (its documented failure behavior is returning null, never throwing)', async () => {
    retrieveMemoryContextMock.mockResolvedValueOnce(null)
    const result = await sendMessage(baseParams())
    expect(result.message.content).toBe('Hello there.')
  })

  it('still completes successfully when graph context is also absent — memory is not the only optional block', async () => {
    retrieveMemoryContextMock.mockResolvedValueOnce(null)
    retrieveGraphContextMock.mockResolvedValueOnce(null)
    const result = await sendMessage(baseParams())
    expect(result.message.content).toBe('Hello there.')
  })

  it('passes the retrieved memory context through to the system prompt sent to the provider', async () => {
    retrieveMemoryContextMock.mockResolvedValueOnce('## Learned preferences\n- Likes concise answers')
    await sendMessage(baseParams())
    const lastCall = streamChatCompletionMock.mock.calls.at(-1)?.[0]
    expect(lastCall?.system).toContain('<personal_context>')
    expect(lastCall?.system).toContain('Likes concise answers')
  })

  it('appends the UX-6 NOVA personality/context layer to the system prompt, additive to the existing template', async () => {
    await sendMessage(baseParams())
    const lastCall = streamChatCompletionMock.mock.calls.at(-1)?.[0]
    expect(lastCall?.system).toContain('Context:') // the mocked rag-chat template itself, untouched
    expect(lastCall?.system).toContain('You are NOVA')
  })

  it('returns a contextTrace alongside the message', async () => {
    const result = await sendMessage(baseParams())
    expect(result.contextTrace).toEqual({ retrievedChunks: 0, graphNodes: 0, memoriesUsed: 0 })
  })

  it('returns no suggestions and no signals-worth-noting when nothing in context justifies one, except the always-applicable knowledge gap signal for an empty match set', async () => {
    const result = await sendMessage(baseParams())
    expect(result.suggestions).toEqual([])
    expect(result.signals).toContainEqual({
      type: 'knowledge_gap_detected',
      message: "No matching content found in the user's library for this question.",
    })
  })

  it('returns the model reported by the provider (UX-7 Phase 5)', async () => {
    const result = await sendMessage(baseParams())
    expect(result.model).toBe('test-model')
  })

  it('returns no references when nothing was retrieved (UX-7 Phase 2)', async () => {
    const result = await sendMessage(baseParams())
    expect(result.references).toEqual([])
  })

  // UX-14.2 (Planner Integration) — buildReasoningPlan now runs inside
  // sendMessage, before the LLM call, instead of after the response in
  // ChatPage. The planner's own correctness (intent/strategy rules) is
  // covered exhaustively in planner.test.ts; these assertions cover only
  // the new integration point — that a plan is returned, shaped correctly,
  // and never leaks into the prompt sent to the provider.
  it('returns a reasoningPlan alongside the message, computed before the LLM call', async () => {
    const result = await sendMessage(baseParams())
    expect(result.reasoningPlan).toMatchObject({
      intent: expect.any(String),
      strategy: expect.any(String),
      requiredContext: expect.any(Array),
      responseStrategy: expect.any(String),
      suggestedCommandIds: expect.any(Array),
    })
  })

  it('does not inject the reasoning plan into the prompt sent to the provider (carried through the return value only, per UX-14.2 scope)', async () => {
    await sendMessage(baseParams())
    const lastCall = streamChatCompletionMock.mock.calls.at(-1)?.[0]
    // The plan's own field names never appear as literal prompt text —
    // this sprint explicitly does not wire planner output into prompt
    // construction.
    expect(lastCall?.system).not.toContain('reasoningPlan')
    expect(lastCall?.system).not.toContain('suggestedCommandIds')
  })

  it('resolves a chapter reference from this turn\'s retrieved matches', async () => {
    retrieveContextMock.mockResolvedValueOnce([
      { chunkId: 'chunk-1', documentId: 'doc-1', content: 'Some passage', similarity: 0.9 },
    ])
    const { getChunkLocations } = await import('@/modules/processing/api/chunks')
    const { getDocumentTitles } = await import('@/modules/library/api/documents')
    vi.mocked(getChunkLocations).mockResolvedValueOnce([
      { id: 'chunk-1', document_id: 'doc-1', chapter_index: 3, chapter_title: 'The Turning Point' },
    ])
    vi.mocked(getDocumentTitles).mockResolvedValueOnce([{ id: 'doc-1', title: 'Atomic Habits' }])

    const result = await sendMessage(baseParams())
    expect(result.references).toEqual([
      { type: 'chapter', documentId: 'doc-1', documentTitle: 'Atomic Habits', chapterIndex: 3, chapterTitle: 'The Turning Point' },
    ])
  })

  describe('workspace action routing', () => {
    it('short-circuits the normal retrieval/LLM path when the router recognizes a workspace action command', async () => {
      runWorkspaceActionMock.mockResolvedValueOnce({
        responseText: 'Saved to Notes: "NOVA Reply".',
        references: [{ type: 'note', id: 'note-1', title: 'NOVA Reply' }],
      })

      const result = await sendMessage({ ...baseParams(), text: 'Save this' })

      expect(result.message.content).toBe('Saved to Notes: "NOVA Reply".')
      expect(result.references).toEqual([{ type: 'note', id: 'note-1', title: 'NOVA Reply' }])
      expect(result.contextTrace).toEqual({ retrievedChunks: 0, graphNodes: 1, memoriesUsed: 0 })
    })

    // UX-14.2 — the planner runs exactly once per request regardless of
    // which branch handles it; the workspace-action short-circuit gets its
    // own plan too, not a stubbed-out null, so the reasoning panel doesn't
    // regress for turns that went through a workspace action.
    it('still returns a reasoningPlan when a workspace action short-circuits the normal chat path', async () => {
      runWorkspaceActionMock.mockResolvedValueOnce({ responseText: 'Saved to Notes: "NOVA Reply".' })
      const result = await sendMessage({ ...baseParams(), text: 'Save this' })
      expect(result.reasoningPlan).toMatchObject({
        intent: expect.any(String),
        strategy: expect.any(String),
        requiredContext: expect.any(Array),
        responseStrategy: expect.any(String),
        suggestedCommandIds: expect.any(Array),
      })
    })

    it('falls through to the normal chat path when nothing matches (router returns null)', async () => {
      runWorkspaceActionMock.mockResolvedValueOnce(null)
      const result = await sendMessage(baseParams())
      expect(result.message.content).toBe('Hello there.')
    })

    it('reports graphNodes: 0 when a matched action produces no reference', async () => {
      runWorkspaceActionMock.mockResolvedValueOnce({ responseText: "There's nothing to save yet." })
      const result = await sendMessage({ ...baseParams(), text: 'Save this' })
      expect(result.contextTrace).toEqual({ retrievedChunks: 0, graphNodes: 0, memoriesUsed: 0 })
      expect(result.references).toEqual([])
    })
  })
})
