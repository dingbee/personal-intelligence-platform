/**
 * UX-14.5.9 — the generic import contract every package type's importer
 * implements (`notes/importNotePackage.ts` today).
 */
export interface PackageImportContext {
  /** The importer becomes the owner of every row created — never the exporter's identity, never preserved from the package. */
  userId: string
  /**
   * Explicit destination workspace, chosen by the importing user at
   * import time — `null` means "no workspace" (personal), the same
   * meaning it already has everywhere else in this schema. Never
   * inferred from the package's original workspace, which the importer
   * may not be a member of, or which may not exist in their account at
   * all (see `notes/notePackageTypes.ts`'s own doc-comment).
   */
  workspaceId: string | null
}

/**
 * Async because importing means writing new rows (and, for Notes,
 * re-running search indexing/concept linking), unlike export/validate,
 * which are pure functions.
 */
export interface PackageImporter<TPackage, TResult> {
  import(pkg: TPackage, context: PackageImportContext): Promise<TResult>
}
