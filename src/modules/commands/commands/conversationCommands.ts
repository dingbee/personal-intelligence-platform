import type { Command } from '@/modules/commands/types'

/**
 * UX-8 Phase 6/10 — "Open related conversation" / "Resume previous
 * conversation." Generated per-render from a specific resurfaced
 * conversation (see resurfacingEngine.ts), same dynamic-command pattern
 * as buildContinueReadingCommand/buildWorkspaceSwitchCommands: plain data
 * in, navigate-only execute, no new routing.
 */
export function buildResumeConversationCommand(conversation: { id: string; title: string }): Command {
  return {
    id: `conversation-resume-${conversation.id}`,
    title: `Resume "${conversation.title}"`,
    icon: '💬',
    category: 'ai',
    execute: (_context, actions) => actions.navigate(`/chat?conversationId=${conversation.id}`),
  }
}
