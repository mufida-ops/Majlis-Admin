# Majlis Founder OS

A mobile-first shared founder workspace for Mufida and Victoria: quick capture, shared projects, discussions, CRM,
and asynchronous catch-up.

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
  trusted from the stored `projects.progress` column. The percentage never gets overridden by the status pill
  (it used to jump to a flat 100% once marked Complete, which read as dishonest against a task list that
  disagreed) — it's always the literal share of tasks marked Done. A project's own lifecycle is a separate 4 steps
  — Not Started / Active / Blocked / Complete (`ProjectStatus` in `types/db.ts`) — with a one-line plain-language
  description shown under the status pills on the project detail page (`STATUS_DESCRIPTION` in
  `app/(tabs)/projects/[id].tsx`) for anyone unsure what a given status actually means. `createProject` sets a new
  one to Not Started explicitly rather than via the DB column default, since changing an enum's default in the
  same migration that adds the enum value hits Postgres's "unsafe use of new value" restriction. The Projects list
  sorts by priority (High first) and shows a colored "High/Medium/Low priority" chip per card — the left-edge
  color accent alone was
  too easy to miss. Projects can also carry their own due date (`projects.due_at`), separate from any task's,
  editable from the project detail screen and shown on its list card.
- Owner tags are just the initial — "M"/"V" — everywhere someone or something is labelled by who it belongs to
  (task rows, the owner picker when adding/editing a task, CRM pills, Discussion owner chips), not the full name.
  `memberLabel` in `lib/ownerLabel.ts` is the single place this is decided.
- A task's edit (pencil icon) opens its title, owner, priority, status/progress, and due date together as one
  inline form — not just the title — so changing any of them never requires opening the task's own thread. The
  compact status/priority pills on each task row still work too (tap to cycle), now with a small chevron so it's
  visibly tappable rather than looking like a static label.
- "+ Add task" is always tappable, even with an empty title — it validates on tap and shows what's missing (title,
  owner, or due date) instead of silently doing nothing, which is what a disabled-but-visually-identical button
  looked like before.
- A task's own thread screen (opened by tapping the task row itself, not the pencil) also has explicit "Assigned
  to" and "Progress" chip rows now, not just the compact cycling badges — the project detail page wasn't the only
  place a task could be opened from, so it needed the same explicit controls.
- Projects can be started from a "Book" template as well as a blank one (a toggle on the "New project" form): pick
  "Book", enter the book's title, and it creates the project pre-loaded with the ~60-item checklist Mufida already
  runs by hand for every book (`lib/bookTemplate.ts`, `createBookProject` in `lib/repositories/projects.ts`) — Book
  Creation, Book Checking, ISBN, Book Box Paper Resources, Hello Chef Guidance, Props, Praveen, and the Cultural
  Box. Those tasks start unassigned and undated (there's no single sensible default across ~60 items) — assign and
  date each one via the task edit form above as work starts on it. Each template task also carries its section
  (`project_tasks.section`), so the project's Tasks card groups them as named, collapsible sections — Book
  Creation, Book Checking, ISBN, and so on (`BOOK_SECTIONS` in `lib/bookTemplate.ts`) — collapsed by default,
  rather than one flat ~60-item list. A task added manually (no section) still falls back to the plain
  status-only grouping used everywhere else.
- Handing a task off for the other founder to look over doesn't need reassigning it (that changes who's doing the
  work): tap the flag icon on a task row, or "Flag for review" on its thread screen, and it's marked
  `project_tasks.needs_review` and shows a "🔍 Needs review" line until whoever looks it over taps the flag again to
  clear it. Independent of status/priority/owner — a task can be Ongoing, assigned to either founder, and flagged
  for review all at once. A flagged task also surfaces in the "Right now" section of the *other* founder's Home
  screen (`app/(tabs)/home.tsx`) — not the flagger's own — since review is for the partner, not a self-reminder.
  Toggling the flag now surfaces a real error (instead of silently doing nothing) if it fails, e.g. before the
  `needs_review` column migration has been run.
- The project-level "Next action" and "Due date" cards got the same edit/delete/flag treatment as individual
  tasks, not just a plain text field with a Save button: a trash icon clears the next action or the due date, and
  a "Flag for review" toggle (`projects.needs_review`, separate from any task's own flag) surfaces the same way
  on the partner's Home when it's not the flagger's own project. The two cards are merged into one, since they're
  really one "what's next and when" unit. That merged card now sits below Tasks on the project detail page, not
  above it — the task list is what you actually came to look at; a single next-action note is secondary.
- Changing a task's status/owner/due date/flag from its own thread screen used to leave the project detail page,
  Projects list, and Home showing stale data — those screens had already fetched their data once and had no way
  to know it changed elsewhere. All three now use `useFocusEffect` to refetch every time they come back into view,
  not just on first load.
- A project marked Complete moves out of the main Projects list into its own "Completed" section at the bottom,
  turns green (`theme.colors.completedGreen`), and drops the priority/progress/timeline clutter in favor of just
  its name and "✓ Done <date>" — grouped by the month it finished (`formatMonthYear` in `lib/format.ts`), newest
  month first. `projects.completed_at` is set automatically the moment a project reaches Complete (and cleared if
  it's ever moved back off it) so the date reflects when it actually finished, not the last time any field on it
  happened to change.
- Both the Projects list and project detail cards are tinted by progress — red for Not Started, orange for Blocked,
  amber for Active, green for Complete (`PROJECT_STATUS_TINT` in `lib/projectStatus.ts`, `statusOrangePale` in
  `constants/theme.ts`) — not by who created the project,
  since a project is joint work rather than one founder's or the other's; the owner tint stays exactly where it
  still makes sense, on individual task rows. A Done task also turns the same green there (overriding its owner
  tint the same way).
- Task groups within a project display in `TASK_STATUS_DISPLAY_ORDER` (`lib/taskStatus.ts`) — Started and Ongoing
  first, then Not Started, then Done last — not the lifecycle order tasks move through. A task that's actually
  being worked on should sit above ones that haven't started yet, not below them; `TASK_STATUSES` itself stays in
  lifecycle order for the status picker, where that order is the one that makes sense to pick from. The status dot
  also carries no color judgment before a task has started (Not Started stays neutral grey) — amber kicks in once
  it's Started or Ongoing, green on Done, the same red-less progression used for projects.
- `StatusBadge` and `PriorityBadge` (the compact pills on each task row) are real dropdowns now, not cycle-on-tap.
  The chevron on them always looked like a dropdown, but tapping actually just advanced one step — and since
  tasks are grouped by status, a successful tap instantly relocated the row into a different group, reading as
  "the dropdown isn't working." Tapping now opens all the options directly (an absolutely-positioned menu under
  the pill) and picking one both commits and closes it.
- The Gantt/"Show timeline" view (`components/Gantt.tsx`) was removed. It rendered every task as a flat,
  unordered, non-interactive bar — no section grouping, no owner colors, no edit/delete/flag — sitting right next
  to the real Tasks card, which does all of that. It was reported as confusing rather than useful (mistaken for
  the actual task list) and never served a workflow Mufida or Victoria used, so it's gone rather than fixed.
- The percentage on a project always comes straight from `computeProjectProgress` — the share of its tasks marked
  Done — never overridden by the status pill; setting a project to Complete used to force it to a flat 100%
  regardless of the task list, which could disagree with what was actually shown on screen. A one-line description
  under the status pills (`STATUS_DESCRIPTION` in `app/(tabs)/projects/[id].tsx`) now also spells out what each of
  Not Started/Active/Blocked/Complete means in plain language.
- Blocked projects get their own orange tint (`statusOrangePale` in `constants/theme.ts`), distinct from Not
  Started's red — the two used to share the same color and were easy to mix up on the Projects list.
- A book project created before the book checklist existed — or one that started as a plain project and only later
  turned out to be a book — can be missing some or all of the ~59-task template, which is why its percentage can
  look low even though nothing's actually wrong: it's accurately reflecting a short task list, not the full
  checklist. `applyBookTemplate` (`lib/repositories/projects.ts`) backfills the missing checklist tasks onto an
  existing project, matched and skipped by title so it never duplicates tasks already there. The project detail
  screen shows a "+ Add book checklist (N missing)" button under Tasks whenever any are missing.
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
  (tabs)/projects/          project list, detail (tasks, next action)
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

- Reloading either app on any page past its sign-in screen — or saving "Add to Home Screen" from one — used to 404,
  since GitHub Pages only serves literal static files and has no server-side router to hand a deep client-side route
  back to the app. Fixed with the standard spa-github-pages redirect trick: `public/404.html` (copied into `dist/`
  by the export, and since both apps share one Pages deployment its `pathSegmentsToKeep` logic decides whether a
  path belongs to Media Studio at `/Majlis-Admin/media/` or the Founder OS app at `/Majlis-Admin/`) folds the real
  path into a `?/`-prefixed query string and bounces to that app's `index.html`, which unfolds it back via
  `history.replaceState` before expo-router boots — a script now injected into both apps' `index.html`
  (`scripts/inject-pwa-head.js` for the root app, the new `media-app/scripts/inject-spa-redirect.js` for Media
  Studio, since it has no existing PWA-tag injection step to piggyback on).
- Media Studio's Edge Functions now deploy automatically too: `.github/workflows/deploy-supabase-functions.yml`
  gained a `deploy-media` job (triggered on `media-app/supabase/functions/**` changes) that deploys against
  Media Studio's own separate Supabase project ref, using the same `SUPABASE_ACCESS_TOKEN`/`ANTHROPIC_API_KEY`
  secrets as the Founder OS app's job — one Supabase account, two projects. See `media-app/README.md` for what the
  new `parse-content-batch` function it deploys actually does.
- Every confirm-before-delete dialog and every error message built on `Alert.alert` (delete a project/task/
  organisation/decision/event/message, "could not flag", clearing a next action, adding the book checklist — 15
  files across both apps) was a silent no-op on the web build: `react-native-web`'s `Alert.alert` is a bare stub
  (`static alert() {}`), so tapping "Delete" or hitting an error on web did nothing at all, with no visible failure
  — this is exactly what looked like "I tried to delete here it didn't work." First fix was `showAlert()` falling
  back to `window.confirm`/`window.alert` on web — but those turn out to be silently suppressed by iOS too, once
  the app is added to the Home Screen (standalone display mode has no Safari chrome to host them), the exact same
  symptom all over again. `lib/alert.tsx` now draws its own in-app modal (`AlertHost`, mounted once in
  `app/_layout.tsx`) instead of delegating to any browser or RN-native alert API, so it behaves identically in the
  native app, a browser tab, and installed to the Home Screen. `showAlert()`'s call signature is unchanged, so no
  call site needed to change again. Media Studio has its own copy at `media-app/lib/alert.tsx` for the same reason.
- `StatusBadge`/`PriorityBadge`'s dropdown (`components/StatusBadge.tsx`, `components/PriorityBadge.tsx`) had no
  `position: 'relative'` on the small `View` wrapping the badge+dropdown — on web, `position: 'absolute'` with no
  positioned ancestor anchors to some much larger ancestor instead, so the dropdown rendered overlapping unrelated
  rows further down the task list rather than right below its own badge. Taps on an option landed on whatever was
  actually underneath at that screen position instead, reading as "the dropdown doesn't work." Fixed by giving that
  wrapper `position: 'relative'` so the dropdown anchors correctly.

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
