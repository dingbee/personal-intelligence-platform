import { describe, expect, it } from 'vitest'
import { getArtifactKind, getCreationMethod, withArtifactKind, withCreationMethod } from '@/modules/ai/artifacts/artifactMetadata'

describe('getArtifactKind', () => {
  it('defaults to note when generation_metadata is null', () => {
    expect(getArtifactKind({ generation_metadata: null })).toBe('note')
  })

  it('defaults to note when artifactKind is absent', () => {
    expect(getArtifactKind({ generation_metadata: { savedFrom: 'chat-message' } })).toBe('note')
  })

  it('defaults to note when artifactKind is not a recognized kind', () => {
    expect(getArtifactKind({ generation_metadata: { artifactKind: 'not-a-real-kind' } })).toBe('note')
  })

  it('reads a valid artifactKind', () => {
    expect(getArtifactKind({ generation_metadata: { artifactKind: 'briefing' } })).toBe('briefing')
  })
})

describe('withArtifactKind', () => {
  it('sets artifactKind on an absent metadata object', () => {
    expect(withArtifactKind(null, 'briefing')).toEqual({ artifactKind: 'briefing' })
  })

  it('preserves existing fields', () => {
    expect(withArtifactKind({ savedFrom: 'chat-message', conversationId: 'c1' }, 'formula')).toEqual({
      savedFrom: 'chat-message',
      conversationId: 'c1',
      artifactKind: 'formula',
    })
  })

  it('overwrites an existing artifactKind', () => {
    expect(withArtifactKind({ artifactKind: 'note' }, 'chart')).toEqual({ artifactKind: 'chart' })
  })
})

describe('getCreationMethod', () => {
  it('returns null when generation_metadata is null', () => {
    expect(getCreationMethod({ generation_metadata: null })).toBeNull()
  })

  it('returns null when creationMethod is absent', () => {
    expect(getCreationMethod({ generation_metadata: { artifactKind: 'briefing' } })).toBeNull()
  })

  it('returns null when creationMethod is not a recognized value', () => {
    expect(getCreationMethod({ generation_metadata: { creationMethod: 'not-a-real-method' } })).toBeNull()
  })

  it('reads a valid creationMethod', () => {
    expect(getCreationMethod({ generation_metadata: { creationMethod: 'ai_generated' } })).toBe('ai_generated')
  })
})

describe('withCreationMethod', () => {
  it('sets creationMethod on an absent metadata object', () => {
    expect(withCreationMethod(null, 'user_created')).toEqual({ creationMethod: 'user_created' })
  })

  it('preserves existing fields, including other provenance fields like savedFrom', () => {
    expect(withCreationMethod({ savedFrom: 'chat-message', conversationId: 'c1' }, 'conversation_saved')).toEqual({
      savedFrom: 'chat-message',
      conversationId: 'c1',
      creationMethod: 'conversation_saved',
    })
  })

  it('overwrites an existing creationMethod', () => {
    expect(withCreationMethod({ creationMethod: 'user_created' }, 'derived')).toEqual({ creationMethod: 'derived' })
  })
})
