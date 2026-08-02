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

    let spec
    try {
      spec = parseSpreadsheetSpecificationResponse(result.content)
    } catch {
      return {
        responseText: "I wasn't able to generate a valid spreadsheet for that — try rephrasing your request.",
      }
    }

    const validation = validateSpreadsheetSpecification(spec)
    if (!validation.valid) {
      const reasons = validation.errors.slice(0, MAX_ERRORS_SHOWN).map((error) => error.message)
      return {
        responseText: `I couldn't build that spreadsheet — the generated structure had ${validation.errors.length === 1 ? 'an issue' : 'issues'}:\n${reasons.map((reason) => `- ${reason}`).join('\n')}\n\nTry rephrasing your request.`,
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
        }
      }
    }

    const markdown = renderSpreadsheetArtifactMarkdown(compiled)
    return {
      responseText: `Here's ${spec.title || 'the spreadsheet'}:\n\n${markdown}\n\nThis hasn't been saved yet — say "save this" if you'd like to keep it.`,
    }
  },
}
