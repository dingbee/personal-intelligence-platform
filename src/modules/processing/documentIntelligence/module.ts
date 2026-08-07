import { registerPlatformModule } from '@/modules/core/modules/registerPlatformModule'

/**
 * Multimodal Intelligence v1 — Document Intelligence: one capability,
 * registered the same registerPlatformModule way knowledge-intelligence's
 * extract-concepts/extract-entities are (see that module.ts). Pure text
 * classification/extraction over content the pipeline already produces —
 * no provider/AI-runtime change needed, unlike the image-analysis half of
 * this phase.
 */
registerPlatformModule({
  id: 'document-intelligence',
  name: 'Document Intelligence',
  capabilities: [
    {
      id: 'analyze-document-intelligence',
      label: 'Analyze Document Intelligence',
      description: 'Classify a document and extract its dates, decisions, and tasks.',
    },
  ],
  prompts: [
    {
      id: 'analyze-document-intelligence@1.0',
      capabilityId: 'analyze-document-intelligence',
      version: '1.0',
      active: true,
      template:
        'Analyze the following document. Respond with ONLY a JSON object (no markdown code fences, no other text) shaped exactly like:\n' +
        '{"documentType": "a short label such as business plan, contract, meeting notes, report, or other", ' +
        '"dates": [{"label": "what this date is for", "date": "the date as written in the text"}], ' +
        '"decisions": ["decisions explicitly made or recorded in the text"], ' +
        '"tasks": [{"description": "a task or action item", "owner": "who is responsible, or null if not stated"}]}\n\n' +
        'Only include items explicitly present in the text — use empty arrays where nothing applies. Do not infer or invent content.\n\n' +
        'Content:\n{{content}}',
    },
  ],
})
