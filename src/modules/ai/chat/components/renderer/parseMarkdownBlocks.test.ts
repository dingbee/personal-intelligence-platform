import { describe, expect, it } from 'vitest'
import { parseMarkdownBlocks } from '@/modules/ai/chat/components/renderer/parseMarkdownBlocks'

describe('parseMarkdownBlocks', () => {
  it('parses a plain paragraph', () => {
    const blocks = parseMarkdownBlocks('Hello world')
    expect(blocks).toEqual([{ type: 'paragraph', inline: [{ type: 'text', content: 'Hello world' }] }])
  })

  it('parses a heading', () => {
    const blocks = parseMarkdownBlocks('### Core idea')
    expect(blocks).toEqual([{ type: 'heading', level: 3, inline: [{ type: 'text', content: 'Core idea' }] }])
  })

  it('parses headings of every level', () => {
    for (let level = 1; level <= 6; level++) {
      const blocks = parseMarkdownBlocks(`${'#'.repeat(level)} Title`)
      expect(blocks[0]).toMatchObject({ type: 'heading', level })
    }
  })

  it('parses an unordered list', () => {
    const blocks = parseMarkdownBlocks('- one\n- two\n- three')
    expect(blocks).toEqual([
      {
        type: 'list',
        ordered: false,
        items: [
          [{ type: 'text', content: 'one' }],
          [{ type: 'text', content: 'two' }],
          [{ type: 'text', content: 'three' }],
        ],
      },
    ])
  })

  it('parses an ordered list', () => {
    const blocks = parseMarkdownBlocks('1. first\n2. second')
    expect(blocks).toEqual([
      {
        type: 'list',
        ordered: true,
        items: [[{ type: 'text', content: 'first' }], [{ type: 'text', content: 'second' }]],
      },
    ])
  })

  it('parses a blockquote', () => {
    const blocks = parseMarkdownBlocks('> a wise quote')
    expect(blocks).toEqual([{ type: 'quote', inline: [{ type: 'text', content: 'a wise quote' }] }])
  })

  it('joins multi-line blockquotes into one block', () => {
    const blocks = parseMarkdownBlocks('> line one\n> line two')
    expect(blocks).toHaveLength(1)
    expect(blocks[0]!.type).toBe('quote')
  })

  it('parses a fenced code block with a language tag', () => {
    const blocks = parseMarkdownBlocks('```ts\nconst x = 1\n```')
    expect(blocks).toEqual([{ type: 'code', language: 'ts', content: 'const x = 1' }])
  })

  it('parses a fenced code block with no language tag', () => {
    const blocks = parseMarkdownBlocks('```\nplain\n```')
    expect(blocks).toEqual([{ type: 'code', language: null, content: 'plain' }])
  })

  it('does not apply inline parsing inside a code block', () => {
    const blocks = parseMarkdownBlocks('```\n**not bold**\n```')
    expect(blocks).toEqual([{ type: 'code', language: null, content: '**not bold**' }])
  })

  it('parses a GFM-style table', () => {
    const blocks = parseMarkdownBlocks('| A | B |\n| - | - |\n| 1 | 2 |')
    expect(blocks).toEqual([
      {
        type: 'table',
        headers: [[{ type: 'text', content: 'A' }], [{ type: 'text', content: 'B' }]],
        rows: [[[{ type: 'text', content: '1' }], [{ type: 'text', content: '2' }]]],
      },
    ])
  })

  it('parses multiple blocks in sequence', () => {
    const blocks = parseMarkdownBlocks('### Title\n\nSome text.\n\n- item one\n- item two')
    expect(blocks.map((b) => b.type)).toEqual(['heading', 'paragraph', 'list'])
  })

  it('parses bold/italic within a paragraph via inline tokens', () => {
    const blocks = parseMarkdownBlocks('This is **important**.')
    expect(blocks[0]).toEqual({
      type: 'paragraph',
      inline: [{ type: 'text', content: 'This is ' }, { type: 'bold', content: 'important' }, { type: 'text', content: '.' }],
    })
  })

  it('returns an empty array for empty content', () => {
    expect(parseMarkdownBlocks('')).toEqual([])
  })

  it('returns an empty array for whitespace-only content', () => {
    expect(parseMarkdownBlocks('   \n  \n')).toEqual([])
  })

  it('never throws on malformed/unterminated fences', () => {
    expect(() => parseMarkdownBlocks('```ts\nconst x = 1')).not.toThrow()
  })
})
