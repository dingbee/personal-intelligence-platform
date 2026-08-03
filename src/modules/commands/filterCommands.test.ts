import { describe, expect, it } from 'vitest'
import { filterCommands } from '@/modules/commands/filterCommands'
import type { Command, CommandContext } from '@/modules/commands/types'

function makeContext(overrides: Partial<CommandContext> = {}): CommandContext {
  return {
    userId: 'user-1',
    workspaceId: null,
    workspaceName: null,
    pathname: '/library',
    documentId: null,
    inProgressDocument: null,
    ...overrides,
  }
}

function makeCommand(overrides: Partial<Command> = {}): Command {
  return {
    id: 'test-command',
    title: 'Test command',
    icon: '🔧',
    category: 'navigation',
    execute: () => {},
    ...overrides,
  }
}

describe('filterCommands', () => {
  it('returns only featured commands when the query is empty', () => {
    const commands = [
      makeCommand({ id: 'a', title: 'Featured one', featured: true }),
      makeCommand({ id: 'b', title: 'Not featured' }),
      makeCommand({ id: 'c', title: 'Featured two', featured: true }),
    ]
    const result = filterCommands({ commands, query: '', context: makeContext() })
    expect(result.map((c) => c.id)).toEqual(['a', 'c'])
  })

  it('treats whitespace-only query the same as empty', () => {
    const commands = [makeCommand({ id: 'a', featured: true }), makeCommand({ id: 'b' })]
    const result = filterCommands({ commands, query: '   ', context: makeContext() })
    expect(result.map((c) => c.id)).toEqual(['a'])
  })

  it('ranks a title-starts-with match above a title-includes match', () => {
    const commands = [
      makeCommand({ id: 'contains', title: 'Open my library' }),
      makeCommand({ id: 'startswith', title: 'Library settings' }),
    ]
    const result = filterCommands({ commands, query: 'library', context: makeContext() })
    expect(result.map((c) => c.id)).toEqual(['startswith', 'contains'])
  })

  it('ranks a description match below any title match', () => {
    const commands = [
      makeCommand({ id: 'desc-match', title: 'Unrelated', description: 'about the knowledge graph' }),
      makeCommand({ id: 'title-match', title: 'Knowledge graph' }),
    ]
    const result = filterCommands({ commands, query: 'knowledge', context: makeContext() })
    expect(result.map((c) => c.id)).toEqual(['title-match', 'desc-match'])
  })

  it('excludes commands that do not match the query at all', () => {
    const commands = [makeCommand({ id: 'match', title: 'Search library' }), makeCommand({ id: 'no-match', title: 'Settings' })]
    const result = filterCommands({ commands, query: 'search', context: makeContext() })
    expect(result.map((c) => c.id)).toEqual(['match'])
  })

  it('excludes a command whose isAvailable returns false for the current context, even when featured', () => {
    const commands = [
      makeCommand({ id: 'available', featured: true, isAvailable: () => true }),
      makeCommand({ id: 'unavailable', featured: true, isAvailable: () => false }),
    ]
    const result = filterCommands({ commands, query: '', context: makeContext() })
    expect(result.map((c) => c.id)).toEqual(['available'])
  })

  it('evaluates isAvailable against the given context (context-dependent permission)', () => {
    const continueReading = makeCommand({
      id: 'continue-reading',
      featured: true,
      isAvailable: (context) => context.inProgressDocument !== null,
    })
    const withoutBook = filterCommands({ commands: [continueReading], query: '', context: makeContext() })
    expect(withoutBook).toEqual([])

    const withBook = filterCommands({
      commands: [continueReading],
      query: '',
      context: makeContext({ inProgressDocument: { id: 'doc-1', title: 'Atomic Habits', updatedAt: '2024-01-01T00:00:00Z' } }),
    })
    expect(withBook.map((c) => c.id)).toEqual(['continue-reading'])
  })
})
