-- ============================================================
-- TS-Suite: Migration Kundenstamm + Fremdsystem-Import (gevis)
-- Idempotent: kann gefahrlos mehrfach ausgeführt werden.
-- Reihenfolge: 1) kunden-Tabelle  2) Verknüpfung kontakte
--              3) Backfill aus kontakte.kunde  4) Import-Helfer
-- ============================================================

-- ------------------------------------------------------------
-- 1) Kundenstammtabelle (Master innerhalb der TS-Suite)
-- ------------------------------------------------------------
create table if not exists kunden (
  id               bigint generated always as identity primary key,
  name             text not null,
  strasse          text,
  plz              text,
  ort              text,
  telefon          text,
  email            text,
  notizen          text,
  -- Rohdaten aus dem Backfill (kombiniertes Feld aus kontakte.kunde),
  -- zur manuellen Nachpflege. Kann nach Bereinigung geleert werden.
  adresse_roh      text,
  -- Fremdsystem-Herkunft (null = manuell in der TS-Suite angelegt)
  extern_system    text,
  extern_id        text,
  verwaltet_von    text generated always as (
                     coalesce(extern_system, 'ts-suite')
                   ) stored,
  erstellt_am      timestamptz not null default now(),
  aktualisiert_am  timestamptz not null default now()
);

-- Falls die Tabelle schon existiert (frühere CRM-Migration):
-- fehlende Spalten nachziehen, ohne Bestehendes anzufassen.
alter table kunden add column if not exists strasse         text;
alter table kunden add column if not exists plz             text;
alter table kunden add column if not exists ort             text;
alter table kunden add column if not exists telefon         text;
alter table kunden add column if not exists email           text;
alter table kunden add column if not exists notizen         text;
alter table kunden add column if not exists adresse_roh     text;
alter table kunden add column if not exists extern_system   text;
alter table kunden add column if not exists extern_id       text;
alter table kunden add column if not exists erstellt_am     timestamptz not null default now();
alter table kunden add column if not exists aktualisiert_am timestamptz not null default now();

-- verwaltet_von nur anlegen, wenn noch nicht vorhanden
-- (generierte Spalten lassen sich nicht per IF NOT EXISTS ändern)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'kunden' and column_name = 'verwaltet_von'
  ) then
    alter table kunden add column verwaltet_von text
      generated always as (coalesce(extern_system, 'ts-suite')) stored;
  end if;
end $$;

-- Eindeutigkeit pro Fremdsystem-Kunde (nur wenn Herkunft gesetzt ist).
-- Manuelle Kunden (extern_system null) sind davon nicht betroffen.
create unique index if not exists kunden_extern_uidx
  on kunden (extern_system, extern_id)
  where extern_system is not null;

-- Suche nach Namen (Autovervollständigung, Duplikat-Prüfung)
create index if not exists kunden_name_idx on kunden (lower(name));

-- aktualisiert_am automatisch pflegen
create or replace function set_aktualisiert_am()
returns trigger language plpgsql as $$
begin
  new.aktualisiert_am := now();
  return new;
end $$;

drop trigger if exists trg_kunden_aktualisiert on kunden;
create trigger trg_kunden_aktualisiert
  before update on kunden
  for each row execute function set_aktualisiert_am();

-- ------------------------------------------------------------
-- 2) Verknüpfung: Bauvorhaben (kontakte) -> Kunde (1:n)
--    Additiv, bestehende Struktur bleibt unangetastet.
-- ------------------------------------------------------------
alter table kontakte add column if not exists kunde_id bigint;

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'kontakte_kunde_id_fkey'
  ) then
    alter table kontakte
      add constraint kontakte_kunde_id_fkey
      foreign key (kunde_id) references kunden(id)
      on delete set null;
  end if;
end $$;

create index if not exists kontakte_kunde_id_idx on kontakte (kunde_id);

-- ------------------------------------------------------------
-- 3) Backfill: Kunden aus bestehenden kontakte-Zeilen ableiten
--    kontakte.kunde enthält Name + Adresse kombiniert.
--    Konservative Regel: erste Zeile bzw. Teil vor dem ersten
--    Komma = Name, Originaltext komplett nach adresse_roh.
--    Gleiche Namen werden zu EINEM Kunden zusammengefasst.
-- ------------------------------------------------------------
with quelle as (
  select
    bauvorhaben,
    kunde,
    trim(split_part(split_part(kunde, E'\n', 1), ',', 1)) as kunden_name
  from kontakte
  where kunde is not null
    and trim(kunde) <> ''
    and kunde_id is null
),
eindeutige as (
  select distinct on (lower(kunden_name))
    kunden_name,
    kunde as roh
  from quelle
  where kunden_name <> ''
  order by lower(kunden_name), roh
),
eingefuegt as (
  insert into kunden (name, adresse_roh)
  select e.kunden_name, e.roh
  from eindeutige e
  where not exists (
    select 1 from kunden k where lower(k.name) = lower(e.kunden_name)
  )
  returning id, name
)
update kontakte kt
set kunde_id = k.id
from quelle q
join kunden k on lower(k.name) = lower(q.kunden_name)
where kt.bauvorhaben = q.bauvorhaben
  and kt.kunde_id is null;

-- ------------------------------------------------------------
-- 4) Import-Helfer für gevis (und künftige Fremdsysteme)
--    Aufruf pro Datensatz aus dem Import-Tool. Feldhoheit:
--    Fremdsystem überschreibt NUR die Felder, die es liefert
--    (null-Werte im Import lassen Bestehendes unangetastet).
-- ------------------------------------------------------------
create or replace function import_kunde(
  p_extern_system text,
  p_extern_id     text,
  p_name          text,
  p_strasse       text default null,
  p_plz           text default null,
  p_ort           text default null,
  p_telefon       text default null,
  p_email         text default null
) returns bigint language plpgsql as $$
declare
  v_id bigint;
begin
  insert into kunden (name, strasse, plz, ort, telefon, email,
                      extern_system, extern_id)
  values (p_name, p_strasse, p_plz, p_ort, p_telefon, p_email,
          p_extern_system, p_extern_id)
  on conflict (extern_system, extern_id) where extern_system is not null
  do update set
    name    = excluded.name,
    strasse = coalesce(excluded.strasse, kunden.strasse),
    plz     = coalesce(excluded.plz,     kunden.plz),
    ort     = coalesce(excluded.ort,     kunden.ort),
    telefon = coalesce(excluded.telefon, kunden.telefon),
    email   = coalesce(excluded.email,   kunden.email)
  returning id into v_id;

  return v_id;
end $$;

-- ------------------------------------------------------------
-- 5) Import-Protokoll (Nachvollziehbarkeit pro Lauf)
-- ------------------------------------------------------------
create table if not exists import_laeufe (
  id             bigint generated always as identity primary key,
  quelle         text not null,          -- z.B. 'gevis-csv'
  dateiname      text,
  anzahl_neu     integer default 0,
  anzahl_update  integer default 0,
  anzahl_fehler  integer default 0,
  fehler_details jsonb,
  gestartet_am   timestamptz not null default now(),
  beendet_am     timestamptz
);

-- ------------------------------------------------------------
-- Kontrollabfragen nach der Migration (manuell ausführen):
--
-- select count(*) from kunden;
-- select count(*) from kontakte where kunde_id is null;
-- select name, adresse_roh from kunden
--   where extern_system is null order by name limit 50;
-- ============================================================
