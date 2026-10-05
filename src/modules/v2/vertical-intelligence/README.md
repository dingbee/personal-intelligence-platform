# V2 Vertical Contract Boundary

ARRIYIA V2 is a control plane. It does not own StayNas, LexiBite, KATBOD, or any other vertical product implementation.

## Ownership

- **ARRIYIA:** workspace-scoped intelligence control, agent configuration, governance, authorization, approval and delegation.
- **Vertical product:** domain entities, signals, agent definitions, tool contracts and domain intelligence implementation.
- **NoVA Core:** runtime planning, orchestration, tool execution, workers, retries and consequential execution.
- **External systems:** the actual vertical/product systems acted upon by NoVA Core.

## Contract rule

A vertical publishes a generic `VerticalRegistration` containing its identity, contract version, capabilities, domain declarations, agent declarations, governance requirements and execution authority.

ARRIYIA consumes that contract; it does not compile a concrete vertical into the application bundle.

## Invariants

1. No product-specific vertical IDs are hard-coded into the V2 type system.
2. No StayNas/LexiBite intelligence definitions ship inside ARRIYIA.
3. No vertical-product registration occurs at application startup.
4. Consequential actions remain approval-gated.
5. V2 bindings always declare `executionAuthority: 'nova-core'`.
6. V2 bindings never enable execution.
7. The V2 UI does not present vertical products as ARRIYIA modules.

## Runtime boundary

```
Vertical product
      │ publishes contract
      ▼
ARRIYIA
  authorize / govern / delegate
      │
      ▼
NoVA Core
  plan / orchestrate / execute
      │
      ▼
Vertical system / external tools
```

This boundary must be certified before V2-15 or additional runtime capability work proceeds.
