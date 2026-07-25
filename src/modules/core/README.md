# Core: platform extensibility

Registries + a module-registration mechanism so domain-specific features
(Education, Writing, Research, News, Business, ...) can be added later
without modifying this code or the AI engine.

## The pattern

1. `registry.ts` — a generic `createRegistry<T>()` (register/get/list/has),
   reused for every registry below instead of writing the same Map-backed
   plumbing four times.
2. Four registries, one per extension point:
   - `capabilities/` — named AI operations (Summarize, Quiz, Translate, ...)
   - `prompts/` — prompt templates tied to a capability
   - `providers/` — pluggable AI provider descriptors (metadata only — see
     `modules/ai/embeddings` and `modules/ai/retrieval` for the actual
     provider *implementations*)
   - `workflows/` — named sequences of capabilities
3. `modules/types.ts` — a `PlatformModule` declares what it contributes.
   `modules/registerPlatformModule.ts` pushes those arrays into the
   registries above, stamping each item with the module's id.
4. `modules/coreModule.ts` — the built-in module, registered once at app
   startup (imported for its side effect from `app/App.tsx`). It exists as
   a worked example: a domain module added later follows the exact same
   shape.

## Adding a domain module later

```ts
// modules/education/module.ts
registerPlatformModule({
  id: 'education',
  name: 'Education',
  capabilities: [
    { id: 'lesson-plan', label: 'Lesson Plan', description: '...' },
    { id: 'exam', label: 'Exam', description: '...' },
  ],
})
```

Import it once (its side effect) alongside `coreModule` in `app/App.tsx`.
Nothing else in the codebase needs to know it exists — the registries are
the only seam.

## What this milestone deliberately does not do

No capability actually executes anything yet. There's no AI provider wired
up until a later milestone, so a `run()`/execution field on `AICapability`
would just be a fake shell with nothing behind it. When a real provider
lands, execution should resolve capability -> prompt template -> provider,
never branch on document type or feature name in application code — that's
the whole reason these registries exist.
