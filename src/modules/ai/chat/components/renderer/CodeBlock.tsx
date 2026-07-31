/** UX-13.6 Phase 1 — a language label bar (when present) sits on a slightly lighter tone than the code body itself, giving the block real visual structure instead of one flat gray rectangle; leading-relaxed makes multi-line snippets easier to scan line-by-line. */
export function CodeBlock({ language, content }: { language: string | null; content: string }) {
  return (
    <div className="overflow-hidden rounded-control border border-[var(--color-border)] shadow-inset">
      {language && (
        <div className="border-b border-[var(--color-border)] bg-[var(--surface-raised)] px-3 py-1 text-xs font-medium tracking-wide text-[var(--color-ink-muted)]">
          {language}
        </div>
      )}
      <pre className="overflow-x-auto bg-[var(--surface-inset)] p-3 text-xs leading-relaxed">
        <code className="font-mono">{content}</code>
      </pre>
    </div>
  )
}
