/**
 * Hard safety net for the Safety Rules in UX-5.3B: memory candidates must
 * never carry health, political, religious, or other private-sensitive
 * content, even if they'd otherwise match a detection pattern. This is
 * deliberately a conservative keyword list — over-blocking (dropping a
 * borderline-safe candidate) is the correct failure mode, under-blocking
 * is not. Applied to the whole source message, not just the matched
 * capture, so a sensitive clause elsewhere in the sentence still suppresses
 * the candidate.
 */
const SENSITIVE_PATTERNS: RegExp[] = [
  // Health / medical
  /\b(diagnos(?:is|ed)|disease|cancer|depression|anxiety disorder|medication|prescri(?:ption|bed)|therapy|therapist|illness|disorder|hiv|pregnan(?:t|cy)|mental health|surgery)\b/i,
  // Political
  /\b(political part(?:y|ies)|republican|democrat|conservative party|liberal party|election|vote(?:d|s)? for)\b/i,
  // Religious
  /\b(religion|church|mosque|synagogue|christian|muslim|jewish|hindu|buddhist|atheist|pray(?:er|ing)?|my faith)\b/i,
  // Other private/sensitive categories (identity, financial, legal)
  /\b(social security|ssn|credit card number|bank account|sexual orientation|gay|lesbian|bisexual|transgender|immigration status|visa status|criminal record|arrested|my salary|my income)\b/i,
]

export function containsSensitiveTopic(text: string): boolean {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(text))
}
