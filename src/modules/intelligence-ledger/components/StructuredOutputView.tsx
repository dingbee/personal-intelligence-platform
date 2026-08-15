import { humanizeKey } from '@/modules/intelligence-ledger/recordDisplay'

const MAX_DEPTH = 3
const MAX_ARRAY_ITEMS = 8

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function RawJsonFallback({ value, label = 'View raw JSON' }: { value: unknown; label?: string }) {
  return (
    <details>
      <summary className="cursor-pointer text-xs text-[var(--color-accent)]">{label}</summary>
      <pre className="mt-1 max-h-64 overflow-auto rounded-control bg-[var(--surface-inset)] p-2 text-xs text-[var(--color-ink-muted)]">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  )
}

function ObjectView({ data, depth }: { data: Record<string, unknown>; depth: number }) {
  const entries = Object.entries(data)
  if (entries.length === 0) return <span className="text-sm text-[var(--color-ink-muted)]">—</span>

  return (
    <dl className="flex flex-col gap-2.5">
      {entries.map(([key, value]) => (
        <div key={key}>
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-muted)]">{humanizeKey(key)}</dt>
          <dd className="mt-0.5 text-sm text-[var(--color-ink)]">
            <ValueView value={value} depth={depth} />
          </dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * Every value shape a jsonb structured_output can hold, rendered as
 * legibly as a generic renderer can manage — humanized keys, inline
 * primitives, bulleted arrays, nested key/value blocks up to MAX_DEPTH —
 * falling back to a collapsed raw-JSON block only once a structure gets
 * too deep or too irregular to keep rendering meaningfully. Never a blind
 * top-level JSON dump (see the sprint brief's own §7 requirement).
 */
function ValueView({ value, depth }: { value: unknown; depth: number }) {
  if (value === null || value === undefined) return <span className="text-[var(--color-ink-muted)]">—</span>
  if (typeof value === 'boolean') return <span>{value ? 'Yes' : 'No'}</span>
  if (typeof value === 'number') return <span>{value}</span>
  if (typeof value === 'string') {
    if (value.trim() === '') return <span className="text-[var(--color-ink-muted)]">—</span>
    return <span className="whitespace-pre-wrap">{value}</span>
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-[var(--color-ink-muted)]">None</span>
    if (depth >= MAX_DEPTH) return <RawJsonFallback value={value} />

    const shown = value.slice(0, MAX_ARRAY_ITEMS)
    const allPrimitive = shown.every((item) => !isPlainObject(item) && !Array.isArray(item))

    return (
      <ul className="mt-1 flex flex-col gap-1.5">
        {shown.map((item, index) => (
          <li key={index} className={allPrimitive ? 'text-sm' : 'rounded-control border border-[var(--color-border)] bg-[var(--surface-inset)] p-2.5'}>
            <ValueView value={item} depth={depth + 1} />
          </li>
        ))}
        {value.length > MAX_ARRAY_ITEMS && (
          <li className="text-xs text-[var(--color-ink-muted)]">+{value.length - MAX_ARRAY_ITEMS} more</li>
        )}
      </ul>
    )
  }

  if (isPlainObject(value)) {
    if (depth >= MAX_DEPTH) return <RawJsonFallback value={value} />
    return <ObjectView data={value} depth={depth + 1} />
  }

  return <RawJsonFallback value={value} />
}

/** The renderer for a record's `structuredOutput` — see this file's own doc comment on ValueView. */
export function StructuredOutputView({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="flex flex-col gap-3">
      <ObjectView data={data} depth={0} />
      <RawJsonFallback value={data} label="View full raw JSON" />
    </div>
  )
}
