/**
 * Data Intelligence Foundation — the planning step's system prompt,
 * composed in code rather than a database-editable PromptTemplate. This
 * mirrors the existing precedent of AIService's own chat system prompt
 * (buildSystemPrompt.ts) being code-composed rather than registry-driven:
 * the strict JSON contract this prompt enforces is a mechanism detail of
 * runDataIntelligenceQuery's internal planning call, not a
 * customer-tunable capability — the ONE capability this module exposes
 * (data-intelligence-query, see module.ts) is the interpretation step,
 * whose tone an admin might reasonably want to adjust. This call is
 * tagged with its own `feature` string for observability (see
 * runDataIntelligenceQuery.ts) without adding a second registry entry.
 *
 * The LLM's only job here is to propose a plan — never to compute an
 * answer. `parseAnalyticalPlanResponse.ts` and executeAnalyticalPlan.ts's
 * own validation are the actual safety net; this prompt exists to make a
 * valid response likely, not to be trusted on its own.
 */
export function buildPlannerSystemPrompt(schemaDescription: string): string {
  return (
    'You are the analytical planner for a deterministic data query engine. Given a question about a ' +
    'dataset, respond with ONLY a JSON object describing how to compute the answer — never the answer ' +
    'itself, never a calculation, never prose. A separate deterministic engine executes your plan against ' +
    'the real data; you do not have access to the data\'s actual values or rows, only the schema below.\n\n' +
    `${schemaDescription}\n\n` +
    'Respond with ONLY a JSON object of this exact shape (no markdown code fences, no other text):\n' +
    '{\n' +
    '  "filters": [ { "column": "<exact column name>", "op": "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "between", "value": <value, or array for in/between> } ],\n' +
    '  "dimensions": [ { "column": "<exact column name>", "dateTrunc": "year" | "month" (optional, date columns only) } ],\n' +
    '  "measures": [ {\n' +
    '    "as": "<short output name, e.g. totalSales>",\n' +
    '    "aggregation": "sum" | "avg" | "count" | "count_distinct" | "min" | "max" | "ratio",\n' +
    '    "column": "<exact column name, required for sum/avg/min/max/count_distinct>",\n' +
    '    "filters": [ ...same shape as top-level filters, optional, scopes only this measure... ],\n' +
    '    "ratio": { "numerator": { "aggregation": "sum" | "count", "column": "<optional for count>", "filters": [...] }, "denominator": { ...same shape... } } (required only when aggregation is "ratio")\n' +
    '  } ],\n' +
    '  "sort": { "by": "<a dimension column or a measure \'as\' name>", "direction": "asc" | "desc" } (optional),\n' +
    '  "limit": <number> (optional)\n' +
    '}\n\n' +
    'Rules: use only column names that appear in the schema above, exactly as spelled. "filters" and ' +
    '"dimensions" may be omitted or empty when not needed. Every measure needs a unique "as". A ratio ' +
    'measure (e.g. "return rate", "share of total") always uses "ratio" with both numerator and ' +
    'denominator — never a single sum/avg field pretending to already be a percentage. If the question ' +
    'cannot be answered from the columns available, or is too ambiguous to translate into a plan, respond ' +
    'with exactly {"error": "<one clear sentence explaining what is missing or ambiguous>"} instead.'
  )
}
