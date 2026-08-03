import { describe, expect, it } from 'vitest'
import { EXPORT_FORMAT_OPTIONS, assertNoSensitiveContent, exportFilename } from '@/modules/export/types'
import type { ExportContent } from '@/modules/export/types'

describe('EXPORT_FORMAT_OPTIONS', () => {
  it('lists exactly the four documented formats, NOVA Package first', () => {
    expect(EXPORT_FORMAT_OPTIONS.map((o) => o.format)).toEqual(['nova', 'pdf', 'markdown', 'docx'])
  })

  it('carries the exact labels/descriptions the discovery specified', () => {
    expect(EXPORT_FORMAT_OPTIONS).toEqual([
      { format: 'nova', label: 'NOVA Package', description: 'Full backup and transfer', extension: 'nova' },
      { format: 'pdf', label: 'PDF', description: 'Readable document', extension: 'pdf' },
      { format: 'markdown', label: 'Markdown', description: 'Editable text', extension: 'md' },
      { format: 'docx', label: 'Word', description: 'Editable document', extension: 'docx' },
    ])
  })
})

describe('exportFilename', () => {
  it('slugifies a title into a safe, extensioned filename', () => {
    expect(exportFilename('Plant Biology', 'md')).toBe('plant-biology.md')
  })

  it('falls back to a generic name for empty/symbol-only titles', () => {
    expect(exportFilename('   ', 'pdf')).toBe('export.pdf')
  })
})

function fakeContent(overrides: Partial<ExportContent> = {}): ExportContent {
  return { title: 'Photosynthesis', subtitle: 'Concept', sections: [{ heading: 'Notes', body: ['plants make food'] }], ...overrides }
}

describe('assertNoSensitiveContent', () => {
  it('does not throw for ordinary, already-audited display content', () => {
    expect(() => assertNoSensitiveContent(fakeContent())).not.toThrow()
  })

  it.each(['user_id', 'workspace_id', 'ai_memory', 'provider_override', 'embedding', 'access_token', 'refresh_token'])(
    'throws when content unexpectedly references "%s"',
    (term) => {
      const tainted = fakeContent({ sections: [{ body: [`some leaked reference to ${term}`] }] })
      expect(() => assertNoSensitiveContent(tainted)).toThrow(/refusing to export/i)
    },
  )

  it('is case-insensitive', () => {
    const tainted = fakeContent({ subtitle: 'USER_ID leaked here' })
    expect(() => assertNoSensitiveContent(tainted)).toThrow()
  })
})
