import { createIntelligenceRecord } from '@/modules/intelligence-ledger/api/createIntelligenceRecord'
import type { CreateIntelligenceRecordParams } from '@/modules/intelligence-ledger/ledger'

/**
 * Best-effort Ledger persistence, called from each intelligence engine's
 * own completion point (see runDataIntelligenceQuery.ts,
 * runAnalysisInvestigation.ts, etc.). Mirrors useAnalyzeImage.ts's
 * established "optional enrichment step: log and continue" convention
 * exactly — a Ledger write failure must never be mistaken for the
 * intelligence engine itself failing (the engine's own return value is
 * never touched by this function), and must never be silently invisible
 * either (logged via console.error, not swallowed without a trace).
 */
export async function writeIntelligenceRecord(params: CreateIntelligenceRecordParams): Promise<void> {
  try {
    await createIntelligenceRecord(params)
  } catch (err) {
    console.error('[intelligence-ledger] failed to persist a completed intelligence record', err)
  }
}
