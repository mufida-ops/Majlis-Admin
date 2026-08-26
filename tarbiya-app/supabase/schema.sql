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

create table if not exists lesson_sessions (
  id uuid primary key default gen_random_uuid(),
  lesson_id text not null,
  class_size integer,

  connection jsonb,
  activating_prior_knowledge jsonb,
  pre_assessment jsonb,
  pre_assessment_results jsonb,
  learning_intentions jsonb,
  active_learning jsonb,
  consolidation jsonb,
  post_assessment_results jsonb,
  insight jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lesson_sessions_lesson_id_idx on lesson_sessions (lesson_id);

-- A human reviewer's edit to a lesson's Layer 2 grounding text, layered on
-- top of the seed data in content/lessons/*.ts (see lib/lesson-content-store.ts).
-- lesson_id is not a foreign key since the seed lessons aren't a DB table --
-- they're the static content library checked into the repo.
create table if not exists lesson_content_overrides (
  lesson_id text primary key,
  grounding text not null,
  review_status text not null check (review_status in ('draft', 'approved')),
  updated_at timestamptz not null default now()
);
