import { createNote } from '@/modules/notes/api/notes'
import { withArtifactKind, withCreationMethod } from '@/modules/ai/artifacts/artifactMetadata'
import { formatResearchAsNoteContent } from '@/modules/research-intelligence/api/formatResearchAsNoteContent'
import type { ResearchInvestigation } from '@/modules/research-intelligence/researchInvestigation'
import type { Note } from '@/shared/types/database'

/**
 * Research Intelligence — "Save Research" persistence. Reuses the exact
 * Notes infrastructure and generation_metadata convention every other
 * AI-generated artifact in this codebase already uses (generateBriefing.ts,
 * generateWorkspaceBriefing.ts) rather than a dedicated
 * research_investigations table: a completed ResearchInvestigation is
 * fully representable as a Note's title/content plus a `researchQuestion`
 * tag inside generation_metadata, and 'report' — "a multi-section
 * structured document" — is already an existing ArtifactKind that
 * precisely describes it; no schema extension was needed. This also
 * closes the one persistence gap the architecture audit found in the
 * Data/Analysis Intelligence layers below Research Intelligence
 * (AnalysisInvestigation results are never persisted at all today) —
 * saving a research investigation that delegated to one preserves that
 * dataset investigation's synthesis inside the note content (see
 * formatResearchAsNoteContent.ts), even though the underlying
 * AnalysisInvestigation object itself still only exists for the
 * lifetime of the request (BACKLOG: a "Save Investigation" path for
 * Analysis Intelligence on its own belongs to a future phase).
 */
export async function saveResearchToNote(params: { investigation: ResearchInvestigation; userId: string; workspaceId: string | null }): Promise<Note> {
  const { investigation, userId, workspaceId } = params

  const content = formatResearchAsNoteContent(investigation)
  const generationMetadata = withCreationMethod(withArtifactKind({ researchQuestion: investigation.question, researchInvestigationId: investigation.id }, 'report'), 'ai_generated')

  return createNote({
    userId,
    workspaceId,
    title: `Research: ${investigation.question}`,
    content,
    documentId: investigation.documentId,
    generationMetadata,
  })
}
