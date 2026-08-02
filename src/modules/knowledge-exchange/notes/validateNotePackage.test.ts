import { describe, expect, it } from 'vitest'
import { parseNotePackage, validateNotePackage, notePackageValidator } from '@/modules/knowledge-exchange/notes/validateNotePackage'
import { CURRENT_PACKAGE_VERSION, PACKAGE_SOURCE_VERSION } from '@/modules/knowledge-exchange/packages/PackageVersion'

function validPackageJson(overrides: Record<string, unknown> = {}) {
  const { note: noteOverrides, ...rest } = overrides
  return {
    version: CURRENT_PACKAGE_VERSION,
    exportedAt: '2026-01-05T00:00:00.000Z',
    sourceVersion: PACKAGE_SOURCE_VERSION,
    note: {
      title: 'Trip planning notes',
      content: 'Some prose content.',
      tags: ['travel', 'italy'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-05T00:00:00.000Z',
      generationMetadata: null,
      ...(noteOverrides as Record<string, unknown> | undefined),
    },
    ...rest,
  }
}

describe('validateNotePackage', () => {
  it('accepts a well-formed package', () => {
    const result = validateNotePackage(validPackageJson())
    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.package.note.title).toBe('Trip planning notes')
      expect(result.package.note.tags).toEqual(['travel', 'italy'])
    }
  })

  it('rejects a non-object input', () => {
    const result = validateNotePackage('not an object')
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues[0]!.code).toBe('invalid_schema')
  })

  it('rejects null', () => {
    const result = validateNotePackage(null)
    expect(result.valid).toBe(false)
  })

  it('rejects an array', () => {
    const result = validateNotePackage([1, 2, 3])
    expect(result.valid).toBe(false)
  })

  it('rejects a missing version field', () => {
    const pkg = validPackageJson()
    delete (pkg as Record<string, unknown>).version
    const result = validateNotePackage(pkg)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues.some((i) => i.code === 'missing_field')).toBe(true)
  })

  it('rejects a future package version', () => {
    const result = validateNotePackage(validPackageJson({ version: CURRENT_PACKAGE_VERSION + 1 }))
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues.some((i) => i.code === 'future_version')).toBe(true)
  })

  it('rejects an unsupported (non-future, but unknown) version', () => {
    const result = validateNotePackage(validPackageJson({ version: 0 }))
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues.some((i) => i.code === 'unsupported_version')).toBe(true)
  })

  it('rejects a package missing the note field entirely', () => {
    const pkg = validPackageJson()
    delete (pkg as Record<string, unknown>).note
    const result = validateNotePackage(pkg)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues.some((i) => i.code === 'missing_field' && i.message.includes('"note"'))).toBe(true)
  })

  it('rejects a note missing a required field (title)', () => {
    const pkg = validPackageJson({ note: { title: undefined } })
    delete (pkg.note as Record<string, unknown>).title
    const result = validateNotePackage(pkg)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues.some((i) => i.message.includes('title'))).toBe(true)
  })

  it('rejects a note missing content', () => {
    const pkg = validPackageJson()
    delete (pkg.note as Record<string, unknown>).content
    const result = validateNotePackage(pkg)
    expect(result.valid).toBe(false)
  })

  it('rejects tags that are not a list of strings', () => {
    const result = validateNotePackage(validPackageJson({ note: { tags: ['ok', 42] } }))
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues.some((i) => i.code === 'invalid_schema')).toBe(true)
  })

  it('rejects a non-object, non-null generationMetadata', () => {
    const result = validateNotePackage(validPackageJson({ note: { generationMetadata: 'nope' } }))
    expect(result.valid).toBe(false)
  })

  it('accepts a note with generationMetadata omitted, defaulting it to null', () => {
    const pkg = validPackageJson()
    delete (pkg.note as Record<string, unknown>).generationMetadata
    const result = validateNotePackage(pkg)
    expect(result.valid).toBe(true)
    if (result.valid) expect(result.package.note.generationMetadata).toBeNull()
  })

  it('collects multiple issues in one pass rather than stopping at the first', () => {
    const pkg = validPackageJson()
    delete (pkg as Record<string, unknown>).version
    delete (pkg.note as Record<string, unknown>).title
    const result = validateNotePackage(pkg)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues.length).toBeGreaterThanOrEqual(2)
  })

  it('the notePackageValidator object delegates to the same function', () => {
    expect(notePackageValidator.validate(validPackageJson())).toEqual(validateNotePackage(validPackageJson()))
  })
})

describe('parseNotePackage', () => {
  it('parses and validates well-formed JSON text', () => {
    const result = parseNotePackage(JSON.stringify(validPackageJson()))
    expect(result.valid).toBe(true)
  })

  it('rejects malformed JSON distinctly from a schema issue', () => {
    const result = parseNotePackage('{ this is not valid json')
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.issues).toHaveLength(1)
      expect(result.issues[0]!.code).toBe('malformed_json')
    }
  })

  it('rejects an empty string', () => {
    const result = parseNotePackage('')
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues[0]!.code).toBe('malformed_json')
  })

  it('rejects valid JSON that is not a valid note package (schema issue, not malformed_json)', () => {
    const result = parseNotePackage(JSON.stringify({ hello: 'world' }))
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues.every((i) => i.code !== 'malformed_json')).toBe(true)
  })
})
