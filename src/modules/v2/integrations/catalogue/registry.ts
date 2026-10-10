import type { IntegrationCapabilityDescriptor, IntegrationProviderDescriptor } from './contracts'
import { validateIntegrationProviderDescriptor } from './validation'

export type CatalogueResolution<T> =
  | { found: true; value: T }
  | { found: false; reason: 'not_found' | 'invalid_catalogue' | 'ambiguous_version' }

interface ParsedVersion {
  major: number
  minor: number
  patch: number
  prerelease: string[]
  build?: string
}

function parseVersion(version: string): ParsedVersion | undefined {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(version)
  if (!match) return undefined
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ? match[4].split('.') : [],
    ...(match[5] ? { build: match[5] } : {}),
  }
}

/** Semantic-version precedence with a lexical tie-break for equal-precedence build variants. */
export function compareContractVersions(left: string, right: string): number {
  const a = parseVersion(left)
  const b = parseVersion(right)
  if (!a || !b) return left.localeCompare(right)
  if (a.major !== b.major) return a.major - b.major
  if (a.minor !== b.minor) return a.minor - b.minor
  if (a.patch !== b.patch) return a.patch - b.patch

  const aStable = a.prerelease.length === 0
  const bStable = b.prerelease.length === 0
  if (aStable !== bStable) return aStable ? 1 : -1

  for (let index = 0; index < Math.max(a.prerelease.length, b.prerelease.length); index += 1) {
    const leftId = a.prerelease[index]
    const rightId = b.prerelease[index]
    if (leftId === undefined || rightId === undefined) {
      if (leftId === rightId) return 0
      return leftId === undefined ? -1 : 1
    }
    if (leftId === rightId) continue
    const leftNumeric = /^(0|[1-9]\d*)$/.test(leftId)
    const rightNumeric = /^(0|[1-9]\d*)$/.test(rightId)
    if (leftNumeric && rightNumeric) return leftId.length - rightId.length || leftId.localeCompare(rightId)
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1
    return leftId.localeCompare(rightId)
  }

  // Build metadata does not affect SemVer precedence. Use lexical tie-breaking
  // so distinct build variants never make resolution depend on input ordering.
  return (a.build ?? '').localeCompare(b.build ?? '')
}

/**
 * Resolve one provider descriptor deterministically. If version is omitted,
 * the highest semantic version wins. Invalid matching descriptors fail closed.
 */
export function resolveProviderDescriptor(
  catalogue: readonly IntegrationProviderDescriptor[],
  providerId: string,
  version?: string,
): CatalogueResolution<IntegrationProviderDescriptor> {
  const matches = catalogue.filter((entry) => entry.providerId === providerId && (version === undefined || entry.version === version))
  if (matches.length === 0) return { found: false, reason: 'not_found' }
  const validations = matches.map((entry) => validateIntegrationProviderDescriptor(entry))
  if (validations.some((result) => !result.valid)) return { found: false, reason: 'invalid_catalogue' }

  const uniqueVersions = new Set(matches.map((entry) => entry.version))
  if (uniqueVersions.size !== matches.length) return { found: false, reason: 'ambiguous_version' }
  const sorted = [...matches].sort((a, b) => compareContractVersions(b.version, a.version))
  return { found: true, value: sorted[0]! }
}

/** Resolve a capability by stable id and optional exact version. */
export function resolveCapabilityDescriptor(
  provider: IntegrationProviderDescriptor,
  capabilityId: string,
  version?: string,
): CatalogueResolution<IntegrationCapabilityDescriptor> {
  if (!validateIntegrationProviderDescriptor(provider).valid) return { found: false, reason: 'invalid_catalogue' }
  const matches = provider.capabilities.filter((entry) => entry.id === capabilityId && (version === undefined || entry.version === version))
  if (matches.length === 0) return { found: false, reason: 'not_found' }
  if (new Set(matches.map((entry) => entry.version)).size !== matches.length) return { found: false, reason: 'ambiguous_version' }
  const sorted = [...matches].sort((a, b) => compareContractVersions(b.version, a.version))
  return { found: true, value: sorted[0]! }
}
