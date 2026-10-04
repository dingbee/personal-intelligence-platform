# ARRIYIA V2

V2 is the enterprise intelligence and execution control plane built on the V1 foundation.

## Release-candidate checkpoint

**V2-14 — Governance & Enterprise Control — implementation complete**

### V2 gates complete
- V2-01 Foundation
- V2-02 Enterprise Workspace
- V2-03 Command Centre
- V2-04 Intelligence Centre
- V2-05 Knowledge + Memory
- V2-06 Agent Management
- V2-07 Workflow Studio
- V2-08 NoVA Core Runtime Contract
- V2-09 Governance + Security
- V2-10 Learning Loop
- V2-11 Integrations
- V2-12 Vertical Intelligence
- V2-13 Bounded Autonomy
- V2-14 Governance & Enterprise Control

## Working branch

`v2-development`

## Production branch

`main`

## Preview

V2 work is preview-only on `v2-development`. Production `main` remains the V1 baseline.

## Safety

V2 preview work must not modify the V1 production Supabase schema or deploy to V1 Production.

## Certification status

- Control-plane architecture: complete
- Workspace and tenant isolation: complete
- Agent/workflow contract validation: complete
- Vertical intelligence boundaries: complete
- Bounded autonomy evaluation: complete
- Governance authorization envelope: complete
- NoVA runtime validation boundary: complete
- Final release certification: **in progress**
- Production promotion: **not permitted**

## Release rule

The V2 release candidate is not considered certified until the engineering audit, automated test suite, Preview build, critical-path verification and V1 isolation checks are all green.
