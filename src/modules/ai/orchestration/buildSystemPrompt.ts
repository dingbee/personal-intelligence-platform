import { getActivePrompt } from '@/modules/core/prompts/registry'
import { renderPromptTemplate } from '@/modules/core/prompts/renderPromptTemplate'
import type { VectorMatch } from '@/modules/ai/retrieval/VectorStore'
import type { AssetContextMatch } from '@/modules/ai/orchestration/retrieveAssetContext'

/**
 * Told to the model explicitly rather than left implicit — memory is
 * personalization, not evidence. Without this, a model could treat "user
 * likes concise explanations" as license to skip retrieved facts instead
 * of just shortening how it presents them.
 */
const MEMORY_SAFETY_NOTE =
  'Personal context below may influence style, tone, and personalization, but must never override or ' +
  "replace factual evidence from the retrieved documents above. If personal context and the user's current " +
  'question conflict, answer the question — use personal context only to shape how you say it.'

/**
 * Fills the active 'chat' PromptTemplate's {{context}} placeholder with
 * retrieved chunks, then optionally appends two further blocks: Phase 9D's
 * <knowledge_connections> (AI-extracted concepts/entities/relationships
 * from the same retrieved documents) and Phase UX-5.2's <personal_context>
 * (the user's stored memories — preferences, explicit profile facts,
 * durable facts from past conversations).
 *
 * The rag-chat@1.0 template itself is untouched by this — every extra
 * block is appended to the rendered result, not woven into {{context}},
 * so the existing prompt contract (and its behavior when a block is
 * absent) stays exactly as it was before either phase. Each block is
 * independently optional and independently omitted when its source has
 * nothing to contribute — documents = external knowledge, graph =
 * relationships, memory = user context; keeping them in separate tagged
 * blocks is what lets the model (and a future prompt revision) treat
 * them differently instead of blending everything into one undifferentiated context.
 */
export function buildSystemPrompt(
  matches: VectorMatch[],
  graphContext?: string | null,
  memoryContext?: string | null,
  spreadsheetContext?: string | null,
  assetMatches?: AssetContextMatch[],
  /**
   * PIP Sprint 4/10 — chunkId -> "Document Title — Page/Chapter Title"
   * (or just the title, when there's no page/chapter data). Optional and
   * additive: omitted (every call site before this sprint, and every
   * existing test) renders the exact unlabeled `[i] content` form this
   * function already produced — see resolveChunkProvenance.ts for how
   * the map is built.
   */
  chunkProvenance?: Map<string, string>,
): string {
  const template = getActivePrompt('chat')
  if (!template) throw new Error('No active prompt template for the "chat" capability — is coreModule registered?')

  const context =
    matches.length > 0
      ? matches
          .map((match, i) => {
            const label = chunkProvenance?.get(match.chunkId)
            return `[${i + 1}]${label ? ` (${label})` : ''} ${match.content}`
          })
          .join('\n\n')
      : '(No relevant content found in the user\'s library.)'

  let prompt = renderPromptTemplate(template.template, { context })

  // PIP Stabilization v1 (P0) — a distinct tagged block, not folded into
  // {{context}}: an image's analyzed content is real evidence, same as a
  // document chunk, but keeping it separately labeled lets the model (and
  // the user, if it explains itself) be explicit that this came from an
  // uploaded image rather than a document.
  if (assetMatches && assetMatches.length > 0) {
    const visualContext = assetMatches.map((match, i) => `[${i + 1}] ${match.content}`).join('\n\n')
    prompt += `\n\n<visual_context>\n${visualContext}\n</visual_context>`
  }

  if (graphContext) {
    prompt += `\n\n<knowledge_connections>\n${graphContext}\n</knowledge_connections>`
  }

  // UX-13.10 — deterministic, precomputed spreadsheet figures (sums,
  // comparisons, trends, anomalies), placed ahead of memory the same way
  // graph context is: it's evidence, not personalization.
  if (spreadsheetContext) {
    prompt += `\n\n<spreadsheet_analysis>\n${spreadsheetContext}\n</spreadsheet_analysis>`
  }

  if (memoryContext) {
    prompt += `\n\n<personal_context>\n${MEMORY_SAFETY_NOTE}\n\n${memoryContext}\n</personal_context>`
  }

  return prompt
}
