import { describe, expect, it } from 'vitest'
import type { DocumentRow, Tag } from '@/shared/types/database'
import { documentPackageExporter, documentPackageFilename, exportDocumentPackage } from '@/modules/knowledge-exchange/documents/exportDocumentPackage'
import { CURRENT_PACKAGE_VERSION, PACKAGE_SOURCE_VERSION } from '@/modules/knowledge-exchange/packages/PackageVersion'

function fakeDocument(overrides: Partial<DocumentRow> = {}): DocumentRow {
  return {
    id: 'doc-1',
    user_id: 'exporter-1',
    workspace_id: 'exporter-workspace',
    collection_id: 'exporter-collection',
    title: 'Field Notes',
    file_name: 'field-notes.pdf',
    file_path: 'exporter-1/doc-1-field-notes.pdf',
    file_type: 'pdf',
    file_size: 245_000,
    status: 'ready',
    source: 'upload',
    source_file_id: null,
    source_metadata: {},
    imported_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
    ...overrides,
  }
}

function fakeTags(): Tag[] {
  return [
    { id: 'tag-1', user_id: 'exporter-1', name: 'research', created_at: '2026-01-01T00:00:00.000Z' },
    { id: 'tag-2', user_id: 'exporter-1', name: 'fieldwork', created_at: '2026-01-01T00:00:00.000Z' },
  ]
}

describe('exportDocumentPackage', () => {
  it('includes correct user-visible metadata', () => {
    const manifest = exportDocumentPackage({ document: fakeDocument(), tags: fakeTags() })

    expect(manifest.version).toBe(CURRENT_PACKAGE_VERSION)
    expect(manifest.sourceVersion).toBe(PACKAGE_SOURCE_VERSION)
    expect(manifest.document).toEqual({
      title: 'Field Notes',
      fileName: 'field-notes.pdf',
      fileType: 'pdf',
      sizeBytes: 245_000,
      createdAt: '2026-01-01T00:00:00.000Z',
      tags: ['research', 'fieldwork'],
    })
  })

  it('excludes id, user_id, workspace_id, collection_id, file_path, and status — allow-list only', () => {
    const manifest = exportDocumentPackage({ document: fakeDocument(), tags: [] })
    const serialized = JSON.stringify(manifest)

    expect(serialized).not.toContain('doc-1')
    expect(serialized).not.toContain('exporter-1')
    expect(serialized).not.toContain('exporter-workspace')
    expect(serialized).not.toContain('exporter-collection')
    expect(serialized).not.toContain('file_path')
    expect(serialized).not.toContain('ready')
    expect(serialized).not.toContain('updated_at')
  })

  it('carries tag names only, never tag ids', () => {
    const manifest = exportDocumentPackage({ document: fakeDocument(), tags: fakeTags() })
    const serialized = JSON.stringify(manifest)

    expect(manifest.document.tags).toEqual(['research', 'fieldwork'])
    expect(serialized).not.toContain('tag-1')
    expect(serialized).not.toContain('tag-2')
  })

  it('the documentPackageExporter object delegates to the same function', () => {
    const source = { document: fakeDocument(), tags: fakeTags() }
    expect(documentPackageExporter.export(source)).toEqual(exportDocumentPackage(source))
  })
})

describe('documentPackageFilename', () => {
  it('slugifies the title into a safe .zip filename', () => {
    expect(documentPackageFilename('Field Notes: Volume One!')).toBe('field-notes-volume-one.zip')
  })

  it('falls back to a generic name for an empty/symbol-only title', () => {
    expect(documentPackageFilename('   ')).toBe('document-export.zip')
    expect(documentPackageFilename('###')).toBe('document-export.zip')
  })
})
