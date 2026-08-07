import { useState, type FormEvent } from 'react'
import { useIntelligenceQuery } from '@/modules/knowledge-intelligence/hooks/useKnowledgeIntelligence'
import { Input } from '@/shared/components/ui/Input'
import { Button } from '@/shared/components/ui/Button'

const EXAMPLE_QUERIES = [
  'How has my thinking changed about this?',
  'What documents relate to this idea?',
  'What decisions have I made?',
  'What patterns do you see?',
]

/**
 * Knowledge Intelligence Layer v1, Feature 5 — "ask a question about your
 * own knowledge," scoped to the concept whose page this renders on. The
 * question only needs to say *what kind* of thing to answer (evolution,
 * sources, decisions, patterns, gaps) — runIntelligenceQuery classifies
 * that deterministically and dispatches to an existing composer.
 */
export function IntelligenceQueryBox({ nodeId }: { nodeId: string }) {
  const [text, setText] = useState('')
  const query = useIntelligenceQuery(nodeId)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (text.trim().length === 0) return
    query.mutate(text)
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--color-border)] p-4">
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <div className="flex-1">
          <Input
            label="Ask about this concept"
            placeholder="What patterns do you see?"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        <Button type="submit" variant="secondary" loading={query.isPending}>
          {query.isPending ? 'Thinking…' : 'Ask'}
        </Button>
      </form>

      <div className="flex flex-wrap gap-1.5">
        {EXAMPLE_QUERIES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => setText(example)}
            className="rounded-full bg-[var(--color-canvas)] px-2 py-0.5 text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
          >
            {example}
          </button>
        ))}
      </div>

      {query.isError && (
        <p className="text-sm text-[var(--color-danger)]">
          {query.error instanceof Error ? query.error.message : 'Failed to answer that question.'}
        </p>
      )}

      {query.isSuccess && (
        <div className="flex flex-col gap-1.5">
          <p className="text-sm text-[var(--color-ink)]">{query.data.summary}</p>
          {query.data.detail.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm text-[var(--color-ink-muted)]">
              {query.data.detail.map((line, index) => (
                <li key={index}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
