import { describe, expect, it } from 'vitest'
import { getArtifactKind, withArtifactKind } from '@/modules/ai/artifacts/artifactMetadata'

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
