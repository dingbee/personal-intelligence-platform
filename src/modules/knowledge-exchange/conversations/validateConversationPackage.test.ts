import { describe, expect, it } from 'vitest'
import { parseConversationPackage, validateConversationPackage } from '@/modules/knowledge-exchange/conversations/validateConversationPackage'
import { CURRENT_PACKAGE_VERSION, PACKAGE_SOURCE_VERSION } from '@/modules/knowledge-exchange/packages/PackageVersion'
import type { ConversationPackage } from '@/modules/knowledge-exchange/conversations/conversationPackageTypes'

function fakePackage(overrides: Partial<ConversationPackage['conversation']> = {}): ConversationPackage {
  return {
    version: CURRENT_PACKAGE_VERSION,
    exportedAt: '2026-01-01T00:00:00.000Z',
    sourceVersion: PACKAGE_SOURCE_VERSION,
    conversation: {
      title: 'Summarizing the Q1 report',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      messages: [
        { role: 'user', content: 'Summarize this document', createdAt: '2026-01-01T00:00:01.000Z' },
        { role: 'assistant', content: 'Here is the summary...', createdAt: '2026-01-01T00:00:05.000Z' },
      ],
      ...overrides,
    },
  }
}

describe('validateConversationPackage', () => {
  it('accepts a well-formed package', () => {
    const result = validateConversationPackage(fakePackage())
    expect(result.valid).toBe(true)
    if (!result.valid) return
    expect(result.package.conversation.messages).toHaveLength(2)
  })

  it('rejects a package missing the "conversation" field', () => {
    const { conversation: _conversation, ...rest } = fakePackage() as ConversationPackage & Record<string, unknown>
    const result = validateConversationPackage(rest)
    expect(result.valid).toBe(false)
    if (result.valid) return
    expect(result.issues.some((i) => i.message.includes('"conversation"'))).toBe(true)
  })

  it('rejects a package missing "messages" entirely', () => {
    const pkg = fakePackage()
    const tampered = { ...pkg, conversation: { title: pkg.conversation.title, createdAt: pkg.conversation.createdAt, updatedAt: pkg.conversation.updatedAt } }
    const result = validateConversationPackage(tampered)
    expect(result.valid).toBe(false)
    if (result.valid) return
    expect(result.issues.some((i) => i.message.includes('messages'))).toBe(true)
  })

  it('rejects a package with an empty messages array', () => {
    const result = validateConversationPackage(fakePackage({ messages: [] }))
    expect(result.valid).toBe(false)
    if (result.valid) return
    expect(result.issues.some((i) => i.message.includes('at least one message'))).toBe(true)
  })

  it('rejects an invalid message role', () => {
    const result = validateConversationPackage(
      fakePackage({ messages: [{ role: 'system' as never, content: 'hidden prompt', createdAt: '2026-01-01T00:00:01.000Z' }] }),
    )
    expect(result.valid).toBe(false)
    if (result.valid) return
    expect(result.issues.some((i) => i.message.includes('invalid "role"'))).toBe(true)
  })

  it('rejects a message missing content', () => {
    const result = validateConversationPackage(
      fakePackage({ messages: [{ role: 'user', createdAt: '2026-01-01T00:00:01.000Z' } as never] }),
    )
    expect(result.valid).toBe(false)
    if (result.valid) return
    expect(result.issues.some((i) => i.message.includes('"content"'))).toBe(true)
  })

  it('collects every issue in one pass, not just the first', () => {
    const result = validateConversationPackage(
      fakePackage({
        title: '',
        messages: [
          { role: 'system' as never, content: 'bad role', createdAt: '2026-01-01T00:00:01.000Z' },
          { role: 'user', createdAt: '2026-01-01T00:00:01.000Z' } as never,
        ],
      }),
    )
    expect(result.valid).toBe(false)
    if (result.valid) return
    expect(result.issues.length).toBeGreaterThanOrEqual(3)
  })

  it('rejects an unsupported package version', () => {
    const result = validateConversationPackage({ ...fakePackage(), version: 999 })
    expect(result.valid).toBe(false)
    if (result.valid) return
    expect(result.issues[0]!.code).toBe('future_version')
  })

  it('rejects something that is not an object at all', () => {
    const result = validateConversationPackage('not a package')
    expect(result.valid).toBe(false)
  })
})

describe('parseConversationPackage', () => {
  it('rejects malformed (non-JSON) text distinctly from a schema issue', () => {
    const result = parseConversationPackage('{ not valid json')
    expect(result.valid).toBe(false)
    if (result.valid) return
    expect(result.issues[0]!.code).toBe('malformed_json')
  })

  it('parses and validates well-formed JSON text', () => {
    const result = parseConversationPackage(JSON.stringify(fakePackage()))
    expect(result.valid).toBe(true)
  })
})
