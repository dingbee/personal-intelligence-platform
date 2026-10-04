import type { VerticalIntelligenceDefinition } from './types'

export const staynasIntelligence: VerticalIntelligenceDefinition = {
  id: 'staynas',
  name: 'StayNas',
  description: 'Hospitality intelligence for guest experience, operations, revenue, and executive decisions.',
  entities: [
    { id: 'guest', label: 'Guest', description: 'Guest identity, preferences, journey, and relationship context.' },
    { id: 'reservation', label: 'Reservation', description: 'Reservation, stay, arrival, departure, and booking context.' },
    { id: 'room', label: 'Room', description: 'Room inventory, occupancy, status, and operational context.' },
    { id: 'property', label: 'Property', description: 'Property-level commercial and operational context.' },
  ],
  signals: [
    { id: 'guest-risk', label: 'Guest Risk', description: 'Signals indicating service, retention, or experience risk.', entityIds: ['guest', 'reservation'] },
    { id: 'occupancy-pressure', label: 'Occupancy Pressure', description: 'Signals indicating changing occupancy and room demand.', entityIds: ['room', 'property'] },
    { id: 'operational-exception', label: 'Operational Exception', description: 'Signals indicating unresolved property operations issues.', entityIds: ['room', 'reservation'] },
  ],
  agents: [
    { id: 'staynas-guest-intelligence', name: 'Guest Intelligence Agent', description: 'Understands guest context and recommends service actions.', intelligenceKind: 'guest', capabilities: ['guest-context', 'experience-analysis', 'service-recommendation'], allowedTools: ['guest-data', 'reservation-data', 'knowledge'], autonomy: 'recommend' },
    { id: 'staynas-operations-intelligence', name: 'Operations Intelligence Agent', description: 'Detects operational exceptions and coordinates recommended responses.', intelligenceKind: 'operations', capabilities: ['exception-detection', 'operations-analysis', 'task-preparation'], allowedTools: ['operations-data', 'tasks', 'knowledge'], autonomy: 'prepare' },
    { id: 'staynas-revenue-intelligence', name: 'Revenue Intelligence Agent', description: 'Analyses demand, occupancy, and revenue signals.', intelligenceKind: 'revenue', capabilities: ['demand-analysis', 'occupancy-analysis', 'revenue-recommendation'], allowedTools: ['property-data', 'revenue-data', 'knowledge'], autonomy: 'recommend' },
    { id: 'staynas-executive-intelligence', name: 'Executive Intelligence Agent', description: 'Synthesises property intelligence into executive decisions and actions.', intelligenceKind: 'executive', capabilities: ['executive-summary', 'cross-domain-analysis', 'decision-support'], allowedTools: ['intelligence-ledger', 'property-data', 'knowledge'], autonomy: 'recommend' },
  ],
}
