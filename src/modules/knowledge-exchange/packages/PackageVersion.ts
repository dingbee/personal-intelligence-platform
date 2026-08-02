/**
 * UX-14.5.9 — Knowledge Exchange Phase 1 (Notes Export/Import MVP).
 *
 * Every package this framework produces is versioned so a validator can
 * cleanly reject a package format it doesn't understand yet — a "future"
 * version produced by a newer app build — instead of guessing at an
 * unfamiliar shape. `CURRENT_PACKAGE_VERSION` is what this app build
 * writes on export; `SUPPORTED_PACKAGE_VERSIONS` is what it can still
 * read on import. They're currently identical (there is only one version
 * so far), but kept as two separate constants because that's how a
 * versioned format actually evolves: a later bump widens "supported"
 * (read v1 and v2) *before* narrowing "current" (write only v2), never
 * the other order.
 */
export const CURRENT_PACKAGE_VERSION = 1
export const SUPPORTED_PACKAGE_VERSIONS: readonly number[] = [1]

/**
 * Identifies which exporter produced a package, independent of the app's
 * own release version (`package.json`'s `version` field is an
 * unmaintained placeholder, `"0.0.0"`, not a real release number).
 * Bump this string only if the export *format* itself changes in a way
 * that isn't already captured by `CURRENT_PACKAGE_VERSION` — e.g. a
 * rewrite of how a field is derived, not a new field.
 */
export const PACKAGE_SOURCE_VERSION = 'nova-pip-knowledge-exchange-v1'

export function isSupportedPackageVersion(version: unknown): version is number {
  return typeof version === 'number' && SUPPORTED_PACKAGE_VERSIONS.includes(version)
}

/** True only for a version number *higher* than this app build knows how to write — the "produced by a newer app" case, distinct from "produced by an app version this build never supported at all." */
export function isFuturePackageVersion(version: unknown): boolean {
  return typeof version === 'number' && Number.isFinite(version) && version > CURRENT_PACKAGE_VERSION
}
