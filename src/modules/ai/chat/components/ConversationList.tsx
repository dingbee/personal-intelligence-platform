import type { Conversation } from '@/shared/types/database'
import { Button } from '@/shared/components/ui/Button'

export interface ConversationListProps {
  conversations: Conversation[]
  selectedId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
}

/**
 * The actual list content — no chrome of its own, so it can be reused by
 * the persistent desktop panel below and MobileConversationDrawer without
 * duplicating this markup. Same split as Sidebar/SidebarNav.
 */
export function ConversationListContent({ conversations, selectedId, onSelect, onNew, onDelete }: ConversationListProps) {
  return (
    <>
      <div className="p-3">
        <Button onClick={onNew} className="w-full">
          New chat
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {conversations.map((conversation) => (
          <div
            key={conversation.id}
            className={`group flex items-center rounded-lg pr-1 text-sm ${
              conversation.id === selectedId
                ? 'bg-[var(--color-canvas)] text-[var(--color-ink)]'
                : 'text-[var(--color-ink-muted)] hover:bg-[var(--color-canvas)] hover:text-[var(--color-ink)]'
            }`}
          >
            <button type="button" onClick={() => onSelect(conversation.id)} className="flex-1 truncate px-3 py-2 text-left">
              {conversation.title}
            </button>
            <button
              type="button"
              aria-label="Delete conversation"
              onClick={() => onDelete(conversation.id)}
              className="opacity-0 group-hover:opacity-100 hover:text-red-600"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </>
  )
}

/** Persistent on desktop only (md:flex) — below md, MobileConversationDrawer is how a conversation gets picked/created/deleted instead. */
export function ConversationList(props: ConversationListProps) {
  return (
    <div className="hidden h-full w-64 shrink-0 flex-col border-r border-[var(--color-border)] md:flex">
      <ConversationListContent {...props} />
    </div>
  )
}
