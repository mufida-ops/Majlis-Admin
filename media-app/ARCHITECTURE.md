# Majlis Media Studio — Architecture

Internal media production workspace for The Majlis Academy. **Standalone.**
Separate codebase (`media-app/`), separate Supabase project, separate auth
users, separate database. Nothing here imports from, queries, or links to
the Founder OS / CRM app at the repo root, and it must stay that way.

## 1. Stack

- **Frontend:** Expo + React Native + TypeScript + Expo Router. One codebase
  for iOS, Android and web (`expo export -p web`), matching the pattern
  already proven in this repo's root app. React Native + `expo-video` /
  `expo-image` give native-quality video playback and image handling on
  mobile, which is the primary device for this team (uploading footage from
  phones, reviewing, approving, commenting).
- **Backend:** Supabase — Postgres, Auth, Storage, Row Level Security,
  Realtime, Edge Functions. A small team (~5, growing) doesn't need bespoke
  infrastructure; Supabase gives auth + relational data + object storage +
  background jobs in one place with strong RLS, which is exactly the shape
  this spec asks for (Section 33/35).
- **Background work:** Supabase Edge Functions (Deno), triggered by a
  scheduled invocation (cron) — never by the mobile app staying open. See
  "Publishing architecture" below.

## 2. Database

Full schema: `supabase/schema.sql`. Entities (see spec Section 34, all
present):

`profiles`, `user_roles`, `campaigns`, `tags`, `content_types`,
`content_items`, `content_assignments`, `content_tags`, `media_assets`,
`media_versions`, `media_asset_tags`, `platform_posts`, `platform_post_media`,
`platform_connections`, `approvals`, `comments`, `mentions`, `schedules`,
`publishing_jobs`, `activity_log`, `notifications`.

Key relationships:

- One `content_items` row is the master item. It owns `owner_id` (required,
  single — "obvious ownership"), optional `approver_id` / `publisher_id`,
  and a `content_assignments` join table for editors/contributors (many
  allowed) and full assignment history.
- Media is split into **assets** (a logical slot — "Reel Cut", a raw clip, a
  Content Bank item) and **versions** (every file ever uploaded into that
  slot: V1, V2, FINAL — `media_versions`, uploader/date/comment on each row,
  rows are never updated or deleted, only appended). `media_assets.section`
  is `raw | draft | final | graphic | other`, matching Section 9's Raw /
  Drafts / Final structure. A Content Bank item is a `media_assets` row with
  `content_item_id = null, is_bank_item = true` — same tables, same version
  history, just not attached to a content item yet; attaching it later is a
  single `update`.
- `platform_posts` is one row per `(content_item, platform)` — Instagram,
  TikTok, LinkedIn each get independent `enabled`, caption, hashtags, cover,
  schedule, `approval_state`, and `publication_status`. `platform_post_media`
  is the ordered join for carousels (drag-to-reorder = updating `sort_order`).
- `approvals` is an append-only decision log, not a status you set directly.
  A client inserts one row (`decision`, optional `platform_post_id`, `note`);
  a `SECURITY DEFINER` trigger (`approvals_after_insert`) is the single
  authoritative place that applies the resulting state transition, locks the
  final media, snapshots what was approved, and fires notifications — so the
  state machine can't be bypassed by a client writing `approval_state`
  directly (there is no RLS `update` grant for that column path outside this
  trigger).
- `activity_log` has no client `insert` policy at all — every row is written
  by `SECURITY DEFINER` trigger functions off the real source-of-truth
  writes (content item changes, uploads, comments, approvals, publish status
  changes), so the audit trail in Section 26 can't be forged or skipped.

## 3. Permissions

Four roles (`app_role` enum): `admin`, `approver`, `creator`, `publisher`.
Stored in `user_roles(user_id, role)` — many-to-many, so a user can hold
several roles (Section 4: "A user may hold more than one role"). Nothing is
hard-coded to a person or email; `is_admin()` / `has_role()` are the only
functions RLS policies call, and the app's `lib/permissions.ts` mirrors the
same checks client-side for UI gating (show/hide, not the security boundary
— RLS is).

Practical behaviour, matching Section 4 exactly:

- **Admin** — full read/write everywhere, manages users/roles/campaigns/tags,
  can approve, schedule, publish, soft-delete.
- **Approver** — comments, requests changes, approves anything where they are
  the item's `approver_id`; scheduling/publishing only if also holding
  `publisher`/`admin`.
- **Creator** (Editor) — creates items, uploads media, edits, assigns work,
  comments, submits for approval.
- **Publisher** — works with approved content, schedules, publishes,
  monitors status.

Row-level enforcement lives in Postgres (`supabase/schema.sql`), not just the
client — see the RLS section at the bottom of that file for the exact policy
per table.

## 4. Storage strategy

One private Supabase Storage bucket, `media`, path-scoped by content item and
section, e.g. `content/{content_item_id}/raw/{version_id}-{filename}` or
`bank/{media_asset_id}/{filename}`. The database **never** stores file bytes
— only `storage_bucket` + `storage_path` + metadata (`media_versions`). The
app resolves a signed URL on demand (`lib/repositories/media.ts:getMediaUrl`)
rather than caching a permanent public link, so access still goes through
Storage's RLS-backed authorization on every view. Any authenticated team
member can read/upload; only the uploader or an admin can delete — matching
"never overwrite" (uploads always create a new version row, delete is not
exposed in the UI for versions at all, only for un-attached Content Bank
items an admin chooses to remove).

## 5. Authentication flow

Supabase Auth, email/password (matches the root app's proven pattern — can
add SSO later without a schema change). `handle_new_user()` trigger creates
a `profiles` row on signup and, only for the very first user ever, grants
`admin` automatically so the team has a way in without a manual SQL step.
Every subsequent signup starts with **no roles** — an existing admin grants
roles from Team settings. The client (`lib/auth.tsx`) exposes `session`,
`profile`, and `roles`; `app/_layout.tsx` gates all routes behind a session
check, redirecting to `(auth)/sign-in` when signed out.

## 6. Content state machine

`content_items.stage` (`content_stage` enum) is the single pipeline
position, driving the Kanban board, Home, and Calendar:

```
idea → script → to_film → editing → approval → approved → scheduled → published
                              ↑___________________|
                        (approver requests changes)
```

Allowed transitions (enforced in `lib/stateMachine.ts`, called before every
stage-changing write; UI only offers legal moves):

| From        | To (forward)                    | To (backward)                     |
|-------------|----------------------------------|------------------------------------|
| idea        | script                            | —                                   |
| script      | to_film, idea                     | idea                                |
| to_film     | editing                            | script                              |
| editing     | approval (requires ≥1 final media + ≥1 enabled platform with caption) | to_film |
| approval    | approved (**only** via an `approvals` insert with `decision='approved'`) | editing (via `decision='changes_requested'`, automatic) |
| approved    | scheduled (requires every enabled platform to have `scheduled_at` or explicit "publish now") | approval (automatic, only if **no** platform has published yet — see below) |
| scheduled   | published (once every enabled platform reaches `published` or `ready_to_post_manually`) | approved (publisher can un-schedule) |
| published   | — (terminal; content can still be edited for record-keeping by admin, but never silently) | — |

**Approval revocation** (Section 20): the `approved → approval` backward
move is never a manual click — it's automatic, fired by triggers
(`media_versions_after_insert`, `platform_posts_before_update`,
`platform_post_media_after_change`) the moment an *approved* item's locked
final video/image, caption, cover, or carousel order changes. If the item's
stage is still `approved` (nothing published yet), the item moves straight
back into the `approval` inbox. If one platform has already published,
the master stage is left alone (you can't un-publish Instagram because
someone edited the TikTok caption) but `needs_reapproval = true` is set and
the UI shows **"Approval required — this content changed after approval"**
on every affected platform tab until that platform is individually
re-approved (`approvals` insert with that `platform_post_id` set).

Per-platform **publication status** (`platform_posts.publication_status`) is
a second, independent state machine per Section 23, one per platform, never
coupled to the others' success/failure:

```
not_prepared → draft → awaiting_approval → approved → scheduled → uploading → processing → published
                                                                       ↘ failed → (retry) → uploading
                                                              ↘ ready_to_post_manually (no API connected)
```

## 7. Navigation & primary screens

Bottom tabs (mobile) / sidebar (web), per Section 5 — Home, Pipeline,
Calendar, Content Bank, Approvals, Published, Team — plus a Notifications
bell and a content item detail screen reached from anywhere:

```
app/
  (auth)/sign-in.tsx
  (tabs)/home.tsx            Home — My Tasks / Due Today / Overdue / Waiting for Me /
                              Awaiting Approval / Scheduled Today / Recently Published
  (tabs)/pipeline.tsx        Kanban board, 8 stage columns, content cards
  (tabs)/calendar.tsx        month/week, filterable, Asia/Dubai
  (tabs)/bank/index.tsx      Content Bank — searchable visual library
  (tabs)/approvals.tsx       Approval inbox — only what's waiting on me
  (tabs)/published.tsx       Published archive
  (tabs)/team.tsx            Team roster, workload, roles
  content/[id]/index.tsx     Content item detail (Overview / Media / Platforms / Comments / Activity)
  notifications.tsx          Notification centre
  admin/campaigns-tags.tsx   Admin: campaigns, tags, content types, roles
  settings.tsx                Profile, sign out
```

## 8. Can Build Immediately vs. Requires External Social API

**Can build immediately (all of V1's actual workflow):** auth, roles,
navigation, pipeline, content items, assignments, media upload/versioning/
playback, autosave, optimistic concurrency, comments/@mentions, platform
version editing (IG/TikTok/LinkedIn fields, captions, covers, scheduling),
approval workflow + locking + auto-revoke, calendar, Content Bank, published
archive, notifications, campaigns/tags, search, simple content-mix insights,
and the full **"Ready to Post Manually"** fallback. None of this waits on a
single social API — this is deliberately ~95% of the spec.

**Requires external social API approval/credentials** (Section 24) — built
as a clean abstraction now, connected later one at a time (Instagram →
LinkedIn → TikTok):

- `lib/publishing/*` defines `PublishAdapter` with `publish(post)`,
  `checkStatus(post)`; `instagram.ts` / `linkedin.ts` / `tiktok.ts` are
  stub adapters that return `{ status: 'not_connected' }` until real
  credentials exist — the rest of the app never has to know the difference.
- `supabase/functions/publish-dispatcher` is the Edge Function skeleton a
  cron invokes to walk due `schedules`, create a `publishing_jobs` row, and
  call the adapter — already wired to `platform_posts`/`schedules` so
  turning on a real adapter later is a one-file change, not a redesign.
- Required per platform before it can go live (documented in full in
  `docs/social-api-requirements.md`): a developer/business account, app
  review, OAuth scopes, and for Instagram/TikTok a webhook endpoint for
  async status. None of that blocks anything else in this list.
