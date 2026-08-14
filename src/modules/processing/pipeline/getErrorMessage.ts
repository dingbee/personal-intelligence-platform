/**
 * Processing failure observability fix (docs/excel-processing-failure-
 * diagnostic.md) — the diagnostic confirmed processDocument.ts's catch
 * handler was collapsing every non-`Error`-instance thrown value to a
 * generic "Processing failed" string, even though the pinned Supabase SDK
 * versions' error classes (PostgrestError, StorageError, FunctionsError)
 * all extend `Error`. Something in this pipeline is still throwing (or
 * rejecting with) a value that fails `instanceof Error` — this helper
 * stops assuming the shape of what was thrown and instead extracts a
 * useful message from whatever it actually is, so the next production
 * failure is self-diagnosing instead of generic.
 *
 * Deliberately duck-typed rather than instanceof-gated throughout: an
 * Error-like object, a PostgREST-style `{message, code, details, hint}`
 * object, a nested `{error: {...}}` wrapper, or a plain string are all
 * handled the same way regardless of prototype chain — the exact gap the
 * diagnostic identified.
 */

const SENSITIVE_PATTERN =
  /(bearer\s+[a-z0-9._-]{8,})|((?:api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|authorization)\s*[:=]\s*["']?[^\s"',;]{4,})|(eyJ[a-z0-9_-]{10,}\.[a-z0-9_-]{10,}\.[a-z0-9_-]{10,})|([?&](?:token|signature|sig|x-amz-signature|x-amz-credential)=[^&\s]+)/gi

/** Redacts anything that looks like a credential/token/secret before it can reach a user-visible field. Never a substitute for not persisting secrets in error text in the first place — a defense-in-depth pass over whatever a thrown value happens to contain. */
function redactSecrets(text: string): string {
  return text.replace(SENSITIVE_PATTERN, '[redacted]')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** A non-empty, trimmed string, or null — never returns `''`/whitespace-only so callers can safely treat a truthy result as real content. */
function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * Pulls `message` off a value, following one level of `{error: {...}}`
 * nesting (the shape some SDKs/fetch wrappers use) since a caller that
 * only checked `.message` directly would otherwise see nothing useful.
 */
function readMessage(value: Record<string, unknown>): string | null {
  const direct = readString(value.message)
  if (direct) return direct
  if (isRecord(value.error)) {
    const nested = readString(value.error.message)
    if (nested) return nested
  }
  return readString(value.error)
}

/** PostgREST-style diagnostic fields — code/details/hint carry real, actionable information (see PostgrestError's own doc comment: "hint is usually the single most useful field") that `.message` alone often omits. */
function readDiagnosticFields(value: Record<string, unknown>): string[] {
  const code = readString(value.code)
  const details = readString(value.details)
  const hint = readString(value.hint)
  const parts: string[] = []
  if (code) parts.push(`(code: ${code})`)
  if (details) parts.push(`— ${details}`)
  if (hint) parts.push(`[hint: ${hint}]`)
  return parts
}

/**
 * Extracts a safe, useful diagnostic message from any thrown/caught value.
 * Never throws itself, never returns an empty string, and never dumps an
 * object's full serialization — only the specific fields known to carry
 * real diagnostic value (message, code, details, hint), each redacted for
 * anything credential-shaped before being returned.
 */
export function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    const trimmed = readString(error)
    return trimmed ? redactSecrets(trimmed) : 'Unknown processing error'
  }

  if (error instanceof Error) {
    const parts = [error.message, ...(isRecord(error) ? readDiagnosticFields(error) : [])].filter((p): p is string => Boolean(p))
    const combined = parts.join(' ').trim()
    return combined ? redactSecrets(combined) : 'Unknown processing error'
  }

  if (isRecord(error)) {
    const message = readMessage(error)
    const parts = [message, ...readDiagnosticFields(error)].filter((p): p is string => Boolean(p))
    const combined = parts.join(' ').trim()
    return combined ? redactSecrets(combined) : 'Unknown processing error'
  }

  return 'Unknown processing error'
}
