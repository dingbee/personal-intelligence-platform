# IF-03 — Domain Capabilities


## Architectural decision

Business domains are **specialized prompt/context configurations over the existing intelligence substrate**, not eight new vertical engines. IF-03 reuses the existing capability registry, prompt registry, shared `domain_intelligence` entitlement, IF-02 domain output contract, canonical intelligence ledger, provenance types/adapters, and existing authorization boundaries.

## Domain capability matrix

| Domain key | Capability id | Primary lens |
|---|---|---|
| finance | `domain-finance-assessment` | Performance, liquidity, costs, margins, cash flow, budget variance, unit economics |
| marketing | `domain-marketing-assessment` | Audience, positioning, channels, funnel, acquisition efficiency, experiment quality |
| sales | `domain-sales-assessment` | Pipeline, conversion, velocity, deal slippage, forecast confidence, concentration |
| operations | `domain-operations-assessment` | Throughput, cycle time, service levels, capacity, quality, bottlenecks, continuity |
| hr | `domain-hr-assessment` | Aggregate workforce capacity, skills, hiring, retention, workload, learning needs |
| legal | `domain-legal-assessment` | Supplied obligations, clauses, deadlines, deviations, ambiguity, review questions |
| customer | `domain-customer-assessment` | Journey friction, feedback themes, service quality, retention signals, support issues |
| risk | `domain-risk-assessment` | Exposure, likelihood/impact basis, controls, residual risk, mitigations, indicators |

## Shared output and governance

Each capability requests the IF-02 `DomainIntelligenceOutput` envelope (`schemaVersion: 1`, exact domain key, evidence, findings, recommendations, optional metadata). Output must preserve the distinction between verified facts, deterministic calculations, assumptions, hypotheses, and recommendations. Findings and recommendations may cite only evidence IDs in the same output.

- All eight capabilities declare `requiredFeature: domain_intelligence`; the existing shared execution boundary remains authoritative.
- Recommendations are proposals, not execution. Every recommendation must require approval.
- Prompts treat retrieved context as untrusted data and may only use context legitimately supplied by the existing authorized retrieval path.
- No domain-specific tables, retrieval systems, provenance ontology, execution framework, or authorization bypass is introduced.
- Domain guardrails cover financial advice boundaries, marketing attribution, pipeline-vs-bookings, operational causality, HR privacy and individual employment decisions, legal advice/source grounding, customer privacy, and unsupported risk quantification.
- Persistence continues through the IF-02 canonical ledger API/RPC; no competing history tables are introduced.

## Acceptance criteria

1. Exactly one capability and one active versioned prompt register for each of the eight canonical domain keys; registry-level tests prove registration.
2. Every capability is gated by the shared `domain_intelligence` feature key.
3. Each prompt emits the shared IF-02 envelope and the exact configured domain key.
4. Evidence IDs are unique; all finding/recommendation citations refer to evidence IDs actually present.
5. Unverified claims remain assumptions/hypotheses; deterministic calculations are reproducible; unsupported facts/sources are not fabricated.
6. The execution API rejects recommendations unless `requiresApproval` is exactly `true`; no prompt claims or performs execution.
7. Domain-specific privacy, legal, attribution, causality, forecast, and risk-scoring guardrails are tested.
8. Unit tests cover successful execution, malformed JSON, wrong domain, dangling evidence citations, approval enforcement, and persistence failure. Lint, typecheck, full suite, production build/bundle verification, IF-02 SQL certification, and ARRIYIA V2 gates must pass.
9. No production deploy or production migration is part of IF-03 implementation verification.

## Closure record

- Full-suite CI run `38033202798`: passed.
- Quality gate: passed, including typecheck, lint, targeted tests, production build, and bundle verification.
- ARRIYIA V2 Gate run `38033202849`: passed.
- ARRIYIA V2 Certification run `38033202775`: passed.
- Release operations remain separate from implementation certification; no production deployment or migration was performed.
- IF-03 implementation/security audit is closed; PR #49 remains open and stacked on IF-02 to preserve dependency order.

## Scope boundary

IF-03 registers and specifies the eight domain capabilities. Domain-specific data connectors, new retrieval systems, autonomous execution, new tables, or new authorization models are out of scope. Any domain requiring evidence not present in the authorized shared context must report the gap rather than fabricate a result.
