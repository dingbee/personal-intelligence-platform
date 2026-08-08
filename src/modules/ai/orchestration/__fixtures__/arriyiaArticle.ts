/**
 * PIP Sprint 4/10 — the real failure this sprint diagnoses: a user
 * uploaded a PDF article and asked "What has been mentioned about
 * ARRIYIA in the article?" and NOVA failed to answer meaningfully. This
 * fixture reproduces that shape deterministically: a multi-page article
 * (modeled as PDF "Page N" chapters, matching extractors/pdf.ts's real
 * output) with several unrelated sections and exactly one paragraph,
 * mid-document, that discusses a rare invented term — ARRIYIA never
 * appears anywhere else in the fixture, and no other page contains it.
 */

export const ARTICLE_TITLE = 'Regional Supply Chain Resilience Review.pdf'
export const ARRIYIA_PAGE_INDEX = 5 // zero-indexed -> "Page 6"

export const ARTICLE_PAGES: { index: number; title: string; text: string }[] = [
  { index: 0, title: 'Page 1', text: 'This report reviews regional supply chain resilience across three sectors over the past fiscal year. It surveys logistics networks, warehousing capacity, and vendor diversification strategies adopted by mid-sized manufacturers.' },
  { index: 1, title: 'Page 2', text: 'Manufacturers reported an average lead-time increase of eleven percent following recent port congestion. Warehousing costs rose in parallel, driven by higher demand for buffer inventory near coastal distribution hubs.' },
  { index: 2, title: 'Page 3', text: 'Vendor diversification remained the most common mitigation strategy. Firms that qualified a second supplier for critical components reported thirty percent fewer stockouts than firms relying on a single source.' },
  { index: 3, title: 'Page 4', text: 'Labor availability also shaped resilience outcomes. Regions with flexible staffing arrangements recovered from disruptions roughly twice as fast as regions with rigid scheduling practices.' },
  { index: 4, title: 'Page 5', text: 'Digital visibility tools, including shipment tracking dashboards, were adopted by most large manufacturers but remained rare among smaller firms, who cited cost as the primary barrier to adoption.' },
  {
    index: ARRIYIA_PAGE_INDEX,
    title: 'Page 6',
    text:
      'One notable case study involves ARRIYIA, a regional logistics cooperative formed by four mid-sized manufacturers to jointly negotiate freight contracts. ' +
      'ARRIYIA reduced average freight costs for its members by eighteen percent within its first year, primarily by consolidating shipments across member companies ' +
      'and negotiating volume discounts with two regional carriers. Member firms credited ARRIYIA with helping them avoid the worst of the port congestion delays ' +
      'described earlier in this report, since consolidated shipments received priority handling at the busiest terminals.',
  },
  { index: 6, title: 'Page 7', text: 'Looking ahead, most surveyed firms plan to expand digital visibility investments over the next two years, citing the resilience gains observed by early adopters.' },
  { index: 7, title: 'Page 8', text: 'In conclusion, the strongest resilience outcomes were associated with vendor diversification, flexible labor arrangements, and collaborative logistics structures rather than any single intervention alone.' },
]

export const ARTICLE_FULL_TEXT = ARTICLE_PAGES.map((page) => page.text).join('\n\n')
