import { describe, expect, it } from 'vitest'
import { parseInline, sanitizeHref } from '@/modules/ai/chat/components/renderer/parseInline'

describe('parseInline', () => {
  it('returns a single text token for plain text', () => {
    expect(parseInline('hello world')).toEqual([{ type: 'text', content: 'hello world' }])
  })

  it('parses bold with double asterisks', () => {
    expect(parseInline('**bold**')).toEqual([{ type: 'bold', content: 'bold' }])
  })

  it('parses bold with double underscores', () => {
    expect(parseInline('__bold__')).toEqual([{ type: 'bold', content: 'bold' }])
  })

  it('parses italic with single asterisks', () => {
    expect(parseInline('*italic*')).toEqual([{ type: 'italic', content: 'italic' }])
  })

  it('parses italic with single underscores', () => {
    expect(parseInline('_italic_')).toEqual([{ type: 'italic', content: 'italic' }])
  })

  it('parses inline code', () => {
    expect(parseInline('`code`')).toEqual([{ type: 'code', content: 'code' }])
  })

  it('parses a link', () => {
    expect(parseInline('[NOVA](https://example.com)')).toEqual([
      { type: 'link', content: 'NOVA', href: 'https://example.com' },
    ])
  })

  it('neutralizes an unsafe link scheme', () => {
    expect(parseInline('[click](javascript:alert(1))')[0]).toEqual({ type: 'link', content: 'click', href: '#' })
  })

  it('interleaves plain text and formatted tokens in order', () => {
    expect(parseInline('a **b** c')).toEqual([
      { type: 'text', content: 'a ' },
      { type: 'bold', content: 'b' },
      { type: 'text', content: ' c' },
    ])
  })

  it('prefers bold over italic when both markers could apply', () => {
    expect(parseInline('**bold** and *italic*')).toEqual([
      { type: 'bold', content: 'bold' },
      { type: 'text', content: ' and ' },
      { type: 'italic', content: 'italic' },
    ])
  })

  it('returns an empty array for an empty string', () => {
    expect(parseInline('')).toEqual([])
  })
})

describe('sanitizeHref', () => {
  it('allows https links', () => {
    expect(sanitizeHref('https://example.com')).toBe('https://example.com')
  })

  it('allows http links', () => {
    expect(sanitizeHref('http://example.com')).toBe('http://example.com')
  })

  it('allows mailto links', () => {
    expect(sanitizeHref('mailto:a@b.com')).toBe('mailto:a@b.com')
  })

  it('allows relative links', () => {
    expect(sanitizeHref('/chat')).toBe('/chat')
  })

  it('allows hash links', () => {
    expect(sanitizeHref('#section')).toBe('#section')
  })

  it('neutralizes javascript: links', () => {
    expect(sanitizeHref('javascript:alert(1)')).toBe('#')
  })

  it('neutralizes data: links', () => {
    expect(sanitizeHref('data:text/html,<script>alert(1)</script>')).toBe('#')
  })
})
