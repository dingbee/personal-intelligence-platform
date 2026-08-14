/**
 * ARRIYIA Intelligence Infrastructure — Provenance Foundation.
 *
 * The Post-P2 Architecture Reassessment (docs/post-p2-intelligence-
 * architecture-reassessment.md §10) found six structurally incompatible
 * provenance/evidence shapes already in the codebase — AnalyticalProvenance
 * (data-intelligence), Observation.provenance (analysis-intelligence,
 * reuses the former), ResearchSource/ResearchEvidence (research-
 * intelligence), SourceReferenceItem/EvidenceItem (knowledge-intelligence),
 * source_chunk_ids + the ephemeral per-turn contextTrace (chat), and
 * generation_metadata's artifactKind/creationMethod (notes — a different
 * axis: how a note was created, not what evidence supports its claims).
 *
 * This module is the minimal, genuinely shared abstraction those six can
 * progressively adopt via adapters (see adapters/), without redesigning
 * any of the engines or stores that already produce them. It is
 * deliberately NOT a giant ontology: three concepts, matching the chain
 * the reassessment's §10/§21 asked for —
 *
 *   SOURCE  -> EVIDENCE -> DERIVATION (-> further DERIVATIONs, chained)
 *
 * A "conclusion" is not a fourth type: it is simply the outermost
 * DerivationReference in a chain (e.g. kind:'synthesis'), reached by
 * following `basedOnDerivationIds` — inventing a separate Conclusion
 * shape would duplicate what a derivation already is.
 *
 * Every function anywhere under src/shared/provenance/ is a pure
 * mapping over data the caller already legitimately fetched through the
 * existing, unmodified authorization boundary (RLS, has_feature, dataset
 * ownership checks, ...). Nothing here ever calls Supabase itself, and
 * nothing here can be used to look up a source by id — a
 * SourceReference identifies what something was, it does not grant
 * access to it. See each adapter's own doc comment for the specific
 * existing (already-authorized) read it maps from.
 */

/**
 * What kind of thing a SourceReference points at. Deliberately matches
 * SourceReferenceItem's existing real values (document/note/conversation/
 * asset/knowledge_node — see shared/components/knowledge/SourceReference.tsx)
 * plus 'dataset' (a structured_datasets sheet — Data/Analysis Intelligence's
 * own source unit, which SourceReferenceItem never needed to represent)
 * and 'external' (a future web/URL source — a bare, currently-unused type
 * tag only: see docs/post-p2-intelligence-architecture-reassessment.md §15/
 * §17. No code anywhere constructs an 'external' SourceReference this
 * sprint; adding the tag costs nothing and lets the shared model already
 * type-check a future adapter without a breaking union change later).
 */
export type SourceType = 'document' | 'note' | 'conversation' | 'asset' | 'knowledge_node' | 'dataset' | 'external'

export interface SourceReference {
  type: SourceType
  /** The source's own id in its native table (documents.id, notes.id, structured_datasets.id, assets.id, knowledge_nodes.id, conversations.id) — never a provenance-specific id. */
  id: string
  title: string
}

/**
 * Where within a source a piece of evidence came from. A discriminated
 * union rather than one generic "location string" so each source type's
 * genuinely different notion of "where" (a chunk id, a sheet+row range, a
 * described-but-uncoordinated image region, a transcript time range, or
 * simply "the whole source, no finer subdivision") stays honest about what
 * it actually knows — 'whole' is not a fallback for missing data, it is
 * the correct answer for a source (a note, an image today) that has no
 * finer-grained addressing at all.
 *
 * 'segment' (start/end milliseconds, both nullable) exists so the model
 * can already represent a future transcript segment — Voice Intelligence
 * is NOT implemented in this sprint and no code constructs a 'segment'
 * location outside its own adapter test, which exists solely to prove the
 * shape is representable (see adapters/README notes in each adapter file).
 */
export type EvidenceLocation =
  | { kind: 'chunk'; chunkId: string }
  | { kind: 'rows'; sheetName: string; sheetIndex: number; rowCount: number }
  | { kind: 'region'; description: string }
  | { kind: 'segment'; startMs: number | null; endMs: number | null }
  | { kind: 'whole' }

/**
 * A specific, extracted piece of information from one source — the
 * EVIDENCE step of the chain. `excerpt` is the actual retrieved/extracted
 * text where the source is text-shaped (a document chunk, a note, an
 * image's transcribed/described content); `null` when the evidence is
 * inherently non-textual (e.g. a set of dataset rows, represented instead
 * by `location`'s row range — the numbers themselves live in the
 * consuming engine's own already-verified result, never duplicated here).
 */
export interface EvidenceReference {
  id: string
  source: SourceReference
  location: EvidenceLocation
  excerpt: string | null
  /** ISO timestamp of when this evidence was retrieved, for retrieval-based evidence (a chat/search query); null for evidence read from an already-persisted, non-retrieval structure (a dataset computation, a knowledge-node's recorded source). */
  retrievedAt: string | null
}

/** What kind of transformation a DerivationReference records. Matches the vocabulary already in use across the three shipped engines (Data: calculation/aggregation; Analysis: observation/comparison; Research: synthesis; Image: interpretation) rather than inventing new terms. */
export type DerivationKind = 'calculation' | 'aggregation' | 'comparison' | 'observation' | 'synthesis' | 'interpretation'

/**
 * A transformation performed using evidence (and/or prior derivations) —
 * the DERIVATION step of the chain, and (when nothing depends on it
 * further) also the chain's CONCLUSION. `evidenceIds` is never empty when
 * `basedOnDerivationIds` is also empty — a derivation must be grounded in
 * *something* real; a derivation that could cite neither should not have
 * been constructed (see each adapter's own "a failed/empty step
 * contributes no evidence" handling, unchanged from the engines this
 * wraps).
 */
export interface DerivationReference {
  id: string
  kind: DerivationKind
  /** Real EvidenceReference ids this derivation used directly. */
  evidenceIds: string[]
  /** Real prior DerivationReference ids this derivation built on (e.g. a Research synthesis based on several Analysis observations) — empty for a first-order derivation directly over evidence. */
  basedOnDerivationIds: string[]
  /** What was derived, in plain language (e.g. "South return rate = 26.1%", "Carol's return rate is materially higher than her peers'"). */
  statement: string
  /** How it was derived, when the derivation is a genuine deterministic computation (e.g. "ratio: count(Returned=true)/count(*)") — null for an AI interpretation/synthesis, which has no such formula. */
  method: string | null
}

/** The result of following one derivation's dependencies back to real evidence — see resolveEvidenceChain.ts. */
export interface EvidenceChain {
  derivation: DerivationReference
  /** This derivation's own directly-cited evidence, resolved. */
  evidence: EvidenceReference[]
  /** Prior derivations this one was based on, each themselves resolved one level (their own `evidence`/`priorDerivations`) — recursion is bounded, see resolveEvidenceChain.ts. */
  priorDerivations: EvidenceChain[]
}

/** A flat bag of everything one engine adapter produced — the shape every adapters/*.ts file returns, and what resolveEvidenceChain's `lookup` maps are built from (see toLookup in resolveEvidenceChain.ts). */
export interface ProvenanceChain {
  evidence: EvidenceReference[]
  derivations: DerivationReference[]
}
