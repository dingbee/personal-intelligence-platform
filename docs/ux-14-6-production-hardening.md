# UX-14.6 Production Hardening

Scope: accessibility, user-facing state consistency, usage/notification language, copy interaction consistency, and PWA polish. Existing intelligence, billing, Reader, Chat viewport, Google Drive, and PWA installability behavior are treated as regression-sensitive and are not redesigned here.

## Hardening rules

- Usage is expressed as normal / warning (>=75%) / critical (>=90%) / exhausted (>=100%).
- Notification types are never exposed as raw internal identifiers.
- Touch targets should be at least 44px where practical.
- Existing copy controls remain behaviorally unchanged; this pass standardizes language rather than introducing another clipboard system.
- Existing PWA install/offline behavior remains unchanged; branding and manifest work from the post-freeze branding commit remain authoritative.
- No autonomous action, new intelligence engine, schema, or provider path is introduced.

## Release gates

1. Typecheck
2. Lint
3. Targeted UX-14.6 tests
4. Full regression suite, with pre-existing AIService timeout debt explicitly isolated if still present
5. Production build
6. Bundle verification
7. Vercel deployment check
8. Manual authenticated smoke test on Android, iOS, desktop, Reader, Chat, notifications, and usage-limit states
