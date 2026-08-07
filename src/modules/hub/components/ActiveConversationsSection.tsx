import type { Conversation } from '@/shared/types/database'
import { RecentActivityList } from '@/modules/hub/components/RecentActivityList'

/** UX-13.7.3 — this workspace's most recently active conversations (already pinned-first, most-recent-first from listConversations); links straight into Chat with that conversation selected. UX-15.2: rendering delegated to the shared RecentActivityList. */
export function ActiveConversationsSection({ conversations }: { conversations: Conversation[] }) {
  return (
    <RecentActivityList
      items={conversations.map((conversation) => ({
        key: conversation.id,
        href: `/chat?conversationId=${conversation.id}`,
        title: conversation.title || 'Untitled conversation',
        updatedAt: conversation.updated_at,
        leading: (
          <>
            {conversation.is_pinned && <span aria-label="Pinned">📌</span>}
            {conversation.favorite && <span aria-label="Favorite" className="text-[var(--color-warning)]">★</span>}
          </>
        ),
      }))}
      emptyTitle="No conversations yet"
      emptyDescription="Chat with NOVA about this workspace's documents to see recent conversations here."
    />
  )
}
