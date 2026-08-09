import type { ReaderInteractionState } from '@/modules/reader/intelligence/readerInteraction'
import type { LocalSuggestionId } from '@/modules/reader/intelligence/chapterSuggestions'
import type { CommandActions, CommandContext } from '@/modules/commands/types'
import { InsightDrawerShell } from '@/modules/intelligence/components/InsightDrawerShell'
import { ReaderIntelligencePanel } from '@/modules/reader/components/ReaderIntelligencePanel'

const STORAGE_KEY = 'reader-insight-drawer-state'

/**
 * UX-13.10.2 — the Reader Chat equivalent of NovaInsightDrawer: same
 * InsightDrawerShell chrome (collapsed by default, minimize to a floating
 * pill, maximize to fullscreen, persisted preference), wrapping
 * ReaderIntelligencePanel's existing content unchanged. Previously
 * ReaderChatPanel mounted ReaderIntelligencePanel directly, always fully
 * expanded — competing for vertical space with the document/chat/input
 * the user is actually trying to use. One shared shell serves PDF,
 * spreadsheet, image, and any future reader mode, since ReaderChatPanel
 * itself is already the single chat surface all of them mount.
 */
export function ReaderInsightDrawer(props: {
  state: ReaderInteractionState
  workspaceId: string | null
  onLocalSuggestion: (id: LocalSuggestionId) => void
  commandContext: CommandContext
  commandActions: CommandActions
}) {
  return (
    <InsightDrawerShell storageKey={STORAGE_KEY} label="ARRIYIA Insights">
      <ReaderIntelligencePanel {...props} />
    </InsightDrawerShell>
  )
}
