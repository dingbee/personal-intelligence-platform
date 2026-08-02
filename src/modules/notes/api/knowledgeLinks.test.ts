import { describe, expect, it, vi } from 'vitest'

interface FakeKnowledgeLinkRow {
  id: string
  user_id: string
  workspace_id: string
  source_type: string
  source_id: string
  target_type: string
  target_id: string
  created_at: string
  relationship_type: null
  confidence: null
  generated_by: null
  metadata: null
}

const { insertMock, singleMock, fromMock } = vi.hoisted(() => {
  const singleMock = vi.fn(async (): Promise<{ data: FakeKnowledgeLinkRow | null; error: Error | null }> => ({
    data: {
      id: 'link-1',
      user_id: 'user-1',
      workspace_id: 'workspace-1',
      source_type: 'note',
      source_id: 'note-1',
      target_type: 'memory',
      target_id: 'memory-1',
      created_at: '2026-01-01T00:00:00.000Z',
      relationship_type: null,
      confidence: null,
      generated_by: null,
      metadata: null,
    },
    error: null,
  }))
  const selectMock = vi.fn(() => ({ single: singleMock }))
  const insertMock = vi.fn(() => ({ select: selectMock }))
  const fromMock = vi.fn(() => ({ insert: insertMock }))
  return { insertMock, singleMock, fromMock }
})

vi.mock('@/shared/lib/supabase', () => ({ supabase: { from: fromMock } }))

import { linkNoteToMemory } from '@/modules/notes/api/knowledgeLinks'

describe('linkNoteToMemory', () => {
  it('inserts a note->memory knowledge_links row', async () => {
    const result = await linkNoteToMemory({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      noteId: 'note-1',
      memoryId: 'memory-1',
    })

    expect(fromMock).toHaveBeenCalledWith('knowledge_links')
    expect(insertMock).toHaveBeenCalledWith({
      user_id: 'user-1',
      workspace_id: 'workspace-1',
      source_type: 'note',
      source_id: 'note-1',
      target_type: 'memory',
      target_id: 'memory-1',
    })
    expect(result.target_type).toBe('memory')
  })

  it('throws when Supabase returns an error', async () => {
    singleMock.mockResolvedValueOnce({ data: null, error: new Error('insert failed') })
    await expect(
      linkNoteToMemory({ userId: 'user-1', workspaceId: null, noteId: 'note-1', memoryId: 'memory-1' }),
    ).rejects.toThrow('insert failed')
  })
})
