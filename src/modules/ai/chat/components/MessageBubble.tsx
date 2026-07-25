import type { Message } from '@/shared/types/database'

export function MessageBubble({ message }: { message: Pick<Message, 'role' | 'content' | 'context_chunk_ids'> }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[70ch]">
        <div
          className={`whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? 'bg-[var(--color-accent)] text-white'
              : 'bg-[var(--color-surface)] text-[var(--color-ink)] border border-[var(--color-border)]'
          }`}
        >
          {message.content}
        </div>
        {!isUser && message.context_chunk_ids.length > 0 && (
          <p className="mt-1 px-1 text-xs text-[var(--color-ink-muted)]">
            Based on {message.context_chunk_ids.length} passage{message.context_chunk_ids.length === 1 ? '' : 's'} from
            your library
          </p>
        )}
      </div>
    </div>
  )
}
