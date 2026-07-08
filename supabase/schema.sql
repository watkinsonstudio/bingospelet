-- ============================================================================
-- Föreningens Sommarbingo – Supabase-schema
-- ============================================================================
-- Speglar domänmodellen i src/data/types.ts. Kör i Supabase SQL Editor för att
-- skapa databasen. Se sedan README (avsnitt "Koppla mot Supabase") för hur man
-- byter ut den lokala repository-implementationen.
--
-- Datamodell (spec avsnitt 3):
--   clubs → teams → players
--   weeks (delade på klubbnivå) → tasks (25 rutor)
--   entries (en spelares avklarade ruta, med nivå + tidsstämpel)
--   team_settings (t.ex. sommarfinalen upplåst)
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tabeller
-- ---------------------------------------------------------------------------

create table if not exists clubs (
  id   uuid primary key default gen_random_uuid(),
  name text not null
);

create table if not exists teams (
  id        uuid primary key default gen_random_uuid(),
  club_id   uuid not null references clubs (id) on delete cascade,
  name      text not null,
  join_code text not null unique
);

create table if not exists players (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references teams (id) on delete cascade,
  first_name text not null,
  color      text not null default '#2563eb',
  role       text not null default 'player' check (role in ('player', 'coach'))
  -- Medvetet inga person-/kontaktuppgifter (GDPR-snålt, spec avsnitt 2).
);

create table if not exists weeks (
  id          uuid primary key default gen_random_uuid(),
  -- team_id null = veckan delas på klubbnivå (gemensamt bibliotek, spec avsnitt 8).
  team_id     uuid references teams (id) on delete cascade,
  club_id     uuid not null references clubs (id) on delete cascade,
  week_number int  not null,
  theme       text not null,
  date_range  text not null default '',
  status      text not null default 'upcoming' check (status in ('upcoming', 'active', 'archived'))
);

create table if not exists tasks (
  id                uuid primary key default gen_random_uuid(),
  week_id           uuid not null references weeks (id) on delete cascade,
  cell_index        int  not null check (cell_index between 0 and 24), -- 12 = FRI
  title             text not null,
  level_easy_text   text,
  level_medium_text text,
  level_hard_text   text,
  animation_url     text,
  unique (week_id, cell_index)
);

create table if not exists entries (
  id           uuid primary key default gen_random_uuid(),
  week_id      uuid not null references weeks (id) on delete cascade,
  player_id    uuid not null references players (id) on delete cascade,
  cell_index   int  not null check (cell_index between 0 and 24),
  level        text not null check (level in ('L', 'M', 'S')),
  completed_at timestamptz not null default now(),
  -- Högst en aktiv entry per spelare/ruta/vecka – byte av nivå uppdaterar raden.
  unique (week_id, player_id, cell_index)
);

create table if not exists team_settings (
  team_id           uuid primary key references teams (id) on delete cascade,
  final_unlocked_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Index
-- ---------------------------------------------------------------------------
create index if not exists idx_players_team on players (team_id);
create index if not exists idx_weeks_club on weeks (club_id, status);
create index if not exists idx_tasks_week on tasks (week_id);
create index if not exists idx_entries_week on entries (week_id);
create index if not exists idx_entries_player on entries (player_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- OBS: Appen har ingen inloggning med lösenord (spelarna är minderåriga och
-- väljer bara sitt namn). Policyerna nedan är därför öppna för anon-nyckeln och
-- passar en demo/intern förening. Öppen fråga i spec avsnitt 8: coach-rollen kan
-- inte skyddas på serversidan utan en riktig auth-lösning – lägg till det innan
-- publik drift om det behövs.

alter table clubs         enable row level security;
alter table teams         enable row level security;
alter table players       enable row level security;
alter table weeks         enable row level security;
alter table tasks         enable row level security;
alter table entries       enable row level security;
alter table team_settings enable row level security;

do $$
declare t text;
begin
  foreach t in array array['clubs','teams','players','weeks','tasks','entries','team_settings']
  loop
    execute format('drop policy if exists %I on %I;', t || '_all', t);
    execute format(
      'create policy %I on %I for all to anon, authenticated using (true) with check (true);',
      t || '_all', t
    );
  end loop;
end $$;
