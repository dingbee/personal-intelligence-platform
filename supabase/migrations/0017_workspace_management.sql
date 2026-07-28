-- Phase UX-2: Workspace Management. Two additive columns only — everything
-- else the phase needs (rename, delete, per-workspace stats, "hide from
-- switcher" scoping) is already expressible with the existing schema and
-- the `on delete set null` FKs already in place on every workspace_id
-- column (deleting a workspace has never deleted its content; it orphans
-- it into the unscoped "All" view).

alter table public.workspaces
  add column archived_at timestamptz,
  add column sort_order integer not null default 0;

-- Backfill existing rows with a stable per-user order so the switcher's
-- item order doesn't jump around the first time this ships (previously
-- always alphabetical; sort_order now drives display order everywhere).
with ordered as (
  select id, row_number() over (partition by user_id order by created_at asc) - 1 as rn
  from public.workspaces
)
update public.workspaces
set sort_order = ordered.rn
from ordered
where public.workspaces.id = ordered.id;
