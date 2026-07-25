-- Milestone 4.5: AI governance & observability — logging infrastructure,
-- not a feature. Every provider call (chat completion, embedding) gets
-- logged here so usage/cost/failures are debuggable without re-deriving
-- them from application logs.

create type ai_request_status as enum ('success', 'error');

create table public.ai_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  -- Which platform feature triggered this call, e.g. 'chat', 'retrieval', 'processing'.
  feature text not null,
  provider text not null,
  model text,
  tokens_input int,
  tokens_output int,
  latency_ms int not null,
  status ai_request_status not null,
  error_message text,
  created_at timestamptz not null default now()
);

create index ai_requests_user_id_idx on public.ai_requests (user_id);
create index ai_requests_created_at_idx on public.ai_requests (created_at desc);

alter table public.ai_requests enable row level security;

-- Append-only from the client: users can log and view their own requests,
-- but never edit or delete them — this is meant to be a trustworthy record.
create policy "Users view their own AI requests"
  on public.ai_requests for select
  using (auth.uid() = user_id);

create policy "Users insert their own AI requests"
  on public.ai_requests for insert
  with check (auth.uid() = user_id);
