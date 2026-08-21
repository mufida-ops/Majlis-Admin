# Majlis Founder OS

A mobile-first shared founder workspace for Mufida and Victoria: quick capture, shared projects, simple Gantt views,
decisions, CRM, and asynchronous catch-up.

## Core product rule

Conversation should produce structure.

A thought can become a task.
A discussion can become a decision.
A promise can become an assignment.
A CRM note can become a follow-up.
A late-night drop can wait for the other founder's catch-up.

Product loop: **Drop → Discuss → Decide → Assign → Track → CRM → Catch Up**

## What's implemented

- Supabase email/password auth, gated routing (`app/index.tsx`, `app/(auth)`, `app/(tabs)/_layout.tsx`).
- Automatic two-member shared workspace: the first two people who sign in join the same workspace via the
  `bootstrap_workspace()` RPC (`supabase/schema.sql`) — no invite codes, no hardcoded emails.
- All screens (Home, Drop, Projects, Decisions, CRM, Catch-up) read and write Supabase directly through the typed
  repository layer in `lib/repositories/`. No mock data remains.
- Project/task detail (`app/(tabs)/projects`), CRM organisation detail with activity history
  (`app/(tabs)/crm`), and a generic discussion thread (`app/thread.tsx`) reusable across projects, tasks,
  decisions and CRM organisations.
- Quiet hours: each member sets their own quiet hours in `app/settings.tsx`; Home and Drop reflect the partner's
  real quiet-hours state (`lib/quietHours.ts`).
- Catch-up: `app/(tabs)/catch-up.tsx` reads everything that changed since your `last_seen_at`, split into "Needs
  you" and "FYI", and advances `last_seen_at` once it's shown.
- CRM activity history and overdue next-action highlighting on the organisation detail screen, backed by the
  `activity_events` log that database triggers populate automatically (`supabase/schema.sql`).
- Structured AI actions: a Drop can be parsed by the `parse-drop` Supabase Edge Function
  (`supabase/functions/parse-drop`) into reviewable `ai_actions` (create_task, assign_task, create_decision,
  resolve_decision, add_crm_note, update_pipeline_stage, create_follow_up, mark_waiting_for, create_event), shown
  for Accept/Dismiss on the Drop screen. create_event resolves relative dates ("tomorrow", "Friday") using the
  author's own timezone, computed server-side and given to Claude as today_date/tomorrow_date context. Saving a
  drop (or editing one) only ever writes its catch-up summary — a drop is plain conversation between the two
  founders by default. AI suggestions only get proposed when a founder explicitly taps "Action it" on that drop,
  via a `propose_actions` flag on the same Edge Function call (`lib/repositories/aiActions.ts`'s `requestDropParse`).
- Drop summaries: the same `parse-drop` call also writes a short third-person `drops.summary` and overwrites that
  drop's `activity_events.summary`, so a long voice-dictated rant reaches the co-founder's Catch-up feed as a clean
  couple of sentences instead of the raw text. Voice input itself needs no app code — dictation is the phone
  keyboard's built-in microphone button, focused on the Drop text field.
- Quote of the day on Home (`lib/quotes.ts`): the same line for both founders on the same calendar day, picked by
  indexing a curated list with the local date — no table, no sync, both phones just compute the same index.
- Drop screen: edit or delete anything in "What you've sent" — editing re-triggers AI parsing against the corrected
  text. Each drop has its own "Action it" button and shows its own suggestions directly underneath it (rather than a
  single pooled list at the top disconnected from which note produced them), with Accept/Dismiss right there.
  Accepting a suggestion shows an explicit "Done — …" confirmation instead of just removing the card, and the
  `parse-drop` Edge Function re-validates every id a suggestion references (project/task/decision/organisation)
  against the real workspace data before proposing it, so a suggestion can no longer look valid on screen and then
  silently fail (or do nothing) when accepted.
- Reclassify a suggestion: every suggestion on the Drop screen has a "Wrong category? Move it to:" row (Task /
  Decision / CRM follow-up / Calendar) — since the AI's own guess at a category is sometimes wrong (e.g. proposing a
  CRM follow-up for what's really a calendar reschedule), tapping one opens a small inline form (title, plus
  whatever that target needs — a project picker for Task, an organisation picker for CRM, a date for Calendar) and
  creates the right thing directly, dismissing the original mis-categorised suggestion.
- Illustrated empty states: the two illustrations Mufida shared (`assets/images/sign-in-hero.jpg`,
  `assets/images/reading-together.jpg`) appear across Home, Sign-in, Projects, Decisions, CRM, Calendar, Catch-up,
  and Drop wherever a list is empty, via `EmptyState`'s optional `image` prop (`components/AsyncState.tsx`).

## Testing without a local dev server

`.github/workflows/eas-update.yml` publishes an EAS Update to the `preview` branch on every push, using the
`EXPO_TOKEN` repository secret. Once published, Expo Go (signed into the same Expo account the project lives
under — `mufidasaids-team`) always loads the latest published JS bundle for this project, with no `npx expo
start` or laptop involved. `app.json`'s `extra.eas.projectId` / `updates.url` point at that project
(`majlis-app`, id `3dac72a8-b799-45de-b3fd-209fe9e2876a`).

## Run locally

1. Install Node.js (this project was built against Node 22 / Expo SDK 54 — deliberately pinned one SDK below
   latest, since the published Expo Go client on the app stores lags a freshly-released SDK by some weeks; bump
   once Expo Go itself supports a newer SDK).
2. Install dependencies:

   ```
   npm install
   ```

   Dependency versions are pinned to what `expo/bundledNativeModules.json` reports for the installed Expo SDK, so
   `npm install` resolves cleanly with no `--legacy-peer-deps` flag. If you ever bump the Expo SDK, re-align
   versions with Expo's own compatibility tooling:

   ```
   npx expo install --check
   npx expo install --fix
   ```

3. Typecheck: `npm run typecheck`
4. Start the app: `npx expo start` (or `npm run web` for a quick browser check, `npm run ios` / `npm run android`
   for native).

Without a configured Supabase project the app still boots and shows a "Supabase is not configured" screen instead
of crashing — see below to connect one.

## Connect Supabase

1. Create a Supabase project.
2. Copy `.env.example` to `.env` and fill in:

   ```
   EXPO_PUBLIC_SUPABASE_URL=...
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
   ```

   The publishable key is safe for the client; the service-role key must never go in the Expo app — it's only used
   server-side inside the Edge Function.

3. Run `supabase/schema.sql` in the Supabase SQL editor. It's idempotent (uses `if not exists` / `drop policy if
   exists` throughout), so it's safe to re-run after pulling schema changes.
4. Restart Expo so the new env vars are picked up (`npx expo start -c` if you've already started once).
5. Sign up as Mufida, then sign up again as Victoria (or vice versa) — the second signup automatically joins the
   first one's workspace via `bootstrap_workspace()`. A third signup gets its own separate workspace.
6. (Optional) Deploy the AI action parser. `.github/workflows/deploy-supabase-functions.yml` does this automatically
   on every push that touches `supabase/functions/**`, given two repo secrets: `SUPABASE_ACCESS_TOKEN` (a personal
   access token from supabase.com/dashboard/account/tokens) and `ANTHROPIC_API_KEY`. To do it by hand instead:

   ```
   supabase functions deploy parse-drop
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   ```

   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically. `ANTHROPIC_MODEL` is optional and
   defaults to a fast/cheap model, since parsing a Drop is a background job, not the primary product surface. Without
   this deployed, Drop still saves normally — the "Suggested from your drops" section on the Drop screen just stays
   empty.

## Project structure

```
app/
  (auth)/sign-in.tsx        sign in / sign up
  (tabs)/home.tsx           focus list, quiet-hours pill, catch-up entry
  (tabs)/drop.tsx           capture + AI action review
  (tabs)/projects/          project list, detail (tasks, Gantt, next action)
  (tabs)/decisions.tsx      decision log
  (tabs)/crm/               CRM list, detail (stage, notes, activity history)
  (tabs)/catch-up.tsx       changes since last_seen_at
  thread.tsx                generic discussion thread (project/task/decision/organisation)
  settings.tsx              quiet hours, sign out
lib/
  auth.tsx, workspace.tsx   session + shared-workspace context
  repositories/             typed Supabase CRUD per entity
  quietHours.ts, ownerLabel.ts, format.ts, useAsync.ts   shared helpers
supabase/
  schema.sql                 tables, RLS, bootstrap_workspace(), activity triggers
  functions/parse-drop/       Drop → structured ai_actions
```

## Suggested AI actions

- create_task
- assign_task
- update_task
- create_decision
- resolve_decision
- add_crm_note
- update_pipeline_stage
- create_follow_up
- mark_waiting_for
- create_event
- create_organisation
- summarize_changes_since_last_seen
