# Majlis Media Studio

Internal media production workspace for The Majlis Academy — replaces
scattered WhatsApp threads, loose files, manual approvals and separate
scheduling with one visual pipeline: **Idea → Script → Film → Edit →
Approval → Scheduled → Published**.

**Standalone.** This is a separate app from the Founder OS / CRM app at the
repo root — its own Expo project, its own Supabase project, its own users.
Nothing here talks to the CRM, and it shouldn't.

See `ARCHITECTURE.md` for the full design (schema, permissions, storage,
state machine, navigation, build-now-vs-needs-API split) and
`docs/social-api-requirements.md` for what each platform integration needs.

## What's implemented

- **Auth & roles** — Supabase email/password auth; four flexible roles
  (Admin, Approver, Creator/Editor, Publisher) a user can hold in
  combination, enforced by Postgres RLS, not just the client.
- **Home** — My Tasks, Due Today, Overdue, Waiting for Me, Awaiting
  Approval, Scheduled Today, Recently Published, as horizontally-scrolling
  media card rows.
- **Pipeline** — 8-stage Kanban board; long-press a card to move it (only
  through legal state-machine transitions, and only if you're permitted to
  edit that item).
- **Content item detail** — Overview (title, description, script,
  owner/approver/publisher/contributors, campaign, tags, priority, due
  date, internal notes — all autosaving with optimistic-concurrency conflict
  protection), Media (Raw/Draft/Final with full version history, upload,
  playback/lightbox), Platforms (independent Instagram/TikTok/LinkedIn
  versions), Comments (@mentions -> notifications), Activity (audit trail).
- **Approvals inbox** — only what's waiting on you; Approve / Request
  Changes, with the state machine, media lock, and per-platform revoke-on-
  change all enforced server-side by database triggers.
- **Calendar** — month grid + week agenda, filterable by platform/campaign,
  Asia/Dubai throughout.
- **Content Bank** — searchable reusable media library, tag-based, files can
  be attached into any content item later.
- **Published archive**, **Team** (roles + workload), **Notifications**
  centre (grouped, in-app), **Insights** (this month's content mix),
  **Search** (title/campaign/tag/caption/filename), admin screens for
  campaigns/tags/content types and role management.
- **Batch add** — describe a month's content in your own words (a paragraph or rough list) on the Home tab's
  "Describe a month's content, get it organized" button, and `parse-content-batch` (Edge Function, Anthropic
  tool-calling) splits it into separate content items — title, due date, priority — for you to review, edit, untick,
  or remove before anything is actually created. The function only parses text (no database access, no service
  role key needed); each confirmed item is then created client-side through the same `createContentItem()` path a
  manually-created item uses, so ownership/RLS work identically either way.
- **`lib/alert.tsx`** — every `Alert.alert` call in this app (approve/reject, upload errors, delete confirmations,
  etc.) goes through `showAlert()` instead of the bare RN API. `react-native-web`'s `Alert.alert` is a total no-op
  (`static alert() {}`), so on the web build every one of those silently did nothing when tapped — no dialog, no
  error, no visible failure at all. A first pass fell back to `window.confirm`/`window.alert` on web, but those turn
  out to be silently suppressed by iOS too once the app is added to the Home Screen (standalone display mode has no
  Safari chrome to host them) — same failure all over again. `lib/alert.tsx` now draws its own in-app modal
  (`AlertHost`, mounted once in `app/_layout.tsx`) instead of delegating to any browser or RN-native alert API, so it
  behaves identically in the native app, a browser tab, and installed to the Home Screen. `showAlert()`'s call
  signature is unchanged, so no call site needed to change.
- Every repository function used to `throw error;` with the raw Supabase `PostgrestError` object rather than a real
  `Error`, so any call site checking `err instanceof Error` (the standard pattern used everywhere to pull out
  `.message` for a `showAlert`) fell through to `String(err)` and rendered the unhelpful `[object Object]` — e.g.
  moving a card on the Pipeline board failing with "Could not move / [object Object]" instead of the real reason.
  Every `throw error;` across `lib/repositories/*.ts` now wraps it as `throw new Error(error.message);` at the
  source, so the real message surfaces everywhere downstream without touching each call site.
- **Publishing architecture** — a real adapter abstraction
  (`lib/publishing/`) and an Edge Function dispatcher
  (`supabase/functions/publish-dispatcher`) that schedules/retries per
  platform independently. Every platform currently reports **Not
  Connected** (no fake success), and approved content shows a **Ready to
  Post Manually** panel with everything needed to post by hand.

## Run locally

1. Node 22 / Expo SDK 54 (same pin as the root app).
2. `npm install`
3. `npm run typecheck`
4. `npx expo start` (or `npm run web`, `npm run ios`, `npm run android`)

Without a configured Supabase project the app boots to a "Supabase is not
configured" screen instead of crashing.

## Connect Supabase (this app's own project — not the CRM's)

1. Create a **new** Supabase project (separate from the Founder OS/CRM one).
2. Copy `.env.example` to `.env` and fill in `EXPO_PUBLIC_SUPABASE_URL` /
   `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. Run `supabase/schema.sql` in the SQL editor — idempotent, safe to re-run.
4. Restart Expo (`npx expo start -c` if already running).
5. Sign up — the very first account becomes Admin automatically
   (`handle_new_user()` in the schema). Grant roles to everyone else from
   Team → Manage Roles (More tab).
6. (Optional, once ready) Deploy the Edge Functions:
   ```
   supabase functions deploy publish-dispatcher
   supabase functions deploy scheduled-notifications
   ```
   and schedule both from the Supabase dashboard (Database → Cron, or
   Edge Functions → Schedules) — `publish-dispatcher` every few minutes,
   `scheduled-notifications` once a day. Both use the service role key
   automatically; no secrets belong in the Expo app.

## Project structure

```
app/
  (auth)/sign-in.tsx
  (tabs)/home.tsx, pipeline.tsx, calendar.tsx, bank/index.tsx, approvals.tsx,
         more.tsx, published.tsx, team.tsx, insights.tsx
  content/[id].tsx, content/new.tsx     content item detail / create
  bank/[id].tsx                          Content Bank asset detail
  notifications.tsx, search.tsx, settings.tsx
  admin/campaigns-tags.tsx, admin/team.tsx
components/
  content/                               detail-screen tabs (Overview, Media, Platforms, Comments, Activity, ApprovalBar)
  ContentCard, CardRow, MediaThumb, MediaViewer, PlatformIcon, StatusBadge, PickerSheet, ...
lib/
  auth.tsx, permissions.ts, stateMachine.ts, timezone.ts
  repositories/                          typed Supabase CRUD per entity
  publishing/                            PublishAdapter abstraction + stubs
  hooks/                                 autosave editors (content item, platform post)
supabase/
  schema.sql                             full schema, RLS, triggers (see ARCHITECTURE.md)
  functions/publish-dispatcher/          scheduled publishing, one platform at a time
  functions/scheduled-notifications/     daily deadline/overdue fan-out
```
