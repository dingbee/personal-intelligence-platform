import type { ArtifactKind } from '@/modules/ai/artifacts/artifactTypes'

const CHART_PATTERN = /\b(line|bar|pie)\s+chart\b|\bchart\s+object\b/i
const MARKDOWN_TABLE_PATTERN = /^\s*\|.+\|\s*\n\s*\|[\s:-]+\|/m
const FORMULA_PATTERN = /=\s*[A-Z]+\d+|^\s*formula\s*:/im
const CONFIDENCE_PATTERN = /\bconfidence\s*[:\s]\s*\d{1,3}\s*%/i
const TEMPLATE_PATTERN = /\btemplate\b|\bchecklist\b|\bstep[- ]by[- ]step\b/i
const SECTION_HEADING_PATTERN = /^#{2,3}\s+\S/gm

const KNOWLEDGE_CARD_MAX_LENGTH = 500
const REPORT_MIN_LENGTH = 400
const REPORT_MIN_HEADINGS = 2

/**
 * UX-14.4 Phase 1 — "teach NOVA what it creates," not "teach NOVA to write
 * differently." Deterministic, regex-based classification of an AI
 * response's *shape* into an ArtifactKind, following this codebase's
 * established rule that classification is a pattern-matching problem, not
 * a reasoning problem (same rule `detectMemoryCandidates`, `intentClassifier`,
 * and the spreadsheet module's `financialPatterns.ts` already follow) — no
 * AI call, so running this on every save is free and instant.
 *
 * Order matters: checks run most-specific-and-least-ambiguous first, so a
 * response that happens to satisfy two patterns lands on the one a human
 * would actually call it (an explicit "Line Chart" mention outranks a
 * generic table; a one-line "Formula:" outranks a full data table having
 * one formula cell — see the spreadsheet check that follows it).
 */
export function detectArtifactKind(content: string): ArtifactKind {
  const trimmed = content.trim()
  if (!trimmed) return 'note'

  if (CHART_PATTERN.test(trimmed)) return 'chart'
  if (MARKDOWN_TABLE_PATTERN.test(trimmed)) return 'spreadsheet'
  if (FORMULA_PATTERN.test(trimmed)) return 'formula'
  if (trimmed.length <= KNOWLEDGE_CARD_MAX_LENGTH && CONFIDENCE_PATTERN.test(trimmed)) return 'knowledge_card'
  if (TEMPLATE_PATTERN.test(trimmed)) return 'template'

  const headingCount = trimmed.match(SECTION_HEADING_PATTERN)?.length ?? 0
  if (trimmed.length >= REPORT_MIN_LENGTH && headingCount >= REPORT_MIN_HEADINGS) return 'report'

  return 'note'
}
