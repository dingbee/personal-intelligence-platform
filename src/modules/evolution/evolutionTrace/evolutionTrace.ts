import type { Forecast } from '@/modules/evolution/knowledgeForecast/knowledgeForecast'
import type { MaturityStage } from '@/modules/evolution/workspaceEvolution/workspaceMaturity'

export interface EvolutionTraceInputs {
  documentCount: number
  noteCount: number
  conceptCount: number
  connectionCount: number
  workspaceAgeDays: number
  recentActivityCount: number
}

export interface EvolutionTrace {
  generatedAt: string
  workspaceId: string | null
  inputs: EvolutionTraceInputs
  maturityStage: MaturityStage
  healthScore: number
  topForecast: string | null
}

export interface BuildEvolutionTraceParams {
  workspaceId: string | null
  inputs: EvolutionTraceInputs
  maturityStage: MaturityStage
  healthScore: number
  forecasts: Forecast[]
  now?: Date
}

/**
 * UX-13 — the evolution layer's equivalent of UX-12's ReasoningTrace: a
 * plain record of exactly which raw counts produced a maturity stage,
 * health score, and top forecast, so a claim like "this workspace is
 * declining" is always traceable back to real numbers rather than
 * asserted outright. Used by the "Review Workspace Evolution" UI (an
 * expandable "why" section, the same pattern as PlanPreviewPanel) and by
 * evolutionContext when NOVA cites evolution data in a chat response.
 */
export function buildEvolutionTrace(params: BuildEvolutionTraceParams): EvolutionTrace {
  const now = params.now ?? new Date()
  return {
    generatedAt: now.toISOString(),
    workspaceId: params.workspaceId,
    inputs: params.inputs,
    maturityStage: params.maturityStage,
    healthScore: params.healthScore,
    topForecast: params.forecasts[0]?.message ?? null,
  }
}
