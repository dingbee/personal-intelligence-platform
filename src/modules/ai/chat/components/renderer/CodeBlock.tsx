export function CodeBlock({ language, content }: { language: string | null; content: string }) {
  return (
    <div className="overflow-hidden rounded-control border border-[var(--color-border)]">
      {language && (
        <div className="border-b border-[var(--color-border)] bg-[var(--surface-inset)] px-3 py-1 text-xs text-[var(--color-ink-muted)]">
          {language}
        </div>
      )}
      <pre className="overflow-x-auto bg-[var(--surface-inset)] p-3 text-xs">
        <code className="font-mono">{content}</code>
      </pre>
    </div>
  )
}
