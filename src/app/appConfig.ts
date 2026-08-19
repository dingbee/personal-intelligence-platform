/**
 * Single source of truth for product branding (Phase UX-3.5). Post-10/10
 * Phase 2 (ARRIYIA Identity Implementation) — productName is now "ARRIYIA";
 * every place that reads from here instead of hardcoding the string picked
 * up the new identity automatically. See docs/arriyia-rebranding-forensic-audit.md.
 */
export const appConfig = {
  productName: 'ARRIYIA',
  productSubtitle: 'Personal Intelligence Platform',
  logo: null as string | null,
  tagline: "Let's continue building your knowledge.",
}
