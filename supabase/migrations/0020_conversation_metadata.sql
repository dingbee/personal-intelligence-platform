-- UX-13.6 Phase 3 (continued): future-proofs conversation metadata in one
-- migration instead of adding pinned/favorite now and color/icon later.
-- is_pinned/favorite ship with UI this phase; color/icon are additive
-- columns with no UI yet (deliberately unused until a later phase needs
-- them) — exactly the "don't accumulate migrations" tradeoff requested.
alter table public.conversations
  add column is_pinned boolean not null default false,
  add column favorite boolean not null default false,
  add column color text null,
  add column icon text null;
