-- Phase UX-5.3A: Memory Control Plane. Only is_active — confidence/
-- status/approved_at/last_used_at are UX-5.3B concerns (AI-suggested
-- candidates need scoring/approval/expiry; nothing generates those yet,
-- so adding the columns now would be unused scaffolding). Lets a user
-- disable an individual memory or a whole category (memory_type) without
-- deleting it — retrieveMemoryContext/listMemories default to active-only,
-- so a disabled memory stops influencing chat immediately but stays
-- recoverable.
alter table public.ai_memory
  add column is_active boolean not null default true;
