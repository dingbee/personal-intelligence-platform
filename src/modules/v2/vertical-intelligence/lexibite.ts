import type { VerticalIntelligenceDefinition } from './types'

export const lexibiteIntelligence: VerticalIntelligenceDefinition = {
  id: 'lexibite',
  name: 'LexiBite',
  description: 'Restaurant and bar intelligence for inventory, procurement, sales, operations, revenue, and executive decisions.',
  entities: [
    { id: 'property', label: 'Property', description: 'Restaurant or bar property and outlet context.' },
    { id: 'order', label: 'Order', description: 'Guest order, table, service, payment, and fulfilment context.' },
    { id: 'menu-item', label: 'Menu Item', description: 'Menu item, recipe, pricing, and sales context.' },
    { id: 'stock-item', label: 'Stock Item', description: 'Inventory item, units, balances, movements, and consumption context.' },
    { id: 'supplier', label: 'Supplier', description: 'Supplier, purchasing, receiving, and procurement context.' },
  ],
  signals: [
    { id: 'stock-risk', label: 'Stock Risk', description: 'Signals indicating depletion, variance, or replenishment risk.', entityIds: ['stock-item', 'menu-item'] },
    { id: 'procurement-pressure', label: 'Procurement Pressure', description: 'Signals indicating purchasing requirements or supplier issues.', entityIds: ['stock-item', 'supplier'] },
    { id: 'sales-shift', label: 'Sales Shift', description: 'Signals indicating material changes in item or service-period sales.', entityIds: ['order', 'menu-item'] },
    { id: 'operations-exception', label: 'Operations Exception', description: 'Signals indicating unresolved service, kitchen, table, or fulfilment issues.', entityIds: ['order', 'property'] },
  ],
  agents: [
    { id: 'lexibite-inventory-intelligence', name: 'Inventory Intelligence Agent', description: 'Reads stock, analyses consumption, forecasts requirements, and prepares replenishment decisions.', intelligenceKind: 'inventory', capabilities: ['stock-analysis', 'consumption-analysis', 'demand-forecast', 'replenishment-recommendation'], allowedTools: ['stock-ledger', 'recipes', 'orders', 'purchasing'], autonomy: 'prepare' },
    { id: 'lexibite-procurement-intelligence', name: 'Procurement Intelligence Agent', description: 'Analyses purchasing requirements and supplier context.', intelligenceKind: 'procurement', capabilities: ['purchase-analysis', 'supplier-analysis', 'po-preparation'], allowedTools: ['inventory', 'suppliers', 'purchase-orders'], autonomy: 'prepare' },
    { id: 'lexibite-sales-intelligence', name: 'Sales Intelligence Agent', description: 'Analyses orders, menu performance, and service-period sales.', intelligenceKind: 'sales', capabilities: ['sales-analysis', 'menu-performance', 'trend-detection'], allowedTools: ['orders', 'menu', 'payments'], autonomy: 'recommend' },
    { id: 'lexibite-operations-intelligence', name: 'Restaurant Operations Agent', description: 'Detects operational exceptions and prepares bounded service actions.', intelligenceKind: 'operations', capabilities: ['service-monitoring', 'exception-detection', 'action-preparation'], allowedTools: ['orders', 'tables', 'kitchen', 'tasks'], autonomy: 'prepare' },
    { id: 'lexibite-revenue-intelligence', name: 'Revenue Intelligence Agent', description: 'Analyses revenue, demand, pricing, and outlet performance.', intelligenceKind: 'revenue', capabilities: ['revenue-analysis', 'demand-analysis', 'performance-recommendation'], allowedTools: ['orders', 'payments', 'menu', 'property-data'], autonomy: 'recommend' },
    { id: 'lexibite-executive-intelligence', name: 'Executive Intelligence Agent', description: 'Synthesises restaurant intelligence into executive decisions and actions.', intelligenceKind: 'executive', capabilities: ['executive-summary', 'cross-domain-analysis', 'decision-support'], allowedTools: ['intelligence-ledger', 'property-data', 'inventory', 'sales'], autonomy: 'recommend' },
  ],
}
