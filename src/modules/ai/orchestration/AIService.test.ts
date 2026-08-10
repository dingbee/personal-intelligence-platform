import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
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
  retrieveNoteContextMock,
  retrieveSpreadsheetContextMock,
  streamChatCompletionMock,
} = vi.hoisted(() => ({
    retrieveMemoryContextMock: vi.fn(async () => null as string | null),
    retrieveGraphContextMock: vi.fn(async () => null as string | null),
    retrieveNamedEntityGraphContextMock: vi.fn(async () => null as string | null),
    retrieveContextMock: vi.fn(async () => [] as { chunkId: string; documentId: string; content: string; similarity: number }[]),
    retrieveAssetContextMock: vi.fn(async () => [] as { assetId: string; title: string; content: string; similarity: number }[]),
    retrieveNoteContextMock: vi.fn(async () => [] as { noteId: string; title: string; content: string; similarity: number }[]),
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

// PIP Sprint 9/10 — sendMessage now embeds the query once itself (shared
// across retrieveContext/retrieveAssetContext/retrieveNoteContext, see
// AIService.ts) instead of leaving embedding entirely to those mocked
// functions, so this suite needs its own embedding-provider mock or every
// sendMessage call would hit the real edge function over the network.
// Named/hoisted (not an inline factory) so tests below can assert on it —
// e.g. that the query is embedded exactly once per turn, not three times.
const { invokeAiEmbedMock } = vi.hoisted(() => ({
  invokeAiEmbedMock: vi.fn(async () => ({ embeddings: [[0.1, 0.2, 0.3]], model: 'text-embedding-3-small', promptTokens: 5 })),
}))
// AI_REQUEST_TIMEOUT_MESSAGE has to actually be exported here (not just
// invokeAiEmbed) — normalizeAiError.ts reads it at module scope, and the
// Phase 1 chat-send-UX tests below import normalizeAiError directly.
vi.mock('@/modules/ai/providers/edgeFunctionClient', () => ({
  invokeAiEmbed: invokeAiEmbedMock,
  AI_REQUEST_TIMEOUT_MESSAGE: 'AI request timed out after 45s of inactivity',
}))
vi.mock('@/modules/ai/observability/api/aiRequests', () => ({ logAiRequest: vi.fn(async () => {}) }))

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
vi.mock('@/modules/ai/orchestration/retrieveNoteContext', () => ({ retrieveNoteContext: retrieveNoteContextMock }))
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
  it('calls retrieveMemoryContext with the userId/workspaceId/text, wiring it into the request exactly like retrieveGraphContext', async () => {
    await sendMessage(baseParams())
    expect(retrieveMemoryContextMock).toHaveBeenCalledWith({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      text: 'What have I learned about hospitality?',
    })
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
    expect(lastCall?.system).toContain('You are ARRIYIA')
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

  // PIP Sprint 7/10 — the fix for the central discovery finding: a note's
  // content must actually reach the prompt sent to the provider, not only
  // when a knowledge-graph node for its subject happens to already exist
  // from a different source.
  it('includes note content in the prompt sent to the provider when retrieveNoteContext finds a match', async () => {
    retrieveNoteContextMock.mockResolvedValueOnce([{ noteId: 'note-1', title: 'Meeting Notes', content: 'ARRIYIA was mentioned once.', similarity: 0.9 }])
    await sendMessage(baseParams())
    const lastCall = streamChatCompletionMock.mock.calls.at(-1)?.[0]
    expect(lastCall?.system).toContain('<note_context>')
    expect(lastCall?.system).toContain('ARRIYIA was mentioned once.')
  })

  it('counts note matches into retrievedChunks, so a note-only answer is not misreported as "nothing retrieved"', async () => {
    retrieveNoteContextMock.mockResolvedValueOnce([{ noteId: 'note-1', title: 'Meeting Notes', content: 'ARRIYIA was mentioned once.', similarity: 0.9 }])
    const result = await sendMessage(baseParams())
    expect(result.contextTrace.retrievedChunks).toBe(1)
  })

  it('never breaks the chat response when retrieveNoteContext rejects (never-throws contract)', async () => {
    retrieveNoteContextMock.mockRejectedValueOnce(new Error('embedding provider unavailable'))
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

  /**
   * PIP Sprint 7/10, Phase 8 — cross-feature retrieval acceptance tests A-J,
   * pinned at the same boundary every prior sprint's tests use: the actual
   * assembled system prompt / contextTrace object reaching the provider,
   * never an LLM's wording. Several letters (F, part of G) are already
   * covered in full by the Sprint 5/10 and Sprint 6/10 describe blocks
   * above and are not duplicated here.
   */
  describe('Cross-feature retrieval acceptance (Sprint 7/10, Phase 8)', () => {
    it('Test A/B — a matched chunk (however retrieveContext found it — exact or semantic) reaches the system prompt', async () => {
      retrieveContextMock.mockResolvedValueOnce([{ chunkId: 'c1', documentId: 'd1', content: 'ARRIYIA was discussed once.', similarity: 0.9 }])
      await sendMessage(baseParams())
      const lastCall = streamChatCompletionMock.mock.calls.at(-1)?.[0]
      expect(lastCall?.system).toContain('ARRIYIA was discussed once.')
    })

    it('Test C — a document chunk and a note both contribute evidence in the same turn, in distinct blocks', async () => {
      retrieveContextMock.mockResolvedValueOnce([{ chunkId: 'c1', documentId: 'd1', content: 'The document says ARRIYIA manages the project.', similarity: 0.8 }])
      retrieveNoteContextMock.mockResolvedValueOnce([{ noteId: 'n1', title: 'Meeting Notes', content: 'My note says ARRIYIA joined in March.', similarity: 0.7 }])
      await sendMessage(baseParams())
      const lastCall = streamChatCompletionMock.mock.calls.at(-1)?.[0]
      expect(lastCall?.system).toContain('The document says ARRIYIA manages the project.')
      expect(lastCall?.system).toContain('<note_context>')
      expect(lastCall?.system).toContain('My note says ARRIYIA joined in March.')
    })

    it('Test D — an analyzed image and a document both contribute evidence in the same turn, in distinct blocks', async () => {
      retrieveContextMock.mockResolvedValueOnce([{ chunkId: 'c1', documentId: 'd1', content: 'The document describes the site plan.', similarity: 0.8 }])
      retrieveAssetContextMock.mockResolvedValueOnce([{ assetId: 'a1', title: 'Photo', content: 'Image: "Photo"\nA photo of the same site.', similarity: 0.7 }])
      await sendMessage(baseParams())
      const lastCall = streamChatCompletionMock.mock.calls.at(-1)?.[0]
      expect(lastCall?.system).toContain('The document describes the site plan.')
      expect(lastCall?.system).toContain('<visual_context>')
      expect(lastCall?.system).toContain('A photo of the same site.')
    })

    it('Test E — a spreadsheet\'s precomputed figures and a document\'s explanatory text both contribute evidence in the same turn', async () => {
      retrieveContextMock.mockResolvedValueOnce([{ chunkId: 'c1', documentId: 'doc-sales-1', content: 'Revenue grew due to the new product line.', similarity: 0.8 }])
      retrieveSpreadsheetContextMock.mockResolvedValueOnce('Revenue: sum 57,000, average 9,500')
      await sendMessage({ ...baseParams(), documentId: 'doc-sales-1' })
      const lastCall = streamChatCompletionMock.mock.calls.at(-1)?.[0]
      expect(lastCall?.system).toContain('Revenue grew due to the new product line.')
      expect(lastCall?.system).toContain('<spreadsheet_analysis>')
      expect(lastCall?.system).toContain('57,000')
    })

    it('Test G — an irrelevant personal memory does not contaminate the prompt when retrieveMemoryContext (already relevance-filtered, Sprint 6/10) finds nothing for this turn', async () => {
      retrieveMemoryContextMock.mockResolvedValueOnce(null)
      await sendMessage(baseParams())
      const lastCall = streamChatCompletionMock.mock.calls.at(-1)?.[0]
      expect(lastCall?.system).not.toContain('<personal_context>')
    })

    it('Test H — when nothing is relevant anywhere, the prompt says so explicitly rather than omitting context silently', async () => {
      const result = await sendMessage(baseParams())
      const lastCall = streamChatCompletionMock.mock.calls.at(-1)?.[0]
      expect(lastCall?.system).toContain("(No relevant content found in the user's library.)")
      expect(result.contextTrace).toEqual({ retrievedChunks: 0, graphNodes: 0, memoriesUsed: 0 })
    })

    it('Test I — conflicting evidence from two sources both reach the prompt, distinguishably, rather than one silently overwriting the other', async () => {
      retrieveContextMock.mockResolvedValueOnce([{ chunkId: 'c1', documentId: 'doc-sales-1', content: 'The report states total revenue was 50,000.', similarity: 0.8 }])
      retrieveSpreadsheetContextMock.mockResolvedValueOnce('Revenue: sum 57,000')
      await sendMessage({ ...baseParams(), documentId: 'doc-sales-1' })
      const lastCall = streamChatCompletionMock.mock.calls.at(-1)?.[0]
      expect(lastCall?.system).toContain('50,000')
      expect(lastCall?.system).toContain('57,000')
      expect(lastCall?.system).toContain('<spreadsheet_analysis>')
    })

    it('Test J — distinct notes never collapse into one contextTrace count, so no source is silently dropped for looking similar', async () => {
      retrieveNoteContextMock.mockResolvedValueOnce([
        { noteId: 'n1', title: 'Note One', content: 'First distinct note.', similarity: 0.8 },
        { noteId: 'n2', title: 'Note Two', content: 'Second distinct note.', similarity: 0.7 },
      ])
      const result = await sendMessage(baseParams())
      expect(result.contextTrace.retrievedChunks).toBe(2)
      const lastCall = streamChatCompletionMock.mock.calls.at(-1)?.[0]
      expect(lastCall?.system).toContain('[1] (Note: Note One) First distinct note.')
      expect(lastCall?.system).toContain('[2] (Note: Note Two) Second distinct note.')
    })
  })

  /**
   * PIP Sprint 9/10 (Performance & Scale) — discovery found retrieveContext,
   * retrieveAssetContext, and retrieveNoteContext each independently
   * embedding the same query text (three real OpenAI calls for one
   * identical string), ~6 of the turn's retrieval sources running in
   * strict sequence despite being mutually independent, and quotaService
   * only being checked after all of that work had already run. These
   * tests pin the fixed contracts at the same boundary every prior
   * sprint's tests use: sendMessage's actual behavior, not an LLM's
   * wording or literal call ordering (Promise.all doesn't guarantee
   * start order, only that every branch does eventually run).
   */
  describe('Performance & Scale (Sprint 9/10)', () => {
    beforeEach(() => {
      invokeAiEmbedMock.mockClear()
      retrieveContextMock.mockClear()
      retrieveAssetContextMock.mockClear()
      retrieveNoteContextMock.mockClear()
      retrieveMemoryContextMock.mockClear()
      streamChatCompletionMock.mockClear()
    })

    it('embeds the query exactly once per turn, not once per retrieval source', async () => {
      await sendMessage(baseParams())
      expect(invokeAiEmbedMock).toHaveBeenCalledTimes(1)
    })

    it('shares the one computed embedding with retrieveContext, retrieveAssetContext, and retrieveNoteContext', async () => {
      await sendMessage(baseParams())
      const embedding = (await invokeAiEmbedMock.mock.results[0]!.value).embeddings[0]
      expect(retrieveContextMock).toHaveBeenCalledWith(expect.objectContaining({ embedding }))
      expect(retrieveAssetContextMock).toHaveBeenCalledWith(expect.objectContaining({ embedding }))
      expect(retrieveNoteContextMock).toHaveBeenCalledWith(expect.objectContaining({ embedding }))
    })

    it('checks quota before doing any retrieval work, and fails fast without ever calling a retrieval source', async () => {
      const { quotaService } = await import('@/shared/lib/quotaService')
      vi.mocked(quotaService.checkQuota).mockResolvedValueOnce({ allowed: false, reason: 'Quota exceeded for this billing period.' })

      await expect(sendMessage(baseParams())).rejects.toThrow('Quota exceeded for this billing period.')

      expect(retrieveContextMock).not.toHaveBeenCalled()
      expect(retrieveAssetContextMock).not.toHaveBeenCalled()
      expect(retrieveMemoryContextMock).not.toHaveBeenCalled()
      expect(invokeAiEmbedMock).not.toHaveBeenCalled()
      expect(streamChatCompletionMock).not.toHaveBeenCalled()
    })

    it('still completes a normal turn when every independent retrieval source succeeds concurrently', async () => {
      retrieveContextMock.mockResolvedValueOnce([{ chunkId: 'c1', documentId: 'd1', content: 'A passage.', similarity: 0.8 }])
      retrieveMemoryContextMock.mockResolvedValueOnce('## Learned preferences\n- Likes concise answers')
      const result = await sendMessage(baseParams())
      expect(result.message.content).toBe('Hello there.')
      expect(result.contextTrace).toEqual({ retrievedChunks: 1, graphNodes: 0, memoriesUsed: 1 })
    })
  })

  /**
   * ARRIYIA Product Completion Phase 1 — the fix for "a failed chat send
   * can discard the user's typed message with no retry or restoration."
   * insertMessage runs unconditionally at the very top of sendMessage,
   * before quota/retrieval/the provider call — every one of those can
   * fail *after* the user's turn is already persisted, so a naive retry
   * (just calling sendMessage again) would insert a second row for the
   * same turn. These tests pin the fix: failures carry the already-
   * persisted message back out (ChatSendFailure), and passing it back in
   * as existingUserMessage on retry skips the insert entirely.
   */
  describe('Retry / no-duplicate-user-message (Phase 1 chat-send UX)', () => {
    beforeEach(async () => {
      const { insertMessage } = await import('@/modules/ai/chat/api/messages')
      vi.mocked(insertMessage).mockClear()
    })

    it('inserts exactly one user message for a normal (non-retry) send', async () => {
      const { insertMessage } = await import('@/modules/ai/chat/api/messages')
      await sendMessage(baseParams())
      const userInserts = vi.mocked(insertMessage).mock.calls.filter(([params]) => params.role === 'user')
      expect(userInserts).toHaveLength(1)
    })

    it('skips inserting a new user message when existingUserMessage is provided — only the assistant reply is inserted', async () => {
      const { insertMessage } = await import('@/modules/ai/chat/api/messages')
      const existingUserMessage = {
        id: 'msg-existing',
        conversation_id: 'conv-1',
        user_id: 'user-1',
        role: 'user' as const,
        content: baseParams().text,
        context_chunk_ids: [],
        created_at: new Date().toISOString(),
      }
      await sendMessage({ ...baseParams(), existingUserMessage })
      expect(insertMessage).toHaveBeenCalledTimes(1)
      expect(insertMessage).toHaveBeenCalledWith(expect.objectContaining({ role: 'assistant' }))
    })

    it('wraps a downstream provider failure in ChatSendFailure, carrying the already-persisted user message', async () => {
      streamChatCompletionMock.mockRejectedValueOnce(new Error('upstream 502'))
      await expect(sendMessage(baseParams())).rejects.toMatchObject({
        userMessage: expect.objectContaining({ role: 'user', content: baseParams().text }),
      })
    })

    it('a retry that reuses the persisted user message never creates a duplicate, even after the first attempt failed downstream', async () => {
      const { insertMessage } = await import('@/modules/ai/chat/api/messages')
      streamChatCompletionMock.mockRejectedValueOnce(new Error('upstream 502'))

      let failure: unknown
      try {
        await sendMessage(baseParams())
      } catch (err) {
        failure = err
      }
      expect(insertMessage).toHaveBeenCalledTimes(1) // only the failed attempt's user message

      const userMessage = (failure as { userMessage: { id: string; role: string } }).userMessage
      expect(userMessage.role).toBe('user')

      // Retry: same conversation/text, reusing the persisted row — this time the provider succeeds.
      const result = await sendMessage({ ...baseParams(), existingUserMessage: userMessage as never })
      expect(result.message.content).toBe('Hello there.')

      // Total across both attempts: the one original user insert + one assistant insert. No second user row.
      expect(insertMessage).toHaveBeenCalledTimes(2)
      const userInserts = vi.mocked(insertMessage).mock.calls.filter(([params]) => params.role === 'user')
      expect(userInserts).toHaveLength(1)
    })

    it('a quota denial also carries the persisted user message, so retry-after-topping-up-quota does not duplicate the turn either', async () => {
      const { quotaService } = await import('@/shared/lib/quotaService')
      vi.mocked(quotaService.checkQuota).mockResolvedValueOnce({ allowed: false, reason: 'AI quota limit reached' })
      await expect(sendMessage(baseParams())).rejects.toMatchObject({
        userMessage: expect.objectContaining({ role: 'user' }),
      })
    })

    it('categorizes ARRIYIA quota denial as quota_exceeded, distinct from a transport/provider failure, via normalizeAiError', async () => {
      const { quotaService } = await import('@/shared/lib/quotaService')
      vi.mocked(quotaService.checkQuota).mockResolvedValueOnce({ allowed: false, reason: 'AI quota limit reached' })
      const { normalizeAiError } = await import('@/modules/ai/orchestration/normalizeAiError')

      let failure: unknown
      try {
        await sendMessage(baseParams())
      } catch (err) {
        failure = err
      }
      const normalized = normalizeAiError(failure)
      expect(normalized.category).toBe('quota_exceeded')
      expect(normalized.message).toBe('AI quota limit reached')
      expect(normalized.isProviderUnavailable).toBe(false)
    })

    it('does not mistake a genuine transport/provider failure for a quota denial, even when its text happens to mention "quota"', async () => {
      streamChatCompletionMock.mockRejectedValueOnce(new Error('upstream 502: you exceeded your current quota'))
      const { normalizeAiError } = await import('@/modules/ai/orchestration/normalizeAiError')

      let failure: unknown
      try {
        await sendMessage(baseParams())
      } catch (err) {
        failure = err
      }
      const normalized = normalizeAiError(failure)
      expect(normalized.category).not.toBe('quota_exceeded')
      expect(normalized.category).toBe('rate_limited')
    })

    it('never calls consumeQuota for a failed send — a failed turn is never billed against the user\'s quota', async () => {
      streamChatCompletionMock.mockRejectedValueOnce(new Error('upstream 502'))
      const { quotaService } = await import('@/shared/lib/quotaService')
      vi.mocked(quotaService.consumeQuota).mockClear()
      await expect(sendMessage(baseParams())).rejects.toThrow()
      expect(quotaService.consumeQuota).not.toHaveBeenCalled()
    })
  })
})
