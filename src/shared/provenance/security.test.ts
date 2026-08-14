import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { analyticalResultToProvenance } from '@/shared/provenance/adapters/dataIntelligenceAdapter'
import { chunkMatchToEvidence } from '@/shared/provenance/adapters/retrievalAdapter'
import type { AnalyticalResult } from '@/modules/data-intelligence/analyticalPlan'

const PROVENANCE_DIR = join(__dirname)

function listSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true })
  return entries.flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return listSourceFiles(full)
    if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) return [full]
    return []
  })
}

/**
 * A provenance reference must never become a mechanism for bypassing
 * existing RLS (the sprint's own explicit security requirement): every
 * function under src/shared/provenance/ is a pure mapping over data the
 * caller already fetched through the real, unmodified authorization
 * boundary — it must never independently query Supabase (which would let
 * a provenance-only id resolve into a live read, sidestepping whatever
 * check the caller's own fetch already enforced). Enforced here as a
 * real static guard, not just a doc comment, so a future addition to
 * this directory can't accidentally introduce a Supabase call without a
 * test failing.
 */
describe('provenance module: no independent data access', () => {
  it('contains zero references to the Supabase client anywhere under src/shared/provenance/ (excluding this test file)', () => {
    const files = listSourceFiles(PROVENANCE_DIR)
    expect(files.length).toBeGreaterThan(0)
    for (const file of files) {
      const content = readFileSync(file, 'utf8')
      expect(content).not.toMatch(/from ['"]@\/shared\/lib\/supabase['"]/)
      expect(content).not.toMatch(/supabase\.(from|rpc)\(/)
    }
  })
})

describe('provenance adapters: no cross-call contamination', () => {
  it('two sequential calls with different users\' data never leak into each other\'s output', () => {
    const provenanceA = { documentId: 'doc-user-a', sheetName: 'Sheet A', sheetIndex: 0, totalRowsInDataset: 10, rowsMatchedAfterFilters: 10 }
    const provenanceB = { documentId: 'doc-user-b', sheetName: 'Sheet B', sheetIndex: 0, totalRowsInDataset: 20, rowsMatchedAfterFilters: 20 }
    const resultA: AnalyticalResult = { status: 'ok', plan: { datasetId: 'a', measures: [{ as: 'x', aggregation: 'count' }] }, rows: [], provenance: provenanceA }
    const resultB: AnalyticalResult = { status: 'ok', plan: { datasetId: 'b', measures: [{ as: 'x', aggregation: 'count' }] }, rows: [], provenance: provenanceB }

    const chainA = analyticalResultToProvenance(resultA)!
    const chainB = analyticalResultToProvenance(resultB)!

    expect(chainA.evidence.source.id).toBe('doc-user-a')
    expect(chainB.evidence.source.id).toBe('doc-user-b')
    expect(chainA.evidence.id).not.toBe(chainB.evidence.id)

    // Calling the retrieval adapter for a different document afterward must not retroactively alter chainA's already-returned object.
    chunkMatchToEvidence({ chunkId: 'c1', documentId: 'doc-user-a', content: 'unrelated', similarity: 0.5 }, 'Unrelated title')
    expect(chainA.evidence.source.id).toBe('doc-user-a')
  })
})
