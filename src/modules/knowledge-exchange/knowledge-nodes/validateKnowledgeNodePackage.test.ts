import { describe, expect, it } from 'vitest'
import {
  parseKnowledgeNodePackage,
  validateKnowledgeNodePackage,
  knowledgeNodePackageValidator,
} from '@/modules/knowledge-exchange/knowledge-nodes/validateKnowledgeNodePackage'
import { CURRENT_PACKAGE_VERSION, PACKAGE_SOURCE_VERSION } from '@/modules/knowledge-exchange/packages/PackageVersion'

function validPackageJson(overrides: Record<string, unknown> = {}) {
  const { node: nodeOverrides, ...rest } = overrides
  return {
    version: CURRENT_PACKAGE_VERSION,
    exportedAt: '2026-01-05T00:00:00.000Z',
    sourceVersion: PACKAGE_SOURCE_VERSION,
    node: {
      nodeType: 'concept',
      title: 'Photosynthesis',
      description: 'The process plants use to convert light into chemical energy.',
      metadata: null,
      generationMetadata: { capability: 'extract-knowledge' },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-05T00:00:00.000Z',
      ...(nodeOverrides as Record<string, unknown> | undefined),
    },
    ...rest,
  }
}

describe('validateKnowledgeNodePackage', () => {
  it('accepts a well-formed package', () => {
    const result = validateKnowledgeNodePackage(validPackageJson())
    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.package.node.title).toBe('Photosynthesis')
      expect(result.package.node.nodeType).toBe('concept')
    }
  })

  it('accepts an entity node', () => {
    const result = validateKnowledgeNodePackage(validPackageJson({ node: { nodeType: 'entity', title: 'Marie Curie' } }))
    expect(result.valid).toBe(true)
  })

  it('rejects a non-object input', () => {
    const result = validateKnowledgeNodePackage('not an object')
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues[0]!.code).toBe('invalid_schema')
  })

  it('rejects null', () => {
    expect(validateKnowledgeNodePackage(null).valid).toBe(false)
  })

  it('rejects an array', () => {
    expect(validateKnowledgeNodePackage([1, 2, 3]).valid).toBe(false)
  })

  it('rejects a missing version field', () => {
    const pkg = validPackageJson()
    delete (pkg as Record<string, unknown>).version
    const result = validateKnowledgeNodePackage(pkg)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues.some((i) => i.code === 'missing_field')).toBe(true)
  })

  it('rejects a future package version', () => {
    const result = validateKnowledgeNodePackage(validPackageJson({ version: CURRENT_PACKAGE_VERSION + 1 }))
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues.some((i) => i.code === 'future_version')).toBe(true)
  })

  it('rejects an unsupported (non-future, but unknown) version', () => {
    const result = validateKnowledgeNodePackage(validPackageJson({ version: 0 }))
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues.some((i) => i.code === 'unsupported_version')).toBe(true)
  })

  it('rejects a package missing the node field entirely', () => {
    const pkg = validPackageJson()
    delete (pkg as Record<string, unknown>).node
    const result = validateKnowledgeNodePackage(pkg)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues.some((i) => i.message.includes('"node"'))).toBe(true)
  })

  it('rejects an invalid nodeType', () => {
    const result = validateKnowledgeNodePackage(validPackageJson({ node: { nodeType: 'topic' } }))
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues.some((i) => i.code === 'invalid_schema')).toBe(true)
  })

  it('rejects a missing title', () => {
    const pkg = validPackageJson()
    delete (pkg.node as Record<string, unknown>).title
    const result = validateKnowledgeNodePackage(pkg)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues.some((i) => i.message.includes('title'))).toBe(true)
  })

  it('rejects an empty/whitespace-only title', () => {
    const result = validateKnowledgeNodePackage(validPackageJson({ node: { title: '   ' } }))
    expect(result.valid).toBe(false)
  })

  it('rejects a non-string, non-null description', () => {
    const result = validateKnowledgeNodePackage(validPackageJson({ node: { description: 42 } }))
    expect(result.valid).toBe(false)
  })

  it('rejects a non-object, non-null metadata', () => {
    const result = validateKnowledgeNodePackage(validPackageJson({ node: { metadata: 'nope' } }))
    expect(result.valid).toBe(false)
  })

  it('rejects a non-object, non-null generationMetadata', () => {
    const result = validateKnowledgeNodePackage(validPackageJson({ node: { generationMetadata: 'nope' } }))
    expect(result.valid).toBe(false)
  })

  it('accepts a node with metadata/generationMetadata omitted, defaulting both to null', () => {
    const pkg = validPackageJson()
    delete (pkg.node as Record<string, unknown>).metadata
    delete (pkg.node as Record<string, unknown>).generationMetadata
    const result = validateKnowledgeNodePackage(pkg)
    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.package.node.metadata).toBeNull()
      expect(result.package.node.generationMetadata).toBeNull()
    }
  })

  it('rejects missing createdAt/updatedAt', () => {
    const pkg = validPackageJson()
    delete (pkg.node as Record<string, unknown>).createdAt
    delete (pkg.node as Record<string, unknown>).updatedAt
    const result = validateKnowledgeNodePackage(pkg)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues.length).toBeGreaterThanOrEqual(2)
  })

  it('the knowledgeNodePackageValidator object delegates to the same function', () => {
    expect(knowledgeNodePackageValidator.validate(validPackageJson())).toEqual(validateKnowledgeNodePackage(validPackageJson()))
  })
})

describe('parseKnowledgeNodePackage', () => {
  it('parses and validates well-formed JSON text', () => {
    expect(parseKnowledgeNodePackage(JSON.stringify(validPackageJson())).valid).toBe(true)
  })

  it('rejects malformed JSON distinctly from a schema issue', () => {
    const result = parseKnowledgeNodePackage('{ this is not valid json')
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.issues).toHaveLength(1)
      expect(result.issues[0]!.code).toBe('malformed_json')
    }
  })

  it('rejects an empty string', () => {
    const result = parseKnowledgeNodePackage('')
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues[0]!.code).toBe('malformed_json')
  })

  it('rejects valid JSON that is not a valid node package (schema issue, not malformed_json)', () => {
    const result = parseKnowledgeNodePackage(JSON.stringify({ hello: 'world' }))
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues.every((i) => i.code !== 'malformed_json')).toBe(true)
  })
})
