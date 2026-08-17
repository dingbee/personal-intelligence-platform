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
  /**
   * V1 Launch Hardening, Workstream 1 — the one already-documented, live,
   * monitored operator address (see docs/founder-command-center-discovery.md,
   * docs/beta-admin-ai-governance-discovery.md: the platform_admins bootstrap
   * row and the sole beta_invites row both resolve to this account). Used as
   * the "request early access" destination for a visitor denied signup by
   * the is_beta_invited gate, so that destination is a real, reachable
   * inbox rather than a new, unverified contact channel.
   */
  accessRequestEmail: 'dan@nolmark.co',
}
