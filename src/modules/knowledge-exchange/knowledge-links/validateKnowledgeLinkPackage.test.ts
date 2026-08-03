import { describe, expect, it } from 'vitest'
import {
  parseKnowledgeLinkPackage,
  validateKnowledgeLinkPackage,
  knowledgeLinkPackageValidator,
} from '@/modules/knowledge-exchange/knowledge-links/validateKnowledgeLinkPackage'
import { CURRENT_PACKAGE_VERSION, PACKAGE_SOURCE_VERSION } from '@/modules/knowledge-exchange/packages/PackageVersion'

function validPackageJson(overrides: Record<string, unknown> = {}) {
  const { link: linkOverrides, ...rest } = overrides
  return {
    version: CURRENT_PACKAGE_VERSION,
    exportedAt: '2026-01-05T00:00:00.000Z',
    sourceVersion: PACKAGE_SOURCE_VERSION,
    link: {
      relationshipType: 'requires',
      confidence: 0.82,
      generatedBy: 'ai:detect-relationships',
      source: { nodeType: 'concept', title: 'Photosynthesis', description: 'Converts light to energy.' },
      target: { nodeType: 'concept', title: 'Chlorophyll', description: 'Absorbs light.' },
      ...(linkOverrides as Record<string, unknown> | undefined),
    },
    ...rest,
  }
}

describe('validateKnowledgeLinkPackage', () => {
  it('accepts a well-formed package', () => {
    const result = validateKnowledgeLinkPackage(validPackageJson())
    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.package.link.relationshipType).toBe('requires')
      expect(result.package.link.source.title).toBe('Photosynthesis')
      expect(result.package.link.target.title).toBe('Chlorophyll')
    }
  })

  it('accepts entity endpoints', () => {
    const result = validateKnowledgeLinkPackage(
      validPackageJson({ link: { source: { nodeType: 'entity', title: 'Marie Curie', description: null }, target: { nodeType: 'entity', title: 'Pierre Curie', description: null } } }),
    )
    expect(result.valid).toBe(true)
  })

  it('accepts null confidence and generatedBy', () => {
    const result = validateKnowledgeLinkPackage(validPackageJson({ link: { confidence: null, generatedBy: null } }))
    expect(result.valid).toBe(true)
  })

  it('rejects a non-object input', () => {
    const result = validateKnowledgeLinkPackage('not an object')
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues[0]!.code).toBe('invalid_schema')
  })

  it('rejects null and arrays', () => {
    expect(validateKnowledgeLinkPackage(null).valid).toBe(false)
    expect(validateKnowledgeLinkPackage([1, 2, 3]).valid).toBe(false)
  })

  it('rejects a missing version field', () => {
    const pkg = validPackageJson()
    delete (pkg as Record<string, unknown>).version
    const result = validateKnowledgeLinkPackage(pkg)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues.some((i) => i.code === 'missing_field')).toBe(true)
  })

  it('rejects a future package version', () => {
    const result = validateKnowledgeLinkPackage(validPackageJson({ version: CURRENT_PACKAGE_VERSION + 1 }))
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues.some((i) => i.code === 'future_version')).toBe(true)
  })

  it('rejects an unsupported (non-future, unknown) version', () => {
    const result = validateKnowledgeLinkPackage(validPackageJson({ version: 0 }))
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues.some((i) => i.code === 'unsupported_version')).toBe(true)
  })

  it('rejects a package missing the link field entirely', () => {
    const pkg = validPackageJson()
    delete (pkg as Record<string, unknown>).link
    const result = validateKnowledgeLinkPackage(pkg)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues.some((i) => i.message.includes('"link"'))).toBe(true)
  })

  it('rejects a missing relationshipType', () => {
    const result = validateKnowledgeLinkPackage(validPackageJson({ link: { relationshipType: '' } }))
    expect(result.valid).toBe(false)
  })

  it('rejects a non-number, non-null confidence', () => {
    const result = validateKnowledgeLinkPackage(validPackageJson({ link: { confidence: 'high' } }))
    expect(result.valid).toBe(false)
  })

  it('rejects a missing source endpoint entirely', () => {
    const pkg = validPackageJson()
    delete (pkg.link as Record<string, unknown>).source
    const result = validateKnowledgeLinkPackage(pkg)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues.some((i) => i.message.includes('"source"'))).toBe(true)
  })

  it('rejects a missing target endpoint entirely', () => {
    const pkg = validPackageJson()
    delete (pkg.link as Record<string, unknown>).target
    const result = validateKnowledgeLinkPackage(pkg)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues.some((i) => i.message.includes('"target"'))).toBe(true)
  })

  it('rejects an endpoint with an invalid nodeType', () => {
    const result = validateKnowledgeLinkPackage(validPackageJson({ link: { source: { nodeType: 'topic', title: 'X', description: null } } }))
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues.some((i) => i.code === 'invalid_schema')).toBe(true)
  })

  it('rejects an endpoint with an empty title', () => {
    const result = validateKnowledgeLinkPackage(validPackageJson({ link: { source: { nodeType: 'concept', title: '   ', description: null } } }))
    expect(result.valid).toBe(false)
  })

  it('rejects an endpoint with a non-string, non-null description', () => {
    const result = validateKnowledgeLinkPackage(validPackageJson({ link: { source: { nodeType: 'concept', title: 'X', description: 42 } } }))
    expect(result.valid).toBe(false)
  })

  it('rejects orphan endpoints — a relationship linking a concept to itself (same normalized title and nodeType)', () => {
    const result = validateKnowledgeLinkPackage(
      validPackageJson({
        link: {
          source: { nodeType: 'concept', title: 'Photosynthesis', description: null },
          target: { nodeType: 'concept', title: '  photosynthesis!! ', description: 'A slightly different description' },
        },
      }),
    )
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues[0]!.message).toContain('itself')
  })

  it('does not reject two different concepts with the same title but different nodeType', () => {
    const result = validateKnowledgeLinkPackage(
      validPackageJson({
        link: {
          source: { nodeType: 'concept', title: 'Order', description: null },
          target: { nodeType: 'entity', title: 'Order', description: null },
        },
      }),
    )
    expect(result.valid).toBe(true)
  })

  it('the knowledgeLinkPackageValidator object delegates to the same function', () => {
    expect(knowledgeLinkPackageValidator.validate(validPackageJson())).toEqual(validateKnowledgeLinkPackage(validPackageJson()))
  })
})

describe('parseKnowledgeLinkPackage', () => {
  it('parses and validates well-formed JSON text', () => {
    expect(parseKnowledgeLinkPackage(JSON.stringify(validPackageJson())).valid).toBe(true)
  })

  it('rejects malformed JSON distinctly from a schema issue', () => {
    const result = parseKnowledgeLinkPackage('{ this is not valid json')
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.issues).toHaveLength(1)
      expect(result.issues[0]!.code).toBe('malformed_json')
    }
  })

  it('rejects an empty string', () => {
    const result = parseKnowledgeLinkPackage('')
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues[0]!.code).toBe('malformed_json')
  })

  it('rejects valid JSON that is not a valid link package (schema issue, not malformed_json)', () => {
    const result = parseKnowledgeLinkPackage(JSON.stringify({ hello: 'world' }))
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues.every((i) => i.code !== 'malformed_json')).toBe(true)
  })
})
