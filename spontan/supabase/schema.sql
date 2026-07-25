-- ============================================================================
-- Spontan – Supabase-schema
-- ============================================================================
-- Speglar domänmodellen i src/data/types.ts. Kör i Supabase SQL Editor för att
-- skapa databasen. Se sedan README (avsnitt "Koppla mot Supabase") för hur man
-- byter ut den lokala repository-implementationen.
--
-- Datamodell:
--   areas → people, venues
--   sessions (ett pass: typ, plats, tid, minsta antal) → signups (ja/kanske/nej)
--   intents (sugen-status: vad + ungefär när, med utgångsdatum)
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tabeller
-- ---------------------------------------------------------------------------

create table if not exists areas (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  join_code text not null unique
);

create table if not exists people (
  id              uuid primary key default gen_random_uuid(),
  area_id         uuid not null references areas (id) on delete cascade,
  name            text not null,
  color           text not null default '#1f7a4d',
  favorite_types  text[] not null default '{}',
  created_at      timestamptz not null default now()
);

create table if not exists venues (
  id      uuid primary key default gen_random_uuid(),
  area_id uuid not null references areas (id) on delete cascade,
  name    text not null,
  surface text not null check (surface in ('gras', 'konstgras', 'grus', 'inomhus', 'asfalt')),
  note    text
);

create table if not exists sessions (
  id           uuid primary key default gen_random_uuid(),
  area_id      uuid not null references areas (id) on delete cascade,
  host_id      uuid not null references people (id) on delete cascade,
  type         text not null check (type in ('match', 'spontan', 'teknik', 'kondition', 'malvakt', 'annat')),
  venue_id     uuid not null references venues (id) on delete restrict,
  starts_at    timestamptz not null,
  duration_min int  not null default 60 check (duration_min > 0),
  min_players  int  not null default 2 check (min_players > 0),
  max_players  int  check (max_players is null or max_players >= min_players),
  vibe         text not null default 'alla' check (vibe in ('alla', 'lugnt', 'tavling')),
  note         text,
  status       text not null default 'open' check (status in ('open', 'cancelled')),
  created_at   timestamptz not null default now()
);

create table if not exists signups (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  person_id  uuid not null references people (id) on delete cascade,
  status     text not null check (status in ('ja', 'kanske', 'nej')),
  created_at timestamptz not null default now(),
  -- Ett svar per person och pass. Byte av svar är en uppdatering, så att
  -- köordningen (created_at) inte nollställs när någon ändrar sig fram och åter.
  unique (session_id, person_id)
);

create table if not exists intents (
  id         uuid primary key default gen_random_uuid(),
  person_id  uuid not null references people (id) on delete cascade,
  area_id    uuid not null references areas (id) on delete cascade,
  types      text[] not null default '{}',
  -- 0 = söndag … 6 = lördag. Tom array = alla dagar.
  weekdays   int[]  not null default '{}',
  dayparts   text[] not null default '{}',
  note       text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  -- En aktiv sugen-status per person; appen ersätter den befintliga.
  unique (person_id)
);

-- ---------------------------------------------------------------------------
-- Index
-- ---------------------------------------------------------------------------

create index if not exists sessions_area_start_idx on sessions (area_id, starts_at);
create index if not exists signups_session_idx    on signups (session_id);
create index if not exists intents_area_idx       on intents (area_id, expires_at);

-- ---------------------------------------------------------------------------
-- Städning
-- ---------------------------------------------------------------------------
-- Utgångna sugen-status filtreras bort i domänlogiken, men kan även rensas i
-- databasen (t.ex. via ett schemalagt jobb):
--
--   delete from intents where expires_at < now() - interval '30 days';

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
-- Utkastet kör helt lokalt och behöver ingen RLS. Innan appen driftas publikt
-- måste den frågan lösas ordentligt: idag finns ingen riktig autentisering,
-- bara en områdeskod. Ett rimligt första steg är Supabase Auth (magisk länk
-- eller anonym session) + policyer i stil med:
--
--   alter table sessions enable row level security;
--   create policy "läs pass i mitt område" on sessions for select
--     using (area_id in (select area_id from people where id = auth.uid()));
--   create policy "ändra egna pass" on sessions for update
--     using (host_id = auth.uid());
