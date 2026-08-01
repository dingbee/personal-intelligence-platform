import { describe, expect, it } from 'vitest'
import { buildArtifactGenerationMetadata } from '@/modules/ai/artifacts/buildArtifactGenerationMetadata'

describe('buildArtifactGenerationMetadata', () => {
  it('tags a non-spreadsheet kind without attaching artifactData', () => {
    const metadata = buildArtifactGenerationMetadata('Just a note.', 'note', { savedFrom: 'chat-message' })
    expect(metadata).toEqual({ savedFrom: 'chat-message', artifactKind: 'note' })
  })

  it('parses and attaches artifactData for a spreadsheet kind with a table', () => {
    const content = ['| Month | Revenue |', '| --- | --- |', '| Jan | 10000 |'].join('\n')
    const metadata = buildArtifactGenerationMetadata(content, 'spreadsheet')

    expect(metadata.artifactKind).toBe('spreadsheet')
    expect(metadata.artifactData).toEqual({
      sheets: [{ name: 'Sheet 1', columns: ['Month', 'Revenue'], cells: expect.any(Array) }],
    })
  })

  it('does not attach an empty artifactData when the kind is spreadsheet but no table is present', () => {
    const metadata = buildArtifactGenerationMetadata('No table here.', 'spreadsheet')
    expect(metadata).toEqual({ artifactKind: 'spreadsheet' })
    expect(metadata).not.toHaveProperty('artifactData')
  })
})
