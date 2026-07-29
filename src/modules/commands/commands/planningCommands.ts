import type { Command } from '@/modules/commands/types'

/**
 * UX-12 Phase 11 — Planning Commands. Each one starts a conversation with
 * a planning-flavored opening question, reusing the exact same mechanism
 * askNovaCommand's per-query variant already uses (createConversationWithQuery)
 * — no new AI action, no separate execution path. Once sent, the message
 * flows through the ordinary chat pipeline, where the new Intent
 * Classifier (Phase 2) reliably resolves each of these to intent 'plan'
 * (see intentRules.ts's plan rule) and the Planner (Phase 3) takes it from
 * there — the commands themselves perform no planning.
 */
function buildPlanCommand(id: string, title: string, query: string): Command {
  return {
    id,
    title,
    description: 'Start a planning conversation with NOVA',
    icon: '🗺️',
    category: 'ai',
    execute: async (_context, actions) => {
      await actions.createConversationWithQuery(query)
    },
  }
}

export const planProjectCommand = buildPlanCommand('plan-project', 'Plan Project', 'Help me plan my project.')
export const planLearningCommand = buildPlanCommand('plan-learning', 'Plan Learning', 'Help me plan my learning.')
export const planResearchCommand = buildPlanCommand('plan-research', 'Plan Research', 'Help me plan my research.')
export const planReadingCommand = buildPlanCommand('plan-reading', 'Plan Reading', 'Help me plan my reading.')
export const planWritingCommand = buildPlanCommand('plan-writing', 'Plan Writing', 'Help me plan my writing.')
export const planMigrationCommand = buildPlanCommand('plan-migration', 'Plan Migration', 'Help me plan my migration.')
