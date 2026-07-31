import { Link } from 'react-router-dom'
import type { Conversation } from '@/shared/types/database'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { formatRelativeTime } from '@/shared/utils/formatRelativeTime'

/** UX-13.7.3 — this workspace's most recently active conversations (already pinned-first, most-recent-first from listConversations); links straight into Chat with that conversation selected. */
export function ActiveConversationsSection({ conversations }: { conversations: Conversation[] }) {
  if (conversations.length === 0) {
    return <EmptyState title="No conversations yet" description="Chat with NOVA about this workspace's documents to see recent conversations here." />
  }

  return (
    <ul className="flex flex-col gap-2">
      {conversations.map((conversation) => (
        <li key={conversation.id} className="flex items-baseline justify-between gap-4 text-sm">
          <Link
            to={`/chat?conversationId=${conversation.id}`}
            className="flex min-w-0 items-center gap-1 truncate text-[var(--color-ink)] hover:text-[var(--color-accent)]"
          >
            {conversation.is_pinned && <span aria-label="Pinned">📌</span>}
            {conversation.favorite && <span aria-label="Favorite" className="text-amber-500">★</span>}
            <span className="min-w-0 truncate">{conversation.title || 'Untitled conversation'}</span>
          </Link>
          <span className="shrink-0 text-xs text-[var(--color-ink-muted)]">{formatRelativeTime(conversation.updated_at)}</span>
        </li>
      ))}
    </ul>
  )
}
