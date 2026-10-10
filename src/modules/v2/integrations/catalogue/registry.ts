import type { IntegrationCapabilityDescriptor, IntegrationProviderDescriptor } from './contracts'
import { validateIntegrationProviderDescriptor } from './validation'

export type CatalogueResolution<T> =
  | { found: true; value: T }
  | { found: false; reason: 'not_found' | 'invalid_catalogue' | 'ambiguous_version' }

function parseVersion(version: string): { major: number; minor: number; patch: number; prerelease?: string } | undefined {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(version)
  if (!match) return undefined
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), ...(match[4] ? { prerelease: match[4] } : {}) }
}

/** Semantic-version ordering; stable releases sort above prereleases at the same core version. */
export function compareContractVersions(left: string, right: string): number {
  const a = parseVersion(left)
  const b = parseVersion(right)
  if (!a || !b) return left.localeCompare(right)
  if (a.major !== b.major) return a.major - b.major
  if (a.minor !== b.minor) return a.minor - b.minor
  if (a.patch !== b.patch) return a.patch - b.patch
  if (a.prerelease === undefined && b.prerelease !== undefined) return 1
  if (a.prerelease !== undefined && b.prerelease === undefined) return -1
  return (a.prerelease ?? '').localeCompare(b.prerelease ?? '')
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
