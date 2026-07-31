-- UX-13.5B: Conversation Persistence Layer. Null = active/visible (the
-- current, only-ever behavior); set = archived — hidden from the default
-- conversation list but fully recoverable, restoring it to active. Mirrors
-- workspaces.archived_at exactly (same nullable-timestamp pattern, same
-- meaning). deleteConversation() remains a real, unrecoverable DELETE —
-- archive and delete stay two distinct, deliberate user actions rather
-- than one soft-delete flag trying to mean both.
alter table public.conversations
  add column archived_at timestamptz null;
