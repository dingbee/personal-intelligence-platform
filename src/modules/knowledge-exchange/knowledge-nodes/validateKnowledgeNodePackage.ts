import {
  isFuturePackageVersion,
  isSupportedPackageVersion,
} from '@/modules/knowledge-exchange/packages/PackageVersion'
import type {
  PackageValidationIssue,
  PackageValidationResult,
  PackageValidator,
} from '@/modules/knowledge-exchange/packages/PackageValidator'
import type { KnowledgeNodePackage } from '@/modules/knowledge-exchange/knowledge-nodes/knowledgeNodePackageTypes'

function issue(code: PackageValidationIssue['code'], message: string): PackageValidationIssue {
  return { code, message }
}

/**
 * Mirrors `validateNotePackage`'s exact structure and rules — never trusts
 * a package as pre-validated just because it came from this app's own
 * Export, collects every issue in one pass rather than stopping at the
 * first.
 */
export function validateKnowledgeNodePackage(input: unknown): PackageValidationResult<KnowledgeNodePackage> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { valid: false, issues: [issue('invalid_schema', "This doesn't look like a knowledge node package — expected a JSON object.")] }
  }
  const pkg = input as Record<string, unknown>
  const issues: PackageValidationIssue[] = []

  if (typeof pkg.version !== 'number') {
    issues.push(issue('missing_field', 'Missing or invalid "version" field.'))
  } else if (isFuturePackageVersion(pkg.version)) {
    issues.push(
      issue(
        'future_version',
        `This package was exported by a newer version of NOVA (package version ${pkg.version}) that this app can't import yet.`,
      ),
    )
  } else if (!isSupportedPackageVersion(pkg.version)) {
    issues.push(issue('unsupported_version', `Package version ${JSON.stringify(pkg.version)} is not supported.`))
  }

  if (typeof pkg.exportedAt !== 'string') issues.push(issue('missing_field', 'Missing "exportedAt" field.'))
  if (typeof pkg.sourceVersion !== 'string') issues.push(issue('missing_field', 'Missing "sourceVersion" field.'))

  if (typeof pkg.node !== 'object' || pkg.node === null || Array.isArray(pkg.node)) {
    issues.push(issue('missing_field', 'Missing "node" field.'))
    return { valid: false, issues }
  }

  const node = pkg.node as Record<string, unknown>
  if (node.nodeType !== 'concept' && node.nodeType !== 'entity') {
    issues.push(issue('invalid_schema', 'The node\'s "nodeType" must be "concept" or "entity".'))
  }
  if (typeof node.title !== 'string' || node.title.trim() === '') {
    issues.push(issue('missing_field', 'The node is missing a "title".'))
  }
  if (node.description !== null && typeof node.description !== 'string') {
    issues.push(issue('invalid_schema', 'The node\'s "description" must be a string or null.'))
  }
  if (node.metadata !== null && node.metadata !== undefined && (typeof node.metadata !== 'object' || Array.isArray(node.metadata))) {
    issues.push(issue('invalid_schema', 'The node\'s "metadata" must be an object or null.'))
  }
  if (
    node.generationMetadata !== null &&
    node.generationMetadata !== undefined &&
    (typeof node.generationMetadata !== 'object' || Array.isArray(node.generationMetadata))
  ) {
    issues.push(issue('invalid_schema', 'The node\'s "generationMetadata" must be an object or null.'))
  }
  if (typeof node.createdAt !== 'string') issues.push(issue('missing_field', 'The node is missing "createdAt".'))
  if (typeof node.updatedAt !== 'string') issues.push(issue('missing_field', 'The node is missing "updatedAt".'))

  if (issues.length > 0) return { valid: false, issues }

  return {
    valid: true,
    package: {
      version: pkg.version as number,
      exportedAt: pkg.exportedAt as string,
      sourceVersion: pkg.sourceVersion as string,
      node: {
        nodeType: node.nodeType as 'concept' | 'entity',
        title: node.title as string,
        description: (node.description as string | null | undefined) ?? null,
        metadata: (node.metadata as Record<string, unknown> | null | undefined) ?? null,
        generationMetadata: (node.generationMetadata as Record<string, unknown> | null | undefined) ?? null,
        createdAt: node.createdAt as string,
        updatedAt: node.updatedAt as string,
      },
    },
  }
}

/** The file-upload entry point: parses raw text as JSON first, surfacing a malformed-JSON issue distinctly from a schema issue, then validates — same shape as `parseNotePackage`. */
export function parseKnowledgeNodePackage(rawText: string): PackageValidationResult<KnowledgeNodePackage> {
  let parsed: unknown
  try {
    parsed = JSON.parse(rawText)
  } catch {
    return { valid: false, issues: [issue('malformed_json', "This file isn't valid JSON.")] }
  }
  return validateKnowledgeNodePackage(parsed)
}

export const knowledgeNodePackageValidator: PackageValidator<KnowledgeNodePackage> = { validate: validateKnowledgeNodePackage }
