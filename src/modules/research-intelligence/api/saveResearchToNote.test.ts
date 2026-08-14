import { describe, expect, it, vi } from 'vitest'

const { createNoteMock } = vi.hoisted(() => ({ createNoteMock: vi.fn() }))
vi.mock('@/modules/notes/api/notes', () => ({ createNote: createNoteMock }))

import { saveResearchToNote } from '@/modules/research-intelligence/api/saveResearchToNote'
import type { ResearchInvestigation } from '@/modules/research-intelligence/researchInvestigation'

const investigation: ResearchInvestigation = {
  id: 'inv-1', question: 'Why are regional returns different?', scope: null, context: null, workspaceId: 'workspace-1', documentId: 'doc-1',
  steps: [], hypotheses: [], comparisons: [], gaps: [], keyFindings: [], synthesis: 'South is higher.', limitations: null,
  followUpQuestions: [], status: 'complete', stepLimitReached: false, synthesisFailed: false, declineReason: null,
}

describe('saveResearchToNote', () => {
  it('persists via the existing createNote API, reusing the Note artifact/creation-method conventions', async () => {
    createNoteMock.mockResolvedValue({ id: 'note-1' })

    await saveResearchToNote({ investigation, userId: 'user-1', workspaceId: 'workspace-1' })

    expect(createNoteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        workspaceId: 'workspace-1',
        title: 'Research: Why are regional returns different?',
        documentId: 'doc-1',
        generationMetadata: expect.objectContaining({ artifactKind: 'report', creationMethod: 'ai_generated', researchQuestion: investigation.question }),
      }),
    )
  })
})
