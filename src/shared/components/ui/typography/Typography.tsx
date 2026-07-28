import type { ElementType, HTMLAttributes } from 'react'

/**
 * The typography hierarchy (Phase UX-3.5): app title, page title, section
 * title, body, metadata, AI/system text. Font sizing isn't a Tailwind
 * design-token namespace the way colors/shadows/radius are, so this is a
 * component rather than a CSS variable — one small set of presets new
 * surfaces pick from instead of ad hoc `text-2xl font-semibold` repeated
 * per page.
 */
export type TypographyVariant = 'app-title' | 'page-title' | 'section-title' | 'body' | 'metadata' | 'ai-text'

const VARIANT_CLASSES: Record<TypographyVariant, string> = {
  'app-title': 'text-base font-semibold tracking-tight text-[var(--color-ink)]',
  'page-title': 'text-2xl font-semibold text-[var(--color-ink)]',
  'section-title': 'text-sm font-medium text-[var(--color-ink)]',
  body: 'text-sm text-[var(--color-ink)]',
  metadata: 'text-xs text-[var(--color-ink-muted)]',
  'ai-text': 'text-sm text-[var(--color-accent)]',
}

const VARIANT_TAG: Record<TypographyVariant, ElementType> = {
  'app-title': 'span',
  'page-title': 'h1',
  'section-title': 'h2',
  body: 'p',
  metadata: 'p',
  'ai-text': 'p',
}

export function Typography({
  variant,
  className = '',
  children,
  ...props
}: { variant: TypographyVariant } & HTMLAttributes<HTMLElement>) {
  const Tag = VARIANT_TAG[variant]
  return (
    <Tag className={`${VARIANT_CLASSES[variant]} ${className}`} {...props}>
      {children}
    </Tag>
  )
}
