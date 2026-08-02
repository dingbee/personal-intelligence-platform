import { describe, expect, it } from 'vitest'
import { parseAssetPackage, validateAssetPackage, assetPackageValidator } from '@/modules/knowledge-exchange/assets/validateAssetPackage'
import { uint8ArrayToBase64 } from '@/modules/knowledge-exchange/assets/base64'
import { CURRENT_PACKAGE_VERSION, PACKAGE_SOURCE_VERSION } from '@/modules/knowledge-exchange/packages/PackageVersion'
import { MAX_ASSET_UPLOAD_BYTES } from '@/modules/assets/validation'

function validPackageJson(overrides: Record<string, unknown> = {}) {
  const { asset: assetOverrides, ...rest } = overrides
  return {
    version: CURRENT_PACKAGE_VERSION,
    exportedAt: '2026-01-05T00:00:00.000Z',
    sourceVersion: PACKAGE_SOURCE_VERSION,
    asset: {
      title: 'Sunset over the lake',
      mimeType: 'image/jpeg',
      width: 1920,
      height: 1080,
      sizeBytes: 245_000,
      createdAt: '2026-01-01T00:00:00.000Z',
      fileDataBase64: 'ZmFrZS1ieXRlcw==',
      ...(assetOverrides as Record<string, unknown> | undefined),
    },
    ...rest,
  }
}

describe('validateAssetPackage', () => {
  it('accepts a well-formed package', () => {
    const result = validateAssetPackage(validPackageJson())
    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.package.asset.title).toBe('Sunset over the lake')
      expect(result.package.asset.mimeType).toBe('image/jpeg')
    }
  })

  it('accepts each supported MIME type', () => {
    for (const mimeType of ['image/jpeg', 'image/png', 'image/webp', 'image/gif']) {
      expect(validateAssetPackage(validPackageJson({ asset: { mimeType } })).valid).toBe(true)
    }
  })

  it('rejects a non-object input', () => {
    const result = validateAssetPackage('not an object')
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues[0]!.code).toBe('invalid_schema')
  })

  it('rejects null and arrays', () => {
    expect(validateAssetPackage(null).valid).toBe(false)
    expect(validateAssetPackage([1, 2, 3]).valid).toBe(false)
  })

  it('rejects a missing version field', () => {
    const pkg = validPackageJson()
    delete (pkg as Record<string, unknown>).version
    const result = validateAssetPackage(pkg)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues.some((i) => i.code === 'missing_field')).toBe(true)
  })

  it('rejects a future package version', () => {
    const result = validateAssetPackage(validPackageJson({ version: CURRENT_PACKAGE_VERSION + 1 }))
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues.some((i) => i.code === 'future_version')).toBe(true)
  })

  it('rejects an unsupported version', () => {
    const result = validateAssetPackage(validPackageJson({ version: 0 }))
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues.some((i) => i.code === 'unsupported_version')).toBe(true)
  })

  it('rejects a package missing the asset field entirely', () => {
    const pkg = validPackageJson()
    delete (pkg as Record<string, unknown>).asset
    const result = validateAssetPackage(pkg)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues.some((i) => i.message.includes('"asset"'))).toBe(true)
  })

  it('rejects an invalid MIME type', () => {
    const result = validateAssetPackage(validPackageJson({ asset: { mimeType: 'image/svg+xml' } }))
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues.some((i) => i.code === 'invalid_schema')).toBe(true)
  })

  it('rejects a non-image MIME type entirely', () => {
    const result = validateAssetPackage(validPackageJson({ asset: { mimeType: 'application/pdf' } }))
    expect(result.valid).toBe(false)
  })

  it('rejects a missing/empty title', () => {
    const pkg = validPackageJson()
    delete (pkg.asset as Record<string, unknown>).title
    expect(validateAssetPackage(pkg).valid).toBe(false)
    expect(validateAssetPackage(validPackageJson({ asset: { title: '   ' } })).valid).toBe(false)
  })

  it('rejects non-positive width/height', () => {
    expect(validateAssetPackage(validPackageJson({ asset: { width: 0 } })).valid).toBe(false)
    expect(validateAssetPackage(validPackageJson({ asset: { height: -1 } })).valid).toBe(false)
  })

  it('rejects a missing file payload', () => {
    const pkg = validPackageJson()
    delete (pkg.asset as Record<string, unknown>).fileDataBase64
    const result = validateAssetPackage(pkg)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues.some((i) => i.message.includes('file content'))).toBe(true)
  })

  it('rejects an oversized payload (over MAX_ASSET_UPLOAD_BYTES)', () => {
    const oversized = uint8ArrayToBase64(new Uint8Array(MAX_ASSET_UPLOAD_BYTES + 1024))
    const result = validateAssetPackage(validPackageJson({ asset: { fileDataBase64: oversized } }))
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues.some((i) => i.message.includes('too large'))).toBe(true)
  })

  it('accepts a payload right at the byte cap', () => {
    const atCap = uint8ArrayToBase64(new Uint8Array(MAX_ASSET_UPLOAD_BYTES))
    const result = validateAssetPackage(validPackageJson({ asset: { fileDataBase64: atCap } }))
    expect(result.valid).toBe(true)
  })

  it('the assetPackageValidator object delegates to the same function', () => {
    expect(assetPackageValidator.validate(validPackageJson())).toEqual(validateAssetPackage(validPackageJson()))
  })
})

describe('parseAssetPackage', () => {
  it('parses and validates well-formed JSON text', () => {
    expect(parseAssetPackage(JSON.stringify(validPackageJson())).valid).toBe(true)
  })

  it('rejects malformed JSON distinctly from a schema issue', () => {
    const result = parseAssetPackage('{ this is not valid json')
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.issues).toHaveLength(1)
      expect(result.issues[0]!.code).toBe('malformed_json')
    }
  })

  it('rejects an empty string', () => {
    const result = parseAssetPackage('')
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues[0]!.code).toBe('malformed_json')
  })

  it('rejects valid JSON that is not a valid asset package (schema issue, not malformed_json)', () => {
    const result = parseAssetPackage(JSON.stringify({ hello: 'world' }))
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues.every((i) => i.code !== 'malformed_json')).toBe(true)
  })
})
