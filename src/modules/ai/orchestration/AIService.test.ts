import { beforeAll, describe, expect, it, vi } from 'vitest'
import { promptRegistry } from '@/modules/core/prompts/registry'

// vi.mock calls are hoisted above these imports by Vitest — vi.hoisted is
// what lets a mock factory safely close over a variable this file also
// asserts against later (retrieveMemoryContextMock).
const {
  retrieveMemoryContextMock,
  retrieveGraphContextMock,
  retrieveNamedEntityGraphContextMock,
  retrieveContextMock,
  retrieveAssetContextMock,
  retrieveSpreadsheetContextMock,
  streamChatCompletionMock,
} = vi.hoisted(() => ({
    retrieveMemoryContextMock: vi.fn(async () => null as string | null),
    retrieveGraphContextMock: vi.fn(async () => null as string | null),
    retrieveNamedEntityGraphContextMock: vi.fn(async () => null as string | null),
    retrieveContextMock: vi.fn(async () => [] as { chunkId: string; documentId: string; content: string; similarity: number }[]),
    retrieveAssetContextMock: vi.fn(async () => [] as { assetId: string; title: string; content: string; similarity: number }[]),
    retrieveSpreadsheetContextMock: vi.fn(async () => null as string | null),
    streamChatCompletionMock: vi.fn(
      async (_params: {
        system: string
        messages: { role: string; content: string }[]
        provider: { id: string }
        requestedProvider?: string
      }) => ({ content: 'Hello there.', model: 'test-model' }),
    ),
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
vi.mock('@/modules/ai/orchestration/retrieveAssetContext', () => ({ retrieveAssetContext: retrieveAssetContextMock }))
vi.mock('@/modules/knowledge-intelligence/api/retrieveGraphContext', () => ({ retrieveGraphContext: retrieveGraphContextMock }))
vi.mock('@/modules/knowledge-intelligence/api/retrieveNamedEntityGraphContext', () => ({ retrieveNamedEntityGraphContext: retrieveNamedEntityGraphContextMock }))
vi.mock('@/modules/ai/memory/retrieveMemoryContext', () => ({ retrieveMemoryContext: retrieveMemoryContextMock }))
vi.mock('@/modules/processing/api/retrieveSpreadsheetContext', () => ({ retrieveSpreadsheetContext: retrieveSpreadsheetContextMock }))
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
// Beta Invite + Quota repair — quotaService talks to Supabase directly
// (no mockable API-layer indirection), so unlike everything above this
// suite must mock it explicitly or every sendMessage call hits the real
// project over the network.
vi.mock('@/shared/lib/quotaService', () => ({
  quotaService: {
    checkQuota: vi.fn(async () => ({ allowed: true, used: 0, limit: 1000 })),
    consumeQuota: vi.fn(async () => true),
  },
}))
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

  // PIP Stabilization v1 (P0) — the fix for "NOVA has no information about
  // an uploaded image": an analyzed asset's content must actually reach
  // the prompt sent to the provider, and its id must reach
  // retrieveGraphContext so the image's own knowledge-graph relationships
  // are reachable too.
  it('includes analyzed image content in the prompt sent to the provider when retrieveAssetContext finds a match', async () => {
    retrieveAssetContextMock.mockResolvedValueOnce([
      { assetId: 'asset-1', title: 'IMG_0231', content: 'Image: "IMG_0231"\nA handwritten page of notes.', similarity: 0.9 },
    ])
    await sendMessage(baseParams())
    const lastCall = streamChatCompletionMock.mock.calls.at(-1)?.[0]
    expect(lastCall?.system).toContain('<visual_context>')
    expect(lastCall?.system).toContain('A handwritten page of notes.')
  })

  it('counts asset matches into retrievedChunks, so an image-only answer is not misreported as "nothing retrieved"', async () => {
    retrieveAssetContextMock.mockResolvedValueOnce([
      { assetId: 'asset-1', title: 'IMG_0231', content: 'Image: "IMG_0231"\nA handwritten page of notes.', similarity: 0.9 },
    ])
    const result = await sendMessage(baseParams())
    expect(result.contextTrace.retrievedChunks).toBe(1)
  })

  it('passes matched asset ids into retrieveGraphContext, so an image\'s own extracted knowledge nodes are reachable', async () => {
    retrieveAssetContextMock.mockResolvedValueOnce([
      { assetId: 'asset-1', title: 'IMG_0231', content: 'Image: "IMG_0231"\nA handwritten page of notes.', similarity: 0.9 },
    ])
    await sendMessage(baseParams())
    expect(retrieveGraphContextMock).toHaveBeenCalledWith(expect.objectContaining({ assetIds: ['asset-1'] }))
  })

  it('never breaks the chat response when retrieveAssetContext rejects (never-throws contract)', async () => {
    retrieveAssetContextMock.mockRejectedValueOnce(new Error('embedding provider unavailable'))
    const result = await sendMessage(baseParams())
    expect(result.message.content).toBe('Hello there.')
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
    // PIP Sprint 4/10 — resolveChunkProvenance now also calls these (before
    // the LLM call, to label context for the model) in addition to
    // resolveReferences (after, for the UI chips) — mockResolvedValue, not
    // Once, since both legitimately see the same chunk/document data.
    vi.mocked(getChunkLocations).mockResolvedValue([
      { id: 'chunk-1', document_id: 'doc-1', chapter_index: 3, chapter_title: 'The Turning Point' },
    ])
    vi.mocked(getDocumentTitles).mockResolvedValue([{ id: 'doc-1', title: 'Atomic Habits' }])

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

  // PIP Reliability Sprint 2/10 — Phase 6's central check: proving Note
  // content actually reaches the request sent to the provider, not merely
  // that a note id was passed around somewhere upstream. Explicit Note
  // analysis carries real content through `text` (buildNoteAnalysisSeedQuery,
  // called by ChatPage before this is ever invoked) rather than through
  // retrieval — so the property to verify here is that `text` (and prior
  // `history`) survive into `messages` completely unmodified: no
  // truncation, no chunking, no silent drop.
  describe('Note analysis context integrity', () => {
    it('carries the full note-analysis seed text — real content, not just a note id or title — into the provider request', async () => {
      const seedText =
        'Please analyze this note titled "Project meeting, 14 September":\n\n' +
        'Client wants the website launched before 30 September. Sarah will prepare the photography. ' +
        'Daniel will finalize the booking flow. Budget ceiling is $4,500. ' +
        'Decision: use the existing payment gateway rather than introducing a new provider.\n\n' +
        'Summarize the main ideas...'
      await sendMessage({ ...baseParams(), text: seedText })
      const lastCall = streamChatCompletionMock.mock.calls.at(-1)?.[0]
      const messages = lastCall?.messages as { role: string; content: string }[]
      expect(messages.at(-1)).toEqual({ role: 'user', content: seedText })
      expect(messages.at(-1)?.content).toContain('Budget ceiling is $4,500')
      expect(messages.at(-1)?.content).toContain('Sarah will prepare the photography')
    })

    it('does not truncate a substantially long note — the transport this milestone worried about is the URL, not this message array, and no length cap exists here', async () => {
      const longContent = 'Paragraph about the project. '.repeat(500) // ~15,000 characters
      await sendMessage({ ...baseParams(), text: longContent })
      const lastCall = streamChatCompletionMock.mock.calls.at(-1)?.[0]
      const messages = lastCall?.messages as { role: string; content: string }[]
      expect(messages.at(-1)?.content).toHaveLength(longContent.length)
      expect(messages.at(-1)?.content).toBe(longContent)
    })

    it('includes prior conversation history unmodified in the provider request, so a follow-up question still has the note-analysis turn in view', async () => {
      const history = [
        { role: 'user' as const, content: 'Please analyze this note titled "Project meeting":\n\nBudget ceiling is $4,500.' },
        { role: 'assistant' as const, content: 'The budget ceiling is $4,500.' },
      ]
      await sendMessage({ ...baseParams(), history, text: 'Which of those points is most important, and why?' })
      const lastCall = streamChatCompletionMock.mock.calls.at(-1)?.[0]
      const messages = lastCall?.messages as { role: string; content: string }[]
      expect(messages).toEqual([...history, { role: 'user', content: 'Which of those points is most important, and why?' }])
      expect(messages.some((m) => m.content.includes('$4,500'))).toBe(true)
    })

    it('routes a note-analysis message through the same provider fallback as any other message — no note-specific provider path', async () => {
      await sendMessage({ ...baseParams(), providerChain: ['anthropic', 'openai'], text: 'Please analyze this note...' })
      expect(streamChatCompletionMock).toHaveBeenCalledWith(
        expect.objectContaining({ provider: expect.objectContaining({ id: 'anthropic' }), requestedProvider: 'anthropic' }),
      )
    })
  })

  describe('Spreadsheet analysis context integrity (Sprint 3/10)', () => {
    const SPREADSHEET_TEXT = 'Sheet: Sales (6 rows, 5 columns)\nRevenue: sum 57,000, average 9,500, min 7,000, max 12,000'

    it('is not fetched at all when the turn has no documentId — the same guard every non-spreadsheet chat turn already relies on', async () => {
      retrieveSpreadsheetContextMock.mockClear()
      await sendMessage(baseParams())
      expect(retrieveSpreadsheetContextMock).toHaveBeenCalledWith(undefined)
      const lastCall = streamChatCompletionMock.mock.calls.at(-1)?.[0]
      expect(lastCall?.system).not.toContain('<spreadsheet_analysis>')
    })

    it('places the precomputed spreadsheet figures in a distinct <spreadsheet_analysis> block in the system prompt, not blended into {{context}}', async () => {
      retrieveSpreadsheetContextMock.mockResolvedValueOnce(SPREADSHEET_TEXT)
      await sendMessage({ ...baseParams(), documentId: 'doc-sales-1', text: 'What was our total revenue?' })
      expect(retrieveSpreadsheetContextMock).toHaveBeenCalledWith('doc-sales-1')
      const lastCall = streamChatCompletionMock.mock.calls.at(-1)?.[0]
      expect(lastCall?.system).toContain('<spreadsheet_analysis>')
      expect(lastCall?.system).toContain('57,000')
    })

    it('recomputes and re-includes the spreadsheet context on a follow-up turn — Test J does not depend on the model re-deriving figures from chat history alone', async () => {
      retrieveSpreadsheetContextMock.mockResolvedValue(SPREADSHEET_TEXT)
      const history = [
        { role: 'user' as const, content: 'What was our total revenue?' },
        { role: 'assistant' as const, content: 'Total revenue across all months was 57,000.' },
      ]
      await sendMessage({ ...baseParams(), documentId: 'doc-sales-1', history, text: 'Why was February stronger than March?' })
      expect(retrieveSpreadsheetContextMock).toHaveBeenLastCalledWith('doc-sales-1')
      const lastCall = streamChatCompletionMock.mock.calls.at(-1)?.[0]
      expect(lastCall?.system).toContain('<spreadsheet_analysis>')
      const messages = lastCall?.messages as { role: string; content: string }[]
      expect(messages).toEqual([...history, { role: 'user', content: 'Why was February stronger than March?' }])
    })

    it('routes a spreadsheet-grounded message through the same provider fallback as any other message — no spreadsheet-specific provider path', async () => {
      retrieveSpreadsheetContextMock.mockResolvedValueOnce(SPREADSHEET_TEXT)
      await sendMessage({ ...baseParams(), documentId: 'doc-sales-1', providerChain: ['anthropic', 'openai'], text: 'Which product had the highest revenue?' })
      expect(streamChatCompletionMock).toHaveBeenCalledWith(
        expect.objectContaining({ provider: expect.objectContaining({ id: 'anthropic' }), requestedProvider: 'anthropic' }),
      )
    })
  })

  describe('Named-entity graph context (Sprint 5/10)', () => {
    it('passes the raw question text and userId to retrieveNamedEntityGraphContext, independent of chunk retrieval', async () => {
      await sendMessage({ ...baseParams(), text: 'What is ARRIYIA connected to?' })
      expect(retrieveNamedEntityGraphContextMock).toHaveBeenCalledWith({ text: 'What is ARRIYIA connected to?', userId: 'user-1' })
    })

    it('includes named-entity graph evidence in the system prompt even when no document chunk matched (retrieveGraphContext returns null)', async () => {
      retrieveGraphContextMock.mockResolvedValueOnce(null)
      retrieveNamedEntityGraphContextMock.mockResolvedValueOnce('Entity: ARRIYIA\nConnections:\n- manages Northern Expansion — corroborated by 2 shared sources (document, note)')
      await sendMessage({ ...baseParams(), text: 'What is ARRIYIA connected to?' })
      const lastCall = streamChatCompletionMock.mock.calls.at(-1)?.[0]
      expect(lastCall?.system).toContain('<knowledge_connections>')
      expect(lastCall?.system).toContain('Entity: ARRIYIA')
      expect(lastCall?.system).toContain('corroborated by 2 shared sources')
    })

    it('merges chunk-sourced and named-entity graph context into one block rather than one silently overwriting the other', async () => {
      retrieveGraphContextMock.mockResolvedValueOnce('Concept: Northern Expansion\n\nSources:\n- Plan.pdf')
      retrieveNamedEntityGraphContextMock.mockResolvedValueOnce('Entity: ARRIYIA\n\nEvidence: 1 note')
      await sendMessage({ ...baseParams(), text: 'What is ARRIYIA connected to?' })
      const lastCall = streamChatCompletionMock.mock.calls.at(-1)?.[0]
      expect(lastCall?.system).toContain('Concept: Northern Expansion')
      expect(lastCall?.system).toContain('Entity: ARRIYIA')
    })

    it('produces no <knowledge_connections> block when neither graph context source has anything — never fabricates a connection', async () => {
      retrieveGraphContextMock.mockResolvedValueOnce(null)
      retrieveNamedEntityGraphContextMock.mockResolvedValueOnce(null)
      await sendMessage({ ...baseParams(), text: 'Does the document mention ZYNTHOCORP?' })
      const lastCall = streamChatCompletionMock.mock.calls.at(-1)?.[0]
      expect(lastCall?.system).not.toContain('<knowledge_connections>')
    })
  })
})
