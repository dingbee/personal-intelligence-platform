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
          { inline: [{ type: 'text', content: 'one' }], children: null },
          { inline: [{ type: 'text', content: 'two' }], children: null },
          { inline: [{ type: 'text', content: 'three' }], children: null },
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
        items: [
          { inline: [{ type: 'text', content: 'first' }], children: null },
          { inline: [{ type: 'text', content: 'second' }], children: null },
        ],
      },
    ])
  })

  it('parses a nested unordered list as a child of the preceding item', () => {
    const blocks = parseMarkdownBlocks('- one\n  - one-a\n  - one-b\n- two')
    expect(blocks).toEqual([
      {
        type: 'list',
        ordered: false,
        items: [
          {
            inline: [{ type: 'text', content: 'one' }],
            children: {
              ordered: false,
              items: [
                { inline: [{ type: 'text', content: 'one-a' }], children: null },
                { inline: [{ type: 'text', content: 'one-b' }], children: null },
              ],
            },
          },
          { inline: [{ type: 'text', content: 'two' }], children: null },
        ],
      },
    ])
  })

  it('parses a nested ordered list as a child of the preceding item', () => {
    const blocks = parseMarkdownBlocks('1. first\n   1. first-a\n   2. first-b\n2. second')
    expect(blocks).toEqual([
      {
        type: 'list',
        ordered: true,
        items: [
          {
            inline: [{ type: 'text', content: 'first' }],
            children: {
              ordered: true,
              items: [
                { inline: [{ type: 'text', content: 'first-a' }], children: null },
                { inline: [{ type: 'text', content: 'first-b' }], children: null },
              ],
            },
          },
          { inline: [{ type: 'text', content: 'second' }], children: null },
        ],
      },
    ])
  })

  it('parses a nested ordered sub-list under an unordered parent item', () => {
    const blocks = parseMarkdownBlocks('- item\n  1. sub one\n  2. sub two')
    expect(blocks).toEqual([
      {
        type: 'list',
        ordered: false,
        items: [
          {
            inline: [{ type: 'text', content: 'item' }],
            children: {
              ordered: true,
              items: [
                { inline: [{ type: 'text', content: 'sub one' }], children: null },
                { inline: [{ type: 'text', content: 'sub two' }], children: null },
              ],
            },
          },
        ],
      },
    ])
  })

  it('parses three levels of nesting', () => {
    const blocks = parseMarkdownBlocks('- level1\n  - level2\n    - level3')
    expect(blocks).toEqual([
      {
        type: 'list',
        ordered: false,
        items: [
          {
            inline: [{ type: 'text', content: 'level1' }],
            children: {
              ordered: false,
              items: [
                {
                  inline: [{ type: 'text', content: 'level2' }],
                  children: {
                    ordered: false,
                    items: [{ inline: [{ type: 'text', content: 'level3' }], children: null }],
                  },
                },
              ],
            },
          },
        ],
      },
    ])
  })

  it('ends the current list when the marker type changes at the same depth, producing two sibling list blocks', () => {
    const blocks = parseMarkdownBlocks('- bullet one\n1. ordered one')
    expect(blocks).toEqual([
      { type: 'list', ordered: false, items: [{ inline: [{ type: 'text', content: 'bullet one' }], children: null }] },
      { type: 'list', ordered: true, items: [{ inline: [{ type: 'text', content: 'ordered one' }], children: null }] },
    ])
  })

  it('never throws while a nested list is streaming in incrementally, one character at a time', () => {
    const full = '- one\n  - two\n  - three\n- four'
    for (let end = 1; end <= full.length; end++) {
      expect(() => parseMarkdownBlocks(full.slice(0, end))).not.toThrow()
    }
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
