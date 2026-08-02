import { beforeAll, describe, expect, it, vi } from 'vitest'
import { promptRegistry } from '@/modules/core/prompts/registry'
import type { Message, Note } from '@/shared/types/database'
import type { WorkspaceActionContext } from '@/modules/workspace-actions/types'
import { getArtifactKind, getArtifactData, getCreationMethod } from '@/modules/ai/artifacts/artifactMetadata'
import type { SpreadsheetArtifactData } from '@/modules/ai/artifacts/spreadsheet/types'

/**
 * UX-14.4.3 — the critical UX-14.4 regression: proves the generation
 * pipeline built in UX-14.4.2 and the Save-to-Notes pipeline built in
 * UX-14.4 Phase 2 still compose correctly after this milestone's changes
 * (structured preview, creationMethod). Mocks exactly the same two
 * boundaries their own test suites already mock independently
 * (`streamChatCompletion` for generation, the Supabase-touching notes API
 * for saving) and exercises every real function in between —
 * `parseSpreadsheetSpecificationResponse`, `validateSpreadsheetSpecification`,
 * `compileSpreadsheetSpecification`, `validateFormulaSafety`,
 * `renderSpreadsheetArtifactMarkdown`, `detectArtifactKind`,
 * `buildArtifactGenerationMetadata`, `parseMarkdownTableToArtifact`,
 * `withCreationMethod` — none of them mocked.
 */
const { streamChatCompletionMock } = vi.hoisted(() => ({
  streamChatCompletionMock: vi.fn(async (_params: { system: string }) => ({ content: '', model: 'test-model' })),
}))
vi.mock('@/modules/ai/orchestration/streamChatCompletion', () => ({ streamChatCompletion: streamChatCompletionMock }))

const { createNoteMock, linkNoteToConversationMock, linkNoteToMessageMock, indexNoteMock, linkKnownConceptsToSourceMock } =
  vi.hoisted(() => ({
    createNoteMock: vi.fn(),
    linkNoteToConversationMock: vi.fn(async () => {}),
    linkNoteToMessageMock: vi.fn(async () => {}),
    indexNoteMock: vi.fn(async () => {}),
    linkKnownConceptsToSourceMock: vi.fn(async () => {}),
  }))
vi.mock('@/modules/notes/api/notes', () => ({ createNote: createNoteMock }))
vi.mock('@/modules/notes/api/knowledgeLinks', () => ({
  linkNoteToConversation: linkNoteToConversationMock,
  linkNoteToMessage: linkNoteToMessageMock,
}))
vi.mock('@/modules/search/indexing/indexNote', () => ({ indexNote: indexNoteMock }))
vi.mock('@/modules/knowledge-intelligence/api/linkKnownConcepts', () => ({ linkKnownConceptsToSource: linkKnownConceptsToSourceMock }))

import { generateSpreadsheetArtifactAction } from '@/modules/workspace-actions/actions/generateSpreadsheetArtifactAction'
import { saveMessageToNote } from '@/modules/notes/api/saveMessageToNote'

beforeAll(() => {
  promptRegistry.register({
    id: 'generate-spreadsheet-artifact@1.0',
    capabilityId: 'generate-spreadsheet-artifact',
    version: '1.0',
    active: true,
    template: 'Request: {{request}}',
  })
})

function fakeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    user_id: 'user-1',
    workspace_id: 'workspace-1',
    document_id: null,
    title: 'Saved title',
    content: 'placeholder',
    source_chunk_ids: null,
    generation_metadata: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as Note
}

describe('Generate spreadsheet artifact -> preview -> Save-to-Notes lifecycle', () => {
  it('produces an ArtifactPreview, then saving that response preserves artifactKind/artifactData and tags conversation_saved', async () => {
    streamChatCompletionMock.mockResolvedValueOnce({
      content: JSON.stringify({
        title: 'Quarterly Budget',
        kind: 'template',
        sheets: [
          {
            name: 'Budget',
            columns: [{ name: 'Category' }, { name: 'Q1' }, { name: 'Q2' }],
            rows: [{ values: ['Marketing', 4000, 4500] }, { values: ['Engineering', 12000, 13000] }],
            formulas: [],
          },
        ],
      }),
      model: 'test-model',
    })

    const context: WorkspaceActionContext = {
      userId: 'user-1',
      workspaceId: 'workspace-1',
      conversationId: 'conv-1',
      chain: ['openai'],
    }

    // Step 1: generation.
    const outcome = await generateSpreadsheetArtifactAction.run({ request: 'a quarterly budget' }, context)
    expect(outcome.artifactPreview).toEqual({
      kind: 'spreadsheet',
      title: 'Quarterly Budget',
      content: expect.stringContaining('| Category | Q1 | Q2 |'),
    })
    // responseText (what actually gets persisted/saved below) must carry
    // the same markdown table the preview does — the save pipeline only
    // ever sees responseText, never artifactPreview.
    expect(outcome.responseText).toContain('| Category | Q1 | Q2 |')
    expect(outcome.responseText).toContain('| Marketing | 4000 | 4500 |')

    // Step 2: this is what AIService.sendMessage would have persisted as
    // the assistant message's content.
    const savedNote = fakeNote({ content: outcome.responseText })
    createNoteMock.mockResolvedValueOnce(savedNote)
    const assistantMessage: Message = {
      id: 'message-1',
      conversation_id: 'conv-1',
      user_id: 'user-1',
      role: 'assistant',
      content: outcome.responseText,
      context_chunk_ids: [],
      created_at: '2026-01-01T00:00:05.000Z',
    } as Message

    // Step 3: Save-to-Notes.
    await saveMessageToNote({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      conversationId: 'conv-1',
      conversationTitle: 'Budget planning',
      message: assistantMessage,
    })

    expect(createNoteMock).toHaveBeenCalledTimes(1)
    const createNoteCall = createNoteMock.mock.calls[0]![0] as {
      generationMetadata: Record<string, unknown>
    }

    // Step 4: the saved note's generation_metadata is what actually
    // matters — verified via the real getters, not by re-parsing the raw
    // object, so this test breaks if those getters' contracts ever change.
    const noteWithMetadata = { generation_metadata: createNoteCall.generationMetadata }
    expect(getArtifactKind(noteWithMetadata)).toBe('spreadsheet')
    expect(getCreationMethod(noteWithMetadata)).toBe('conversation_saved')

    const artifactData = getArtifactData<SpreadsheetArtifactData>(noteWithMetadata)
    expect(artifactData?.sheets).toHaveLength(1)
    expect(artifactData?.sheets[0]?.columns).toEqual(['Category', 'Q1', 'Q2'])
    expect(artifactData?.sheets[0]?.cells).toContainEqual({ cell: 'A2', value: 'Marketing' })
    expect(artifactData?.sheets[0]?.cells).toContainEqual({ cell: 'B2', value: 4000 })
  })
})
