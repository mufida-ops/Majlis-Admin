# Majlis Founder OS

A mobile-first shared founder workspace for Mufida and Victoria: quick capture, shared projects, simple Gantt views,
discussions, CRM, and asynchronous catch-up.

## Core product rule

Conversation should produce structure.

A thought can become a task.
A discussion can become a decision.
A promise can become an assignment.
A CRM note can become a follow-up.
A late-night drop can wait for the other founder's catch-up.

Product loop: **Give → Discuss → Decide → Assign → Track → CRM → Catch Up**

## What's implemented

- Supabase email/password auth, gated routing (`app/index.tsx`, `app/(auth)`, `app/(tabs)/_layout.tsx`).
- Automatic two-member shared workspace: the first two people who sign in join the same workspace via the
  `bootstrap_workspace()` RPC (`supabase/schema.sql`) — no invite codes, no hardcoded emails.
- All screens (Home, Give, Projects, Discussions, CRM, Catch-up) read and write Supabase directly through the typed
  repository layer in `lib/repositories/`. No mock data remains.
- Project/task detail (`app/(tabs)/projects`), CRM organisation detail with activity history
  (`app/(tabs)/crm`), and a generic discussion thread (`app/thread.tsx`) reusable across projects, tasks,
  decisions and CRM organisations — when opened for a task, that thread screen also shows the same `StatusBadge`/
  `PriorityBadge` plus an editable due date, so status is changeable both from a project's task list and from
  inside that task's own discussion, not only one or the other. A project's task list is grouped into status sections (Not Started / Started /
  Ongoing / Done, via `lib/taskStatus.ts`) instead of one flat list, with a tap-to-cycle `StatusBadge` per task
  (`components/StatusBadge.tsx`, same interaction as `PriorityBadge`) so status is actually changeable from this
  screen — Done tasks stay visible but dimmed rather than disappearing. Tasks render as a slim list (a hairline
  divider between rows, not boxed cards), and each row's whole background is tinted by whoever owns it — pink for
  Victoria, purple for Mufida (`ownerAccentColor` in `lib/ownerLabel.ts`, matched by display name so it can't flip
  depending on who's viewing). No per-task weight to enter: every task counts equally toward its project's
  progress (`computeProjectProgress` in `lib/taskStatus.ts` — the share of a project's tasks marked Done, e.g. 100
  tasks means each is worth 1% the moment it's checked off), computed from the project's own task list rather than
  trusted from the stored `projects.progress` column, and reads a flat 100% once the project's own status is set
  to Complete regardless of how many tasks exist. A project's own lifecycle is a separate 4 steps — Not Started /
  Active / Blocked / Complete (`ProjectStatus` in `types/db.ts`) — `createProject` sets a new one to Not Started
  explicitly rather than via the DB column default, since changing an enum's default in the same migration that
  adds the enum value hits Postgres's "unsafe use of new value" restriction. The Projects list sorts by priority
  (High first) and shows a colored "High/Medium/Low priority" chip per card — the left-edge color accent alone was
  too easy to miss. Projects can also carry their own due date (`projects.due_at`), separate from any task's,
  editable from the project detail screen and shown on its list card.
- Owner tags are just the initial — "M"/"V" — everywhere someone or something is labelled by who it belongs to
  (task rows, the owner picker when adding/editing a task, CRM pills, Discussion owner chips), not the full name.
  `memberLabel` in `lib/ownerLabel.ts` is the single place this is decided.
- A task's edit (pencil icon) opens its title, owner, priority, and due date together as one inline form — not
  just the title — so reassigning or redating a task never requires opening its thread.
- Projects can be started from a "Book" template as well as a blank one (a toggle on the "New project" form): pick
  "Book", enter the book's title, and it creates the project pre-loaded with the ~60-item checklist Mufida already
  runs by hand for every book (`lib/bookTemplate.ts`, `createBookProject` in `lib/repositories/projects.ts`) — Book
  Creation, Book Checking, ISBN, Book Box Paper Resources, Hello Chef Guidance, Props, Praveen, and the Cultural
  Box. Those tasks start unassigned and undated (there's no single sensible default across ~60 items) — assign and
  date each one via the task edit form above as work starts on it.
- Adding a task requires a due date and an owner (Mufida or Victoria — no more "Unassigned" at creation) up front,
  plus an explicit priority pick, so every task row can always show all three at a glance instead of some being
  blank. Each task row has its own edit (title) and delete icons, same confirm-before-delete pattern used
  everywhere else. Opening a task's own discussion (`app/thread.tsx`) also shows its status-change history —
  "Started" and when, "moved to Ongoing" and when, etc — read straight from the `activity_events` log that
  `log_task_activity`'s trigger already writes on every status/owner/due-date change, not a separate log the
  client has to maintain. Projects and Discussions both have delete buttons too (`deleteProject`/`deleteDecision`),
  matching the confirm-and-remove pattern CRM organisations already had.
- Calendar events are editable, not just create-and-delete — tapping "Edit" on an event repopulates the same "New
  event" form (now dual-purpose) with its title/date/time/notes and switches its button to "Save changes"
  (`updateEvent`, already in `lib/repositories/events.ts` but unused until now). Each event card is tinted by who
  created it, the same `ownerAccentColor` scheme as task rows (pink for Victoria, purple for Mufida).
- Every screen with user-created entries — Projects list, project titles, Discussions, CRM (list and detail
  organisation name), and Give — supports inline edit and delete with the same confirm-before-delete pattern, and
  every card is tinted by whoever owns/created it using the shared pink(Victoria)/purple(Mufida) scheme:
  `ownerAccentColor` for entities with a `user_id` owner (projects, tasks, CRM organisations, Give, calendar
  events), `ownerTypeAccentColor` for Discussions, whose `owner` field is `'Mufida' | 'Victoria' | 'Both'` directly
  rather than a user id (returns no tint for `'Both'`, since it isn't either person's alone).
- Quiet hours: each member sets their own quiet hours in `app/settings.tsx`; Home and Give reflect the partner's
  real quiet-hours state (`lib/quietHours.ts`).
- Catch-up: `app/(tabs)/catch-up.tsx` reads everything that changed since your `last_seen_at`, split into "Needs
  you" and "FYI", and advances `last_seen_at` once it's shown.
- CRM activity history and overdue next-action highlighting on the organisation detail screen, backed by the
  `activity_events` log that database triggers populate automatically (`supabase/schema.sql`).
- **Your AI Assistant** (`app/(tabs)/ai.tsx`): a real back-and-forth conversation with AI, deliberately separate
  from Give — Give is plain conversation with your co-founder and never runs AI on its own; this is where you
  actually talk to the assistant. It does three things: (1) answers questions from real workspace data, including
  history ("when did we last talk to X", "what happened with Y") via a `recent_history` feed built from
  `activity_events`, not guesses; (2) acts as a thinking partner for "should I do this or that" — reasoning from
  your actual context, not generic advice; (3) when a message clearly calls for it, proposes one structured
  `ai_actions` (create_task, assign_task, create_decision, resolve_decision, add_crm_note, update_pipeline_stage,
  create_follow_up, mark_waiting_for, create_event, create_organisation, send_partner_message) shown as
  Accept/Dismiss right under that reply — nothing is ever created or sent without that explicit tap. `send_partner_message`
  is the "hey, I'm thinking about this at 2am and don't want to bombard your WhatsApp" case — accepting it creates a
  normal Give to your co-founder, quiet hours and all, exactly as if you'd typed it into Give yourself. A proposal
  can also be reclassified (Task / Discussion / CRM follow-up / Calendar) if the AI guessed the wrong category.
  create_event resolves relative dates ("tomorrow", "Friday") using your own timezone, computed server-side and
  given to Claude as today_date/tomorrow_date context. Each founder's conversation is private (not seen by their
  co-founder, same boundary as a Give's raw text), backed by `ai_chat_messages` and the `ai-chat` Supabase Edge
  Function (`supabase/functions/ai-chat`). Has its own bottom tab, plus a link from Give. Every message also carries
  its own "Link to calendar, CRM, or discussion" action, independent of whatever the AI proposed — see Linking below.
- Give summaries: saving or editing something in Give calls the separate `parse-drop` Edge Function (`propose_actions: false`)
  purely to write a short third-person `drops.summary`, overwriting that item's `activity_events.summary` too, so a
  long voice-dictated rant reaches the co-founder's Catch-up feed as a clean couple of sentences instead of the raw
  text — this never proposes AI actions, which is exclusively Your AI Assistant's job. Voice input itself needs no app code —
  dictation is the phone keyboard's built-in microphone button, focused on the Give text field.
- Quote of the day on Home (`lib/quotes.ts`): the same line for both founders on the same calendar day, picked by
  indexing a curated list with the local date — no table, no sync, both phones just compute the same index.
- Give screen: edit or delete anything in "What you've sent" — editing re-triggers the summary-only parse against
  the corrected text, nothing more.
- Linking (`components/LinkPicker.tsx`): a shared "turn this into Calendar / CRM follow-up / Discussion (/ Task)"
  mini-form, used in two places so it behaves identically wherever you reach for it: (1) on Give, every sent item
  has a link icon that opens it directly — pick a target, fill the one or two fields it needs, and it creates the
  real thing (a calendar event, a CRM follow-up on an organisation, or a discussion), seeded from that item's text;
  (2) on Your AI Assistant, every message carries the same link icon for manual linking, and every AI suggestion's
  "Wrong category? Move it to:" row opens the same picker (with Task included) pre-set to the tapped target, so
  reclassifying a wrong AI guess and manually linking an item both go through one component instead of two
  divergent forms. Both `parse-drop` and `ai-chat` re-validate every id a suggestion references
  (project/task/decision/organisation) against the real workspace data before proposing it, so a suggestion can no
  longer look valid on screen and then silently fail when accepted.
- Illustrations throughout: the two illustrations Mufida shared (`assets/images/sign-in-hero.jpg`,
  `assets/images/reading-together.jpg`) appear on Sign-in and Home's empty-focus-list card, and as a persistent
  header banner (`components/PageBanner.tsx`) on Projects, Discussions, CRM, Calendar, and Give — shown always,
  whether that list is empty or full, rather than only in the empty state.

## Testing without a local dev server

`.github/workflows/eas-update.yml` publishes an EAS Update to the `preview` branch on every push, using the
`EXPO_TOKEN` repository secret. Once published, Expo Go (signed into the same Expo account the project lives
under — `mufidasaids-team`) always loads the latest published JS bundle for this project, with no `npx expo
start` or laptop involved. `app.json`'s `extra.eas.projectId` / `updates.url` point at that project
(`majlis-app`, id `3dac72a8-b799-45de-b3fd-209fe9e2876a`).

## Website version ("Add to Home Screen")

The app also builds as a plain website, installable as a home-screen icon (a PWA) so it can be used without Expo
Go at all. `.github/workflows/deploy-web.yml` runs `npm run build:web` on every push and publishes the result to
GitHub Pages.

- `npm run build:web` runs `expo export -p web` (Expo's own web bundler, using `react-native-web` — already a
  dependency, nothing extra to install) into `dist/`, then `scripts/inject-pwa-head.js` patches the generated
  `index.html` to add the manifest link, apple-touch-icon, and `theme-color`/`apple-mobile-web-app-*` meta tags
  that make "Add to Home Screen" open full-screen instead of as a browser bookmark. That second step exists
  because `app/+html.tsx` (Expo Router's normal way to customize these tags) only takes effect under
  `web.output: "static"`, and that mode currently crashes on this Expo/React 19 combo (`s.resetServerContext is
  not a function` — a version mismatch inside expo-router's static-render pipeline, not this app's code); `web.output: "single"`
  (a plain one-file SPA, set in `app.json`) sidesteps that bundler bug entirely, so the script patches its output
  after the fact instead.
- `app.json`'s `web.favicon` and `public/manifest.json`/`public/icon-*.png`/`public/apple-touch-icon.png` are the
  navy-and-gold "M" icon used both as the browser tab favicon and the home-screen icon.
- `lib/supabase.ts` reads `localStorage` through a small guarded wrapper rather than directly, because Supabase's
  client tries to read it synchronously the moment it's constructed — harmless in a real browser, but this module
  also gets evaluated in Node during `expo export`'s bundling step, where no `localStorage` exists.
- Calendar reminders don't fire on the website version — `syncEventReminders` is skipped when `Platform.OS ===
  'web'` (`app/(tabs)/calendar.tsx`), with a note shown on that screen. A browser can't reliably wake a phone with
  a notification while the site isn't open the way the native app can, so Expo Go stays the version to use for
  anything that depends on a reminder actually buzzing; the website is for everything else.
- One-time setup needed before this workflow's deploys actually go live: in the repo's Settings → Pages, set
  Source to "GitHub Actions" (https://github.com/mufida-ops/Majlis-Admin/settings/pages). Until that's set, the
  workflow still runs and builds successfully, it just has nowhere to publish to yet.

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
6. (Optional) Deploy the AI Edge Functions. `.github/workflows/deploy-supabase-functions.yml` does this
   automatically on every push that touches `supabase/functions/**`, given two repo secrets: `SUPABASE_ACCESS_TOKEN`
   (a personal access token from supabase.com/dashboard/account/tokens) and `ANTHROPIC_API_KEY`. To do it by hand
   instead:

   ```
   supabase functions deploy parse-drop
   supabase functions deploy ai-chat
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   ```

   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically. `ANTHROPIC_MODEL` is optional and
   defaults to a fast/cheap model, since both are background/latency-tolerant calls, not the primary product
   surface. Without these deployed, Give still saves normally (no summary is generated) and Your AI Assistant will show an
   error instead of a reply.

## Project structure

```
app/
  (auth)/sign-in.tsx        sign in / sign up
  (tabs)/home.tsx           focus list, quiet-hours pill, catch-up entry
  (tabs)/drop.tsx           Give — capture, plain conversation with your co-founder, no AI
  (tabs)/ai.tsx             Your AI Assistant — a real conversation with AI; review/reclassify its suggestions inline
  (tabs)/projects/          project list, detail (tasks, Gantt, next action)
  (tabs)/decisions.tsx      Discussions — decision log
  (tabs)/crm/               CRM list, detail (stage, notes, activity history)
  (tabs)/catch-up.tsx       changes since last_seen_at
  thread.tsx                generic discussion thread (project/task/decision/organisation)
  settings.tsx              quiet hours, sign out
components/
  LinkPicker.tsx             shared "link to Calendar / CRM / Discussion (/ Task)" form, used on Give and AI Assistant
lib/
  auth.tsx, workspace.tsx   session + shared-workspace context
  repositories/             typed Supabase CRUD per entity
  quietHours.ts, ownerLabel.ts, format.ts, useAsync.ts   shared helpers
supabase/
  schema.sql                 tables, RLS, bootstrap_workspace(), activity triggers
  functions/parse-drop/       Give → catch-up summary only (no AI actions)
  functions/ai-chat/          Your AI Assistant → conversational reply + at most one structured ai_action
```

Note: the route/table names (`drop`, `decisions`) stay as-is internally — only the on-screen labels changed to Give /
Discussions, to avoid a schema migration for a cosmetic rename.

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
- send_partner_message (Your AI Assistant only — creates a Give to your co-founder)
- summarize_changes_since_last_seen
