import { describe, expect, it, vi } from 'vitest'

const { getNoteMock } = vi.hoisted(() => ({ getNoteMock: vi.fn() }))
vi.mock('@/modules/notes/api/notes', () => ({ getNote: getNoteMock }))

import { resolveNoteAnalysisSeedText } from '@/modules/notes/intelligence/resolveNoteAnalysisSeedText'

describe('resolveNoteAnalysisSeedText', () => {
  it('fetches the note by the given id and builds a seed message from its real content', async () => {
    getNoteMock.mockResolvedValueOnce({
      id: 'note-1',
      title: 'Project meeting, 14 September',
      content: 'Budget ceiling is $4,500. Sarah will prepare the photography.',
    })

    const seedText = await resolveNoteAnalysisSeedText('note-1')

    expect(getNoteMock).toHaveBeenCalledWith('note-1')
    expect(seedText).toContain('Project meeting, 14 September')
    expect(seedText).toContain('Budget ceiling is $4,500')
    expect(seedText).toContain('Sarah will prepare the photography')
  })

  // Test 9 — unauthorized access. getNote's .single() throws identically
  // whether the note doesn't exist or RLS denies this user access to it —
  // the same information-non-leaking behavior either way, so this one
  // case covers both.
  it('produces an honest, visible fallback message instead of throwing when the note is inaccessible (RLS-denied or another user\'s note)', async () => {
    getNoteMock.mockRejectedValueOnce(new Error('JSON object requested, multiple (or no) rows returned'))

    const seedText = await resolveNoteAnalysisSeedText('someone-elses-note')

    expect(seedText).toMatch(/couldn't access it/i)
    expect(seedText).not.toContain('someone-elses-note')
  })

  // Test 10 — missing/deleted note produces a graceful failure, not a
  // silent one (an unhandled rejection previously left the conversation
  // empty with zero feedback — see ChatPage.tsx's initialNoteId effect).
  it('produces the same graceful fallback for a deleted/nonexistent note id', async () => {
    getNoteMock.mockRejectedValueOnce(new Error('no rows returned'))

    const seedText = await resolveNoteAnalysisSeedText('deleted-note-id')

    expect(seedText.length).toBeGreaterThan(0)
    expect(seedText).toMatch(/deleted|permission/i)
  })
})
