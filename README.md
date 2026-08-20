# Majlis Founder OS

A mobile-first shared founder workspace for Mufida and Victoria: quick capture, shared projects, simple Gantt views, decisions, CRM, and asynchronous catch-up.

## What is working in this starter

- Expo Router tab structure
- Home / Drop / Projects / Decisions / CRM
- hidden Catch-up route linked from Home
- local interactive capture state
- local decision state
- seeded Majlis project and CRM data
- simple project-level Gantt visualisation
- shared-workspace Supabase schema with RLS scaffolding
- Supabase client abstraction

## Core product rule

Conversation should produce structure.

A thought can become a task.
A discussion can become a decision.
A promise can become an assignment.
A CRM note can become a follow-up.
A late-night drop can wait for the other founder's catch-up.

## Run locally

1. Install Node.js and Expo tooling.
2. In this folder run:

   npm install

3. Then:

   npx expo start

Expo's current documentation recommends Expo Router for file-based routing, and the package versions should be aligned with your installed Expo SDK using `npx expo install` if npm reports compatibility warnings.

## Connect Supabase

1. Create a Supabase project.
2. Copy `.env.example` to `.env`.
3. Add:

   EXPO_PUBLIC_SUPABASE_URL=...
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...

4. Run `supabase/schema.sql` in the Supabase SQL editor.
5. Replace seeded data in `data/mock.ts` with repository/service calls.

The publishable key is intended for the client; service-role keys must never be placed in the Expo app.

## Next build steps for Claude Code

1. Add authentication and a two-member workspace onboarding flow.
2. Create repositories for projects, tasks, decisions, drops, organisations and messages.
3. Connect Drop to `drops`.
4. Add thread screens attached to tasks/projects/CRM records.
5. Add AI action parsing via a server-side Supabase Edge Function.
6. Build a morning Catch-up query summarising changes since `last_seen_at`.
7. Implement quiet-hours delivery rules.
8. Add real push notifications only for explicit urgent items / chosen reminders.
9. Add CRM activity history and next-action resurfacing.
10. Add production-ready tests and regenerate dependency versions with Expo's compatibility tooling.

## Suggested AI actions

- create_drop
- create_task
- assign_task
- update_task
- create_decision
- resolve_decision
- add_crm_note
- update_pipeline_stage
- create_follow_up
- mark_waiting_for
- summarize_changes_since_last_seen

## Product loop

Drop → Discuss → Decide → Assign → Track → CRM → Catch Up
