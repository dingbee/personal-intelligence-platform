export type InlineToken =
  | { type: 'text'; content: string }
  | { type: 'bold'; content: string }
  | { type: 'italic'; content: string }
  | { type: 'code'; content: string }
  | { type: 'link'; content: string; href: string }

// mailto:/relative/hash links pass through as-is; anything else (javascript:,
// data:, vbscript:, ...) is neutralized to a harmless "#" — the one place a
// URL from AI-generated text could otherwise reach a real browser navigation.
const SAFE_HREF_PATTERN = /^(https?:|mailto:|\/|#)/i

export function sanitizeHref(href: string): string {
  return SAFE_HREF_PATTERN.test(href) ? href : '#'
}

// Alternation order matters: at a given position the regex engine tries
// branches left-to-right, so inline code and links are checked before
// bold, and bold (**/__) before italic (*/_) — the same precedence any
// markdown parser needs so "**bold**" is never misread as two italics.
const INLINE_PATTERN =
  /`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_/g

/**
 * UX-13.5C — a small, dependency-free inline-markdown tokenizer: code,
 * links, bold, italic. Not a CommonMark implementation (no nesting, no
 * escaping edge cases) — deliberately just enough to stop `**`/`_`/`` ` ``
 * from leaking into the UI as literal characters, per the phase brief.
 */
export function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = []
  let lastIndex = 0
  INLINE_PATTERN.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = INLINE_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) tokens.push({ type: 'text', content: text.slice(lastIndex, match.index) })
    const [, code, linkText, linkHref, boldStar, boldUnderscore, italicStar, italicUnderscore] = match
    if (code !== undefined) tokens.push({ type: 'code', content: code })
    else if (linkText !== undefined) tokens.push({ type: 'link', content: linkText, href: sanitizeHref(linkHref!) })
    else if (boldStar !== undefined) tokens.push({ type: 'bold', content: boldStar })
    else if (boldUnderscore !== undefined) tokens.push({ type: 'bold', content: boldUnderscore })
    else if (italicStar !== undefined) tokens.push({ type: 'italic', content: italicStar })
    else if (italicUnderscore !== undefined) tokens.push({ type: 'italic', content: italicUnderscore })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) tokens.push({ type: 'text', content: text.slice(lastIndex) })
  return tokens
}
