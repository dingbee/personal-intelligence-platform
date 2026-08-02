import type { Message } from '@/shared/types/database'
import { MarkdownRenderer } from '@/modules/ai/chat/components/renderer/MarkdownRenderer'
import { ArtifactPreviewCard } from '@/modules/ai/chat/components/ArtifactPreviewCard'
import type { ArtifactPreview } from '@/modules/workspace-actions/types'

export function MessageBubble({
  message,
  highlighted,
  onSave,
  saved,
  saving,
  artifactPreview,
}: {
  message: Pick<Message, 'role' | 'content' | 'context_chunk_ids'> & { id?: string }
  /** UX-13.11 Phase 2A — briefly true right after a Universal Search deep-link scrolls this message into view. */
  highlighted?: boolean
  /** AI Workspace Actions v1 — per-message "Save to Notes". Omitted entirely (streaming placeholder, no message.id yet) hides the control rather than rendering it disabled. */
  onSave?: () => void
  saved?: boolean
  saving?: boolean
  /**
   * UX-14.4.3 — when the caller has matched a just-generated
   * `ArtifactPreview` to this specific message (by id), a structured
   * `ArtifactPreviewCard` renders instead of the plain markdown body.
   * Presentation-only: this component does no detection of its own and
   * never persists anything — `message.content` (what actually gets
   * saved) is completely unaffected either way.
   */
  artifactPreview?: ArtifactPreview
}) {
  const isUser = message.role === 'user'

  return (
    <div id={message.id ? `message-${message.id}` : undefined} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={artifactPreview ? 'w-full max-w-2xl' : 'max-w-[70ch]'}>
        {artifactPreview ? (
          <ArtifactPreviewCard preview={artifactPreview} />
        ) : (
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
        )}
        <div className="mt-1 flex items-center justify-between gap-2 px-1">
          {!isUser && message.context_chunk_ids.length > 0 ? (
            <p className="text-xs text-[var(--color-ink-muted)]">
              Based on {message.context_chunk_ids.length} passage{message.context_chunk_ids.length === 1 ? '' : 's'} from
              your library
            </p>
          ) : (
            <span />
          )}
          {onSave && (
            <button
              type="button"
              onClick={onSave}
              disabled={saved || saving}
              className="text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-accent)] disabled:hover:text-[var(--color-ink-muted)]"
            >
              {saved ? 'Saved' : saving ? 'Saving…' : 'Save to Notes'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
