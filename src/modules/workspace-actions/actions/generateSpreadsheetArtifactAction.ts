import type { WorkspaceAction } from '@/modules/workspace-actions/types'
import { parseGenerateSpreadsheetCommand } from '@/modules/workspace-actions/actions/generateSpreadsheetCommand'
import { runCapability } from '@/modules/ai/orchestration/runCapability'
import { runWithFallback } from '@/modules/ai/router/runWithFallback'
import { parseSpreadsheetSpecificationResponse } from '@/modules/ai/artifacts/spreadsheet/parseSpreadsheetSpecificationResponse'
import { validateSpreadsheetSpecification } from '@/modules/ai/artifacts/spreadsheet/validateSpreadsheetSpecification'
import { compileSpreadsheetSpecification } from '@/modules/ai/artifacts/spreadsheet/compileSpreadsheetSpecification'
import { validateFormulaSafety } from '@/modules/ai/artifacts/spreadsheet/validateFormulaSafety'
import { renderSpreadsheetArtifactMarkdown } from '@/modules/ai/artifacts/spreadsheet/renderSpreadsheetArtifactMarkdown'

const MAX_ERRORS_SHOWN = 3

/**
 * UX-14.4.2 — "create a spreadsheet for X". Follows the approved
 * discovery design exactly:
 *
 *   command -> generate-spreadsheet-artifact capability -> SpreadsheetSpecification
 *   -> validateSpreadsheetSpecification -> compileSpreadsheetSpecification
 *   -> validateFormulaSafety (every compiled formula cell)
 *   -> renderSpreadsheetArtifactMarkdown -> chat response
 *
 * Deliberately does NOT call createNote or anything else that persists
 * data — this action's only output is chat text. The response is an
 * unsaved preview, no different from any other assistant reply: the
 * existing Save-to-Notes flow (the "save this" command, or the per-message
 * Save button) is the only persistence gate, completely untouched by this
 * milestone. When a spreadsheet-shaped markdown table is later saved,
 * `detectArtifactKind` classifies it `'spreadsheet'` and
 * `buildArtifactGenerationMetadata` re-derives `SpreadsheetArtifactData`
 * from that same markdown via `parseMarkdownTableToArtifact` — the exact
 * mechanism that already exists for Path A, requiring no changes here.
 *
 * Every rejection path (malformed JSON, a structurally invalid spec, an
 * unsafe formula) fails closed: no partial spreadsheet is ever shown, and
 * nothing is sanitized-and-passed — matching the Path B architecture
 * discovery's explicit instruction for the formula-safety allowlist.
 */
export const generateSpreadsheetArtifactAction: WorkspaceAction<{ request: string }> = {
  id: 'generate-spreadsheet-artifact',
  match: (text) => parseGenerateSpreadsheetCommand(text) ?? undefined,
  run: async ({ request }, context) => {
    const { result } = await runWithFallback(context.chain, (candidateId) =>
      runCapability({
        capabilityId: 'generate-spreadsheet-artifact',
        variables: { request },
        userId: context.userId,
        workspaceId: context.workspaceId,
        providerId: candidateId,
        requestedProviderId: context.chain[0],
      }),
    )

    // P0-1 hardening — every return below this point happens after the
    // runWithFallback/runCapability call above already made one real,
    // server-metered AI request (the edge function gates and consumes
    // quota for it regardless of what this action does with the result,
    // including a validation/safety rejection of the model's own output).
    // `usedAiCall: true` on every branch tells AIService.sendMessage not
    // to also charge its generic per-turn 'ai_messages' unit for this
    // outcome — see WorkspaceActionOutcome's own doc comment.

    let spec
    try {
      spec = parseSpreadsheetSpecificationResponse(result.content)
    } catch {
      return {
        responseText: "I wasn't able to generate a valid spreadsheet for that — try rephrasing your request.",
        usedAiCall: true,
      }
    }

    const validation = validateSpreadsheetSpecification(spec)
    if (!validation.valid) {
      const reasons = validation.errors.slice(0, MAX_ERRORS_SHOWN).map((error) => error.message)
      return {
        responseText: `I couldn't build that spreadsheet — the generated structure had ${validation.errors.length === 1 ? 'an issue' : 'issues'}:\n${reasons.map((reason) => `- ${reason}`).join('\n')}\n\nTry rephrasing your request.`,
        usedAiCall: true,
      }
    }

    const compiled = compileSpreadsheetSpecification(spec)
    const formulaCells = compiled.sheets.flatMap((sheet) => sheet.cells.filter((cell) => cell.formula != null))
    for (const cell of formulaCells) {
      const safety = validateFormulaSafety(cell.formula!)
      if (!safety.safe) {
        return {
          responseText:
            "I couldn't build that spreadsheet — one of the generated formulas isn't allowed for safety reasons. " +
            'Try rephrasing your request, or ask for the figures without a formula.',
          usedAiCall: true,
        }
      }
    }

    const markdown = renderSpreadsheetArtifactMarkdown(compiled)
    const title = spec.title || 'Spreadsheet'
    return {
      responseText: `Here's ${title}:\n\n${markdown}\n\nThis hasn't been saved yet — say "save this" if you'd like to keep it.`,
      // UX-14.4.3 — additive alongside responseText, never a replacement
      // for it: the same markdown that's embedded in responseText (which
      // the Save-to-Notes pipeline depends on staying intact) is also
      // handed to the chat UI as structured content, so it can render a
      // KnowledgeCard-based preview instead of the plain markdown table
      // for this one message.
      artifactPreview: { kind: 'spreadsheet', title, content: markdown },
      usedAiCall: true,
    }
  },
}
