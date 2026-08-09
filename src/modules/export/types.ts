/**
 * UX-14.5.11 — Knowledge Export & Download Experience.
 *
 * `ExportContent` is the normalized, format-agnostic shape every object
 * type's own "content adapter" (`content/*.ts`) produces from data it has
 * already loaded — never a fresh fetch, never a raw database row. It is
 * an **allow-list by construction**: only plain strings can ever appear
 * here (`title`, `subtitle`, section headings, section body lines), so
 * there is no field this shape could carry an internal id, an embedding
 * vector, `ai_memory`, provider configuration, or an audit timestamp in —
 * the same "the type doesn't have a slot for it" invariant every
 * Knowledge Exchange package type's own allow-list already relies on.
 * `assertNoSensitiveContent` (below) is a defense-in-depth runtime check
 * on top of that structural guarantee, not a replacement for it.
 *
 * This type is deliberately *not* a Knowledge Exchange package — it feeds
 * the three human-readable format exporters (`exporters/*.ts`) only.
 * The NOVA Package format bypasses it entirely and calls straight through
 * to that object type's own existing, unmodified `export<Type>Package`
 * function (see `exportService.ts`) — this module never re-derives or
 * duplicates what the Knowledge Exchange package framework already does.
 */
export interface ExportSection {
  /** Omitted for a section with no heading of its own (e.g. a Note's body). */
  heading?: string
  /** Plain text lines — one entry per paragraph or per list item, depending on `format`. */
  body: string[]
  /** 'paragraphs' (the default) renders each entry as its own prose paragraph; 'list' renders each entry as a bullet. */
  format?: 'paragraphs' | 'list'
}

export interface ExportContent {
  title: string
  /** e.g. "Concept · Knowledge Confidence: 82%" or a tag summary — rendered as italic/secondary text under the title. */
  subtitle?: string
  sections: ExportSection[]
}

export type ExportFormat = 'nova' | 'pdf' | 'markdown' | 'docx'

export interface ExportFormatOption {
  format: ExportFormat
  label: string
  description: string
  extension: string
}

/**
 * The four Save As choices, in the order the discovery's own mockup
 * lists them — NOVA Package first (the lossless default), then the three
 * human-readable convenience formats.
 */
export const EXPORT_FORMAT_OPTIONS: readonly ExportFormatOption[] = [
  { format: 'nova', label: 'ARRIYIA Package', description: 'Full backup and transfer', extension: 'nova' },
  { format: 'pdf', label: 'PDF', description: 'Readable document', extension: 'pdf' },
  { format: 'markdown', label: 'Markdown', description: 'Editable text', extension: 'md' },
  { format: 'docx', label: 'Word', description: 'Editable document', extension: 'docx' },
]

/** Filesystem-safe, lowercase-hyphenated filename — the same slugify pattern every Knowledge Exchange package type's own filename helper already established, factored once here since every format in this module needs it (markdown/pdf/docx via `exportFilename`; NOVA Package call sites use it directly for their own `.nova` name). */
export function exportFilename(title: string, extension: string): string {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug || 'export'}.${extension}`
}

/**
 * Defense-in-depth: scans the serialized content for a small deny-list of
 * substrings this app treats as sensitive anywhere they appear, and
 * refuses to export if one is found. `ExportContent`'s own shape already
 * makes this structurally unreachable in practice (§ doc-comment above),
 * so this exists to catch a future content-adapter bug loudly, at export
 * time, rather than silently shipping a leaked field in a downloaded file.
 */
const FORBIDDEN_CONTENT_SUBSTRINGS = [
  'user_id',
  'workspace_id',
  'ai_memory',
  'provider_override',
  'embedding',
  'access_token',
  'refresh_token',
]

export function assertNoSensitiveContent(content: ExportContent): void {
  const haystack = JSON.stringify(content).toLowerCase()
  for (const term of FORBIDDEN_CONTENT_SUBSTRINGS) {
    if (haystack.includes(term)) {
      throw new Error(`Export content unexpectedly references "${term}" — refusing to export.`)
    }
  }
}
