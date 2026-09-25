-- À exécuter dans Supabase → SQL Editor

create table if not exists runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  account text not null,
  status text not null check (status in ('booked', 'not_found', 'error', 'dry_run')),
  target_date date,
  hour smallint,
  location text,
  court text,
  address text,
  message text
);
create index if not exists runs_created_at_idx on runs (created_at desc);

-- L'app utilise uniquement la clé service_role côté serveur :
-- RLS sans politique bloque tout accès via la clé anon.
alter table runs enable row level security;
