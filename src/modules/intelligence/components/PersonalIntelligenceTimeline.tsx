import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { listConversations } from '@/modules/ai/chat/api/conversations'
import { listNotes } from '@/modules/notes/api/notes'
import { getMostRecentReadingProgress } from '@/modules/reader/api/readingProgress'
import { useKnowledgeInsights } from '@/modules/knowledge-intelligence/hooks/useKnowledgeIntelligence'
import { formatRelativeTime } from '@/shared/utils/formatRelativeTime'

const RECENT_LIMIT = 3

/**
 * UX-7 Phase 9 — composed entirely from existing APIs/hooks
 * (listConversations, listNotes, getMostRecentReadingProgress,
 * useKnowledgeInsights). No new storage, no new queries beyond what those
 * already run elsewhere in the app.
 */
export function PersonalIntelligenceTimeline({ workspaceId }: { workspaceId: string | null }) {
  const { data: conversations = [] } = useQuery({
    queryKey: ['conversations', workspaceId],
    queryFn: () => listConversations({ workspaceId }),
  })
  const { data: notes = [] } = useQuery({
    queryKey: ['recent-notes', workspaceId],
    queryFn: () => listNotes({ workspaceId, limit: RECENT_LIMIT }),
  })
  const { data: inProgressDocument } = useQuery({
    queryKey: ['most-recent-reading-progress'],
    queryFn: getMostRecentReadingProgress,
  })
  const { data: insights } = useKnowledgeInsights()

  const recentConversations = conversations.slice(0, RECENT_LIMIT)
  const hasKnowledgeEvolution = Boolean(insights && insights.edgeCount > 0)
  const hasAnything = recentConversations.length > 0 || notes.length > 0 || Boolean(inProgressDocument) || hasKnowledgeEvolution

  if (!hasAnything) return null

  return (
    <div className="flex flex-col gap-3 text-xs text-[var(--color-ink-muted)]">
      {recentConversations.length > 0 && (
        <div>
          <p className="font-medium text-[var(--color-ink)]">Related conversations</p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {recentConversations.map((conversation) => (
              <li key={conversation.id}>
                <Link to={`/chat?conversationId=${conversation.id}`} className="hover:text-[var(--color-ink)] hover:underline">
                  {conversation.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {notes.length > 0 && (
        <div>
          <p className="font-medium text-[var(--color-ink)]">Related notes</p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {notes.map((note) => (
              <li key={note.id}>
                <Link to={`/notes/${note.id}`} className="hover:text-[var(--color-ink)] hover:underline">
                  {note.title || 'Untitled note'}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {inProgressDocument && (
        <div>
          <p className="font-medium text-[var(--color-ink)]">Recent reading</p>
          <Link to={`/library/${inProgressDocument.id}/read`} className="hover:text-[var(--color-ink)] hover:underline">
            {inProgressDocument.title} · {formatRelativeTime(inProgressDocument.updatedAt)}
          </Link>
        </div>
      )}

      {hasKnowledgeEvolution && insights && (
        <div>
          <p className="font-medium text-[var(--color-ink)]">Knowledge evolution</p>
          <Link to="/knowledge/explorer" className="hover:text-[var(--color-ink)] hover:underline">
            {insights.conceptCount} concepts · {insights.entityCount} entities · {insights.edgeCount} relationships
          </Link>
        </div>
      )}
    </div>
  )
}
