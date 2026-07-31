import type { Message } from '@/shared/types/database'
import { MarkdownRenderer } from '@/modules/ai/chat/components/renderer/MarkdownRenderer'

export function MessageBubble({
  message,
  highlighted,
}: {
  message: Pick<Message, 'role' | 'content' | 'context_chunk_ids'> & { id?: string }
  /** UX-13.11 Phase 2A — briefly true right after a Universal Search deep-link scrolls this message into view. */
  highlighted?: boolean
}) {
  const isUser = message.role === 'user'

  return (
    <div id={message.id ? `message-${message.id}` : undefined} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[70ch]">
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed transition-shadow duration-700 ${
            isUser
              ? 'bg-[var(--color-accent)] text-white'
              : 'bg-[var(--color-surface)] text-[var(--color-ink)] border border-[var(--color-border)]'
          } ${highlighted ? 'ring-2 ring-offset-2 ring-[var(--color-accent)] ring-offset-[var(--color-canvas)]' : ''}`}
        >
          {/* UX-13.5C — a user's own typed message is never markdown-rendered: it's shown exactly as typed, so a literal "*" or "#" never surprises them by turning into formatting. Only assistant responses (which the AI may format with real markdown) go through MarkdownRenderer. */}
          {isUser ? <div className="whitespace-pre-wrap">{message.content}</div> : <MarkdownRenderer content={message.content} />}
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
