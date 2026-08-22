import { createIntelligenceRecord } from '@/modules/intelligence-ledger/api/createIntelligenceRecord'
import type { CreateIntelligenceRecordParams, IntelligenceRecord } from '@/modules/intelligence-ledger/ledger'

/**
 * Best-effort Ledger persistence, called from each intelligence engine's
 * own completion point (see runDataIntelligenceQuery.ts,
 * runAnalysisInvestigation.ts, etc.). Mirrors useAnalyzeImage.ts's
 * established "optional enrichment step: log and continue" convention
 * exactly — a Ledger write failure must never be mistaken for the
 * intelligence engine itself failing (the engine's own return value is
 * never touched by this function), and must never be silently invisible
 * either (logged via console.error, not swallowed without a trace).
 *
 * I8 addition — returns the created record (or null on a swallowed
 * failure) so a caller that needs the new record's real id (e.g.
 * recordExecutionIntelligenceRecord.ts, to auto-record an I8 outcome
 * evaluation against it) can do so without a second, redundant read.
 * Every pre-existing caller that ignored the old `void` return still
 * compiles unchanged.
 */
export async function writeIntelligenceRecord(params: CreateIntelligenceRecordParams): Promise<IntelligenceRecord | null> {
  try {
    return await createIntelligenceRecord(params)
  } catch (err) {
    console.error('[intelligence-ledger] failed to persist a completed intelligence record', err)
    return null
  }
}
