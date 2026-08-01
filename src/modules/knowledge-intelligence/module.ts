import { registerPlatformModule } from '@/modules/core/modules/registerPlatformModule'

/**
 * Registers the three capabilities the knowledge extraction workflow uses
 * (api/knowledgeExtraction.ts), following the same registerPlatformModule
 * pattern as coreModule — new capability ids + prompt templates, no change
 * to the registries themselves or to runCapability. Distinct ids from the
 * existing 'extract' capability (facts/quotes/data points) since concept
 * and entity extraction is a different, more structured operation with its
 * own JSON response shape.
 *
 * Imported once, for its side effect, from app/App.tsx alongside coreModule.
 */
registerPlatformModule({
  id: 'knowledge-intelligence',
  name: 'Knowledge Intelligence',
  capabilities: [
    {
      id: 'extract-concepts',
      label: 'Extract Concepts',
      description: 'Identify key concepts and ideas discussed in a document.',
    },
    {
      id: 'extract-entities',
      label: 'Extract Entities',
      description: 'Identify named entities (people, organizations, places, works) mentioned in a document.',
    },
    {
      id: 'detect-relationships',
      label: 'Detect Relationships',
      description: 'Infer relationships between previously extracted concepts and entities.',
    },
    {
      id: 'detect-cross-document-relationships',
      label: 'Detect Cross-Document Relationships',
      description: 'Infer relationships between concepts and entities extracted from different documents.',
    },
    {
      id: 'generate-briefing',
      label: 'Generate Briefing',
      description: "Synthesize a concept's accumulated evidence and relationships into a short briefing.",
    },
  ],
  prompts: [
    {
      id: 'extract-concepts@1.0',
      capabilityId: 'extract-concepts',
      version: '1.0',
      active: true,
      template:
        'Identify the 5 to 15 most important concepts or ideas discussed in the following content. ' +
        'Respond with ONLY a JSON array of objects shaped like ' +
        '{"title": "concept name", "description": "one clear sentence explaining it"} — no markdown ' +
        'code fences, no other text.\n\nContent:\n{{content}}',
    },
    {
      id: 'extract-entities@1.0',
      capabilityId: 'extract-entities',
      version: '1.0',
      active: true,
      template:
        'Identify the named entities (people, organizations, places, works, or other specific proper ' +
        'nouns) mentioned in the following content. Respond with ONLY a JSON array of objects shaped ' +
        'like {"title": "entity name", "description": "one clear sentence of context", "entityType": ' +
        '"person|organization|place|work|other"} — no markdown code fences, no other text.\n\n' +
        'Content:\n{{content}}',
    },
    {
      id: 'detect-relationships@1.0',
      capabilityId: 'detect-relationships',
      version: '1.0',
      active: true,
      template:
        'Given the following list of concepts and entities extracted from a piece of content, identify ' +
        'meaningful relationships between them based on the content. Only propose relationships between ' +
        'items that appear in the list below, using their exact titles. Respond with ONLY a JSON array of ' +
        'objects shaped like {"source": "exact title from the list", "target": "exact title from the ' +
        'list", "relationshipType": "short label such as relates_to, part_of, causes, contrasts_with", ' +
        '"confidence": 0.0 to 1.0} — no markdown code fences, no other text.\n\n' +
        'Items:\n{{nodes}}\n\nContent:\n{{content}}',
    },
    {
      id: 'detect-cross-document-relationships@1.0',
      capabilityId: 'detect-cross-document-relationships',
      version: '1.0',
      active: true,
      template:
        'The following is a list of concepts and entities extracted from a user\'s knowledge base, drawn ' +
        'from multiple different documents. Identify meaningful relationships between items that likely ' +
        'come from different sources, based only on the titles and descriptions given — you do not have ' +
        'the original documents. Only propose relationships between items that appear in the list below, ' +
        'using their exact titles. Be conservative: only propose a relationship when the titles or ' +
        'descriptions give a clear, specific reason to connect them. Respond with ONLY a JSON array of ' +
        'objects shaped like {"source": "exact title from the list", "target": "exact title from the ' +
        'list", "relationshipType": "short label such as relates_to, part_of, causes, contrasts_with", ' +
        '"confidence": 0.0 to 1.0} — no markdown code fences, no other text.\n\nItems:\n{{nodes}}',
    },
    {
      id: 'generate-briefing@1.0',
      capabilityId: 'generate-briefing',
      version: '1.0',
      active: true,
      template:
        'You are writing a short briefing on "{{title}}" for someone reviewing their own knowledge base. ' +
        'Base the briefing only on the information given below — do not invent facts, sources, or ' +
        'relationships that are not listed. Write 3 to 6 sentences covering what is known, the most ' +
        'important related concepts, and any notable gap in the evidence. If the knowledge confidence is ' +
        'low, say so plainly rather than overstating certainty. Respond with plain prose, no headings, no ' +
        'markdown, no preamble.\n\nKnowledge confidence: {{confidence}}\n\nDescription: {{description}}\n\n' +
        'Related concepts:\n{{relatedConcepts}}\n\nEvidence sources:\n{{evidenceSources}}\n\n' +
        'Part of these collections:\n{{collections}}',
    },
  ],
})
