# V2-12 Vertical Intelligence

V2-12 establishes the domain-intelligence contract without coupling vertical products to the ARRIYIA UI or execution runtime.

## Boundary

- **ARRIYIA** owns vertical definitions, governance, context contracts, agent configuration, and intelligence presentation.
- **NoVA Core** owns durable agent/workflow/tool execution through the V2-08 contract boundary.
- **StayNas** and **LexiBite** remain independently deployable products.
- Vertical intelligence must not require a production Supabase schema change during this checkpoint.

## Initial verticals

### StayNas
Guest, operations, revenue, and executive intelligence.

### LexiBite
Inventory, procurement, sales, operations, revenue, and executive intelligence.

## Autonomy boundary

Vertical agents declare a maximum autonomy level. Runtime execution must still pass through governance and the NoVA contract boundary; this definition is not an execution bypass.

## V2-12 sequence

1. Establish vertical contract.
2. Register initial verticals.
3. Surface vertical catalogue in the V2 workspace.
4. Connect agents to authorised context and tool contracts.
5. Verify governance, isolation, and execution boundaries.
6. E2E certify before V2-13.
