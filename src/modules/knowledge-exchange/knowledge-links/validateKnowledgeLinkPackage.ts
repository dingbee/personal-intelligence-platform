import { isFuturePackageVersion, isSupportedPackageVersion } from '@/modules/knowledge-exchange/packages/PackageVersion'
import type {
  PackageValidationIssue,
  PackageValidationResult,
  PackageValidator,
} from '@/modules/knowledge-exchange/packages/PackageValidator'
import type { KnowledgeNodeType } from '@/shared/types/database'
import type { KnowledgeLinkEndpointPayload, KnowledgeLinkPackage } from '@/modules/knowledge-exchange/knowledge-links/knowledgeLinkPackageTypes'
import { normalizeTitle } from '@/modules/knowledge-intelligence/utils/normalizeTitle'

function issue(code: PackageValidationIssue['code'], message: string): PackageValidationIssue {
  return { code, message }
}

function validateEndpointShape(input: unknown, label: 'source' | 'target'): { valid: true; endpoint: KnowledgeLinkEndpointPayload } | { valid: false; issues: PackageValidationIssue[] } {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { valid: false, issues: [issue('missing_field', `The relationship is missing its "${label}" concept.`)] }
  }
  const endpoint = input as Record<string, unknown>
  const issues: PackageValidationIssue[] = []

  if (endpoint.nodeType !== 'concept' && endpoint.nodeType !== 'entity') {
    issues.push(issue('invalid_schema', `The "${label}" concept's "nodeType" (${JSON.stringify(endpoint.nodeType)}) must be "concept" or "entity".`))
  }
  if (typeof endpoint.title !== 'string' || endpoint.title.trim() === '') {
    issues.push(issue('missing_field', `The "${label}" concept is missing a "title".`))
  }
  if (endpoint.description !== null && typeof endpoint.description !== 'string') {
    issues.push(issue('invalid_schema', `The "${label}" concept's "description" must be a string or null.`))
  }

  if (issues.length > 0) return { valid: false, issues }

  return {
    valid: true,
    endpoint: {
      nodeType: endpoint.nodeType as KnowledgeNodeType,
      title: endpoint.title as string,
      description: (endpoint.description as string | null | undefined) ?? null,
    },
  }
}

/**
 * Never trusts a package as pre-validated just because it came from this
 * app's own Export, exactly like every other package type's validator.
 * Collects every issue found rather than stopping at the first.
 *
 * "Orphan endpoints" (this task's own required rejection category):
 * interpreted as a relationship whose two endpoints resolve to the exact
 * same concept (identical normalized title + nodeType) — a self-loop,
 * which is meaningless as a relationship and already excluded by the
 * existing extraction pipeline's own dedup rule
 * (`buildEdgeInputsFromRelationships`'s `source.id === target.id` check).
 * An endpoint that's merely incomplete (missing title/invalid nodeType)
 * is caught as a "malformed relationship" by `validateEndpointShape`
 * above, before this check ever runs.
 */
export function validateKnowledgeLinkPackage(input: unknown): PackageValidationResult<KnowledgeLinkPackage> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { valid: false, issues: [issue('invalid_schema', "This doesn't look like a knowledge link package — expected a JSON object.")] }
  }
  const pkg = input as Record<string, unknown>
  const issues: PackageValidationIssue[] = []

  if (typeof pkg.version !== 'number') {
    issues.push(issue('missing_field', 'Missing or invalid "version" field.'))
  } else if (isFuturePackageVersion(pkg.version)) {
    issues.push(
      issue(
        'future_version',
        `This package was exported by a newer version of ARRIYIA (package version ${pkg.version}) that this app can't import yet.`,
      ),
    )
  } else if (!isSupportedPackageVersion(pkg.version)) {
    issues.push(issue('unsupported_version', `Package version ${JSON.stringify(pkg.version)} is not supported.`))
  }

  if (typeof pkg.exportedAt !== 'string') issues.push(issue('missing_field', 'Missing "exportedAt" field.'))
  if (typeof pkg.sourceVersion !== 'string') issues.push(issue('missing_field', 'Missing "sourceVersion" field.'))

  if (typeof pkg.link !== 'object' || pkg.link === null || Array.isArray(pkg.link)) {
    issues.push(issue('missing_field', 'Missing "link" field.'))
    return { valid: false, issues }
  }

  const link = pkg.link as Record<string, unknown>
  if (typeof link.relationshipType !== 'string' || link.relationshipType.trim() === '') {
    issues.push(issue('missing_field', 'The relationship is missing a "relationshipType".'))
  }
  if (link.confidence !== null && typeof link.confidence !== 'number') {
    issues.push(issue('invalid_schema', 'The relationship\'s "confidence" must be a number or null.'))
  }
  if (link.generatedBy !== null && typeof link.generatedBy !== 'string') {
    issues.push(issue('invalid_schema', 'The relationship\'s "generatedBy" must be a string or null.'))
  }

  const sourceResult = validateEndpointShape(link.source, 'source')
  if (!sourceResult.valid) issues.push(...sourceResult.issues)
  const targetResult = validateEndpointShape(link.target, 'target')
  if (!targetResult.valid) issues.push(...targetResult.issues)

  if (issues.length > 0) return { valid: false, issues }
  // Both endpoints are well-formed past this point (TS can't narrow through the two independent results above).
  const source = (sourceResult as { valid: true; endpoint: KnowledgeLinkEndpointPayload }).endpoint
  const target = (targetResult as { valid: true; endpoint: KnowledgeLinkEndpointPayload }).endpoint

  if (source.nodeType === target.nodeType && normalizeTitle(source.title) === normalizeTitle(target.title)) {
    return {
      valid: false,
      issues: [issue('invalid_schema', 'A relationship needs two distinct concepts — this package links a concept to itself.')],
    }
  }

  return {
    valid: true,
    package: {
      version: pkg.version as number,
      exportedAt: pkg.exportedAt as string,
      sourceVersion: pkg.sourceVersion as string,
      link: {
        relationshipType: link.relationshipType as string,
        confidence: (link.confidence as number | null | undefined) ?? null,
        generatedBy: (link.generatedBy as string | null | undefined) ?? null,
        source,
        target,
      },
    },
  }
}

/** The file-upload entry point: parses raw text as JSON first, surfacing a malformed-JSON issue distinctly from a schema issue, then validates. */
export function parseKnowledgeLinkPackage(rawText: string): PackageValidationResult<KnowledgeLinkPackage> {
  let parsed: unknown
  try {
    parsed = JSON.parse(rawText)
  } catch {
    return { valid: false, issues: [issue('malformed_json', "This file isn't valid JSON.")] }
  }
  return validateKnowledgeLinkPackage(parsed)
}

export const knowledgeLinkPackageValidator: PackageValidator<KnowledgeLinkPackage> = { validate: validateKnowledgeLinkPackage }
