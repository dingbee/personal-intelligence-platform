import { beforeAll, describe, expect, it } from 'vitest'
import { promptRegistry } from '@/modules/core/prompts/registry'
import { buildSystemPrompt } from '@/modules/ai/orchestration/buildSystemPrompt'
import type { VectorMatch } from '@/modules/ai/retrieval/VectorStore'

// Registered once for this file — Vitest isolates module state per test
// file by default, so this can't collide with coreModule's real
// rag-chat@1.0 registration (or any other test file's) even though
// promptRegistry is a module-level singleton.
beforeAll(() => {
  promptRegistry.register({
    id: 'test-chat@1.0',
    capabilityId: 'chat',
    version: '1.0',
    active: true,
    template: 'System instructions.\n\nContext:\n{{context}}',
  })
})

function makeMatch(content: string): VectorMatch {
  return { chunkId: 'chunk-1', documentId: 'doc-1', content, similarity: 0.9 }
}

describe('buildSystemPrompt', () => {
  it('renders only the base template when there are no matches and no extra context (old behavior unchanged)', () => {
    const result = buildSystemPrompt([])
    expect(result).toBe("System instructions.\n\nContext:\n(No relevant content found in the user's library.)")
  })

  it('renders retrieved chunks into the base template when there is no extra context (old behavior unchanged)', () => {
    const result = buildSystemPrompt([makeMatch('Revenue management basics.')])
    expect(result).toBe('System instructions.\n\nContext:\n[1] Revenue management basics.')
    expect(result).not.toContain('<knowledge_connections>')
    expect(result).not.toContain('<personal_context>')
  })

  it('appends a <knowledge_connections> block when graphContext is given, exactly as before this phase', () => {
    const result = buildSystemPrompt([], 'Concept: Relativity Theory')
    expect(result).toContain('<knowledge_connections>\nConcept: Relativity Theory\n</knowledge_connections>')
    expect(result).not.toContain('<personal_context>')
  })

  it('appends a <personal_context> block, including the safety note, when memoryContext is given', () => {
    const result = buildSystemPrompt([], null, '## Learned preferences\n- Likes concise answers')
    expect(result).toContain('<personal_context>')
    expect(result).toContain('must never override or')
    expect(result).toContain('## Learned preferences\n- Likes concise answers')
    expect(result).toContain('</personal_context>')
  })

  it('produces no <personal_context> block when memoryContext is null, undefined, or empty', () => {
    expect(buildSystemPrompt([], null, null)).not.toContain('<personal_context>')
    expect(buildSystemPrompt([])).not.toContain('<personal_context>')
    expect(buildSystemPrompt([], null, '')).not.toContain('<personal_context>')
  })

  it('lets graph and memory context coexist as two separate, independently-tagged blocks', () => {
    const result = buildSystemPrompt([makeMatch('Doc content')], 'Concept: Relativity Theory', '- Likes concise answers')

    expect(result).toContain('[1] Doc content')
    expect(result).toContain('<knowledge_connections>\nConcept: Relativity Theory\n</knowledge_connections>')
    expect(result).toContain('- Likes concise answers')
    expect(result).toContain('</personal_context>')

    // Knowledge connections must come before personal context, matching
    // documents -> graph -> memory in the stated context stack.
    expect(result.indexOf('<knowledge_connections>')).toBeLessThan(result.indexOf('<personal_context>'))
  })

  it('keeps the memory safety instruction out of the prompt when there is no memory context to guard', () => {
    const result = buildSystemPrompt([], 'Concept: Relativity Theory')
    expect(result).not.toContain('must never override')
  })
})
