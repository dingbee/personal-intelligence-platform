-- UX-13.9 (Visual Knowledge): assets need a display title for cards, the
-- reader page, title search, and "Save to Notes" — the same role
-- documents.title already plays. Not nullable (defaults to '' so existing
-- rows aren't blocked, then set from the filename at upload time going
-- forward), matching documents.title's own not-null contract.

alter table public.assets add column title text not null default '';
