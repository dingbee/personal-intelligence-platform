/**
 * UX-14.5.9 — the generic export contract every package type's exporter
 * implements (`notes/exportNotePackage.ts` today). `TSource` is whatever
 * already-fetched data the exporter needs (e.g. a note + its tags) —
 * exporters never fetch data themselves, which keeps them pure functions,
 * trivially unit-testable without mocking Supabase.
 */
export interface PackageExporter<TSource, TPackage> {
  export(source: TSource): TPackage
}
