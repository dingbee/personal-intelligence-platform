import type { IntentType } from '@/modules/intelligence/intent/intentTypes'

export interface IntentRule {
  id: string
  intent: IntentType
  patterns: RegExp[]
}

/**
 * UX-12 Phase 2 — deterministic pattern matching, no AI provider call.
 * Order is significant: rules are tried top to bottom and the first match
 * wins, so more specific intents (plan, decide, compare) are listed ahead
 * of more general ones (explain, ask) that would otherwise shadow them —
 * e.g. "help me plan my exam prep" must resolve to 'plan', not 'learn'.
 */
export const INTENT_RULES: IntentRule[] = [
  {
    id: 'plan',
    intent: 'plan',
    patterns: [/\bplan\b/i, /\bhelp me plan\b/i, /\bplanning\b/i, /\bhow should i approach\b/i],
  },
  {
    id: 'decide',
    intent: 'decide',
    patterns: [/\bdecide\b/i, /\bdecision\b/i, /\bshould i\b/i, /\bwhich (one|option)\b/i, /\bis it worth\b/i],
  },
  {
    id: 'compare',
    intent: 'compare',
    patterns: [/\bcompare\b/i, /\bcomparison\b/i, /\bversus\b/i, /\bvs\.?\b/i, /\bdifference between\b/i, /\bwhich is better\b/i],
  },
  {
    id: 'organize',
    intent: 'organize',
    patterns: [/\borganiz(e|ing|ation)\b/i, /\bcategoriz(e|ing)\b/i, /\btidy up\b/i, /\bsort (my|these|this)\b/i],
  },
  {
    id: 'create',
    intent: 'create',
    patterns: [/\bcreate\b/i, /\bwrite (me|a|an)\b/i, /\bdraft\b/i, /\bmake me\b/i, /\bgenerate (a|an|me)\b/i, /\bcompose\b/i],
  },
  {
    id: 'summarize',
    intent: 'summarize',
    patterns: [/\bsummariz(e|ing)\b/i, /\bsummary\b/i, /\btl;?dr\b/i, /\bgive me the gist\b/i],
  },
  {
    id: 'analyze',
    intent: 'analyze',
    patterns: [/\banalyz(e|ing|is)\b/i, /\bbreak down\b/i, /\bwhat patterns\b/i, /\bwhat trends\b/i],
  },
  {
    id: 'review',
    intent: 'review',
    patterns: [/\breview\b/i, /\brevisit\b/i, /\bgo over\b/i, /\bwhat did i (highlight|note)\b/i],
  },
  {
    id: 'continue',
    intent: 'continue',
    patterns: [/\bcontinue\b/i, /\bkeep going\b/i, /\bwhere (was|were) i\b/i, /\bpick up where\b/i, /\bresume\b/i],
  },
  {
    id: 'teach',
    intent: 'teach',
    patterns: [/\bteach me\b/i, /\bexplain (this )?like i'?m\b/i, /\bwalk me through\b/i, /\btutor\b/i],
  },
  {
    id: 'learn',
    intent: 'learn',
    patterns: [/\blearn\b/i, /\bstudy\b/i, /\bprepare for\b/i, /\bexam\b/i, /\bquiz\b/i, /\bmemoriz(e|ing)\b/i],
  },
  {
    id: 'search',
    intent: 'search',
    patterns: [/\bfind\b/i, /\bsearch\b/i, /\blook up\b/i, /\bwhere is\b/i, /\bwhich document\b/i],
  },
  {
    id: 'read',
    intent: 'read',
    patterns: [/\bopen (chapter|book|document)\b/i, /\bstart reading\b/i, /\btake me to\b/i],
  },
  {
    id: 'explain',
    intent: 'explain',
    patterns: [/\bexplain\b/i, /\bwhy (does|is|do|are)\b/i, /\bhow does\b/i, /\bwhat is\b/i, /\bwhat are\b/i, /\bhelp me understand\b/i],
  },
]

export const FALLBACK_INTENT: IntentType = 'ask'
