import type { WorkspaceAction } from '@/modules/workspace-actions/types'
import { parseExecutiveBriefingCommand } from '@/modules/knowledge-intelligence/api/executiveBriefingCommand'
import { runExecutiveBriefingCommand } from '@/modules/knowledge-intelligence/api/runExecutiveBriefingCommand'

/**
 * AI Workspace Actions v1 — the Natural Language Knowledge Commands v1
 * "Create an executive briefing on X" command, migrated from its original
 * one-off `if` branch in AIService.sendMessage into the shared Workspace
 * Action Router as that router's first registered action (Save to Notes
 * is the second) — one interception mechanism, not one per command.
 */
export const generateBriefingAction: WorkspaceAction<{ topic: string }> = {
  id: 'generate-briefing',
  match: (text) => parseExecutiveBriefingCommand(text) ?? undefined,
  run: async ({ topic }, context) => {
    const result = await runExecutiveBriefingCommand({
      topic,
      userId: context.userId,
      workspaceId: context.workspaceId,
      chain: context.chain,
    })
    return {
      responseText: result.responseText,
      references: result.found ? [{ type: 'note', id: result.note.id, title: result.note.title }] : undefined,
    }
  },
}
