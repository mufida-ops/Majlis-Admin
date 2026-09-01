-- Tarbiya - Phase 1 schema
--
-- Phase 1 is deliberately scoped to ONE lesson run at a time, with no auth,
-- no multi-teacher accounts, and no rosters (see docs/architecture.md
-- section 9 - explicitly out of scope for Phase 1). This table stores a
-- single lesson-flow session: every generated artifact for the 7-step
-- lesson, plus the pre/post assessment tallies used for the before/after
-- insight. Extending this to multi-teacher/multi-class later is an additive
-- migration (add teacher_id/class_id columns), not a redesign.

create extension if not exists "pgcrypto";

-- Namespaced under its own schema rather than "public" so this can share a
-- Supabase project with unrelated apps without any table-name collisions.
create schema if not exists tarbiya;

create table if not exists tarbiya.lesson_sessions (
  id uuid primary key default gen_random_uuid(),
  lesson_id text not null,
  class_size integer,

  connection jsonb,
  vocabulary jsonb,
  activating_prior_knowledge jsonb,
  pre_assessment jsonb,
  pre_assessment_results jsonb,
  learning_intentions jsonb,
  active_learning jsonb,
  group_activity jsonb,
  consolidation jsonb,
  post_assessment_results jsonb,
  insight jsonb,
  rubric_project jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lesson_sessions_lesson_id_idx on tarbiya.lesson_sessions (lesson_id);

-- Additive migration for a table created before the `vocabulary` column
-- existed -- `create table if not exists` above is a no-op against an
-- already-existing table, so this covers re-running the file against a live
-- database that predates this column.
alter table tarbiya.lesson_sessions add column if not exists vocabulary jsonb;
alter table tarbiya.lesson_sessions add column if not exists group_activity jsonb;
alter table tarbiya.lesson_sessions add column if not exists rubric_project jsonb;

-- A human reviewer's edit to a lesson's Layer 2 grounding text, layered on
-- top of the seed data in content/lessons/*.ts (see lib/lesson-content-store.ts).
-- lesson_id is not a foreign key since the seed lessons aren't a DB table --
-- they're the static content library checked into the repo.
create table if not exists tarbiya.lesson_content_overrides (
  lesson_id text primary key,
  grounding text not null,
  review_status text not null check (review_status in ('draft', 'approved')),
  updated_at timestamptz not null default now()
);
