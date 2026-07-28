/**
 * Single source of truth for product branding (Phase UX-3.5). Not a
 * rename yet — productName stays "Second Brain" — but every place that
 * used to hardcode that string now reads from here, so swapping to
 * NOVA PIP later is a one-location change instead of a grep-and-replace.
 */
export const appConfig = {
  productName: 'Second Brain',
  productSubtitle: 'Personal Knowledge Workspace',
  logo: null as string | null,
  tagline: "Let's continue building your knowledge.",
}
