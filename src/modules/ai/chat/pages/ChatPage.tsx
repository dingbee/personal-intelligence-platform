import { EmptyState } from '@/shared/components/ui/EmptyState'

export function ChatPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-ink)]">Chat</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Ask questions grounded in your own content via RAG.
        </p>
      </div>
      <EmptyState
        title="Chat isn't available yet"
        description="AI chat, orchestration, and provider integrations (OpenAI, Anthropic, Gemini) are built in a later milestone."
      />
    </div>
  )
}
