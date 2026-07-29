import { OPTION_SPLIT_PATTERNS, stripLeadingDecisionPhrase } from '@/modules/intelligence/decision/decisionRules'
import type { DecisionFramework, DecisionOption } from '@/modules/intelligence/decision/decisionTypes'

/** Pure, deterministic option extraction — "A vs B" / "A versus B" / "A or B" — never an LLM call. */
export function extractDecisionOptions(text: string): DecisionOption[] {
  const cleaned = stripLeadingDecisionPhrase(text).replace(/[?.!]+$/, '')
  for (const pattern of OPTION_SPLIT_PATTERNS) {
    const match = pattern.exec(cleaned)
    if (!match) continue
    const first = match[1]?.trim()
    const second = match[2]?.trim()
    if (first && second) return [{ label: first }, { label: second }]
  }
  return []
}

/**
 * UX-12 Phase 7 — Decision Intelligence. Pure deterministic logic, no AI
 * call. Returns null when fewer than two comparable options can be
 * deterministically extracted from the text — not every 'decide'-intent
 * message names two concrete things to weigh.
 *
 * pros/cons/risks are intentionally returned empty and confidence is
 * always 'low': fabricating plausible-sounding pros/cons for arbitrary
 * extracted options (with no real comparable evidence behind them) would
 * mean inventing content, which this phase's "no AI calls" constraint
 * rules out just as firmly as inventing a fake number would. Populating
 * them for real would require wiring in actual comparable evidence per
 * option type (e.g. document stats, workspace stats) — deferred; see the
 * phase report.
 */
export function buildDecisionFramework(text: string): DecisionFramework | null {
  const options = extractDecisionOptions(text)
  if (options.length < 2) return null

  return {
    options,
    pros: [],
    cons: [],
    risks: [],
    recommendation: null,
    confidence: 'low',
  }
}
