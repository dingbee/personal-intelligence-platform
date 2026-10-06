# ARRIYIA V2-02 — Enterprise Space Lifecycle

## Objective

Turn the V2 Space model from an in-memory foundation into a persistent, entitlement-aware operating context.

## Implemented

- Persistent ARRIYIA Business Spaces reuse the existing `workspaces` table and `workspace_members` substrate.
- Personal Space remains identity-scoped and synthetic in the V2 shell.
- Business Space is Enterprise-only.
- Database enforcement checks active Enterprise entitlement before a Business Space can be created or activated.
- One owned Business Space per identity is enforced by a partial unique index.
- Business Space membership uses the existing owner/editor/viewer membership model.
- Existing invitation and membership flows therefore remain the canonical collaboration path.
- Space switching loads persistent Business Spaces from Supabase; no `localStorage` is introduced.
- Business Space lifecycle states: `active`, `paused`, `archived`.
- Paused Spaces remain selectable for lifecycle management but are not treated as active execution contexts.
- Loss of Enterprise entitlement automatically pauses active Business Spaces with `v2_pause_reason = 'entitlement'`.
- Restoration of Enterprise entitlement automatically reactivates Spaces paused specifically by entitlement loss.
- Manual pauses are distinguished from entitlement pauses and are not silently auto-restored.
- Archived Spaces are removed from the active V2 switcher.
- The Business Space has a stable `v2_organization_id` used as the tenant namespace for the NoVA Core integration boundary.

## Architectural decision

V2-02 does **not** introduce a second organizations/membership system.

The existing workspace/membership infrastructure already provides:

`identity → workspace → membership/role → RLS`

V2 adds:

`identity → Personal Space`
`identity → Enterprise entitlement → Business Space → membership/role`

The Business Space's `v2_organization_id` is the tenant namespace that will be supplied to NoVA Core. V2-02 deliberately avoids introducing a separate `organizations` entity before a concrete requirement exists for organization-level resources independent of the Space.

## Entitlement rule

Enterprise access is authoritative at the database boundary.

The UI may expose the creation flow only to an entitled user, but the database independently verifies an active `user_plan_assignments` row whose plan resolves to `plans.code = 'enterprise'`.

Therefore a forged client request cannot create or reactivate an Enterprise Business Space without entitlement.

## Lifecycle

### Create

1. User has Enterprise entitlement.
2. User creates Business Space.
3. Database validates entitlement.
4. Existing workspace-owner trigger creates the owner membership.
5. Space becomes available in the V2 switcher.

### Switch

1. V2 shell loads Business Spaces visible through workspace RLS.
2. Active membership is resolved for the signed-in identity.
3. The selected Space becomes the V2 operating context.
4. No V1 workspace selector or `localStorage` state is involved.

### Pause

Owner may manually pause a Business Space. A cancelled/expired Enterprise entitlement pauses active Business Spaces automatically with an entitlement pause reason.

### Resume

Owner can resume a paused Space only while Enterprise entitlement remains valid.

### Archive

Owner can archive a Business Space. Archived Spaces are excluded from the active V2 switcher.

## NoVA Core boundary

ARRIYIA V2 owns identity context, Space selection, Enterprise entitlement, Space membership and product UX.

NoVA Core owns plugin registration, capability negotiation, agent/workflow runtime, tool execution and execution authorization.

The Business Space's `v2_organization_id` is the context identifier passed across that boundary. No NoVA runtime has been moved into ARRIYIA.

## Acceptance criteria

- [x] Business Space persists across reloads.
- [x] Personal and Business contexts are distinct.
- [x] Business Space is Enterprise-only at the database boundary.
- [x] Business Space membership is not ownership-only.
- [x] Existing invitation/member infrastructure remains authoritative.
- [x] One owned Business Space per identity.
- [x] Pause/resume/archive lifecycle implemented.
- [x] Entitlement loss pauses Business Space automatically.
- [x] Entitlement restoration can reactivate entitlement-paused Business Space.
- [x] No `localStorage` dependency introduced.
- [x] No StayNas, LexiBite, or KATBOD dependency introduced.
- [x] No NoVA Core runtime embedded in ARRIYIA.
- [ ] Live Supabase migration/security certification.
- [ ] Branch CI gate green on the final V2-02 head.