# Social API integration requirements

None of this blocks the rest of the app (see `ARCHITECTURE.md` §8). This is
the checklist for turning on each `lib/publishing/*` adapter for real,
**in the preferred order: Instagram → LinkedIn → TikTok.**

Until an adapter is connected, `platform_connections.is_connected` for that
platform stays `false`, the UI shows **"Not Connected"** everywhere (never a
fake success), and approved content shows **"Ready to Post Manually"**
instead (final media, caption, hashtags, cover, posting time — everything a
human needs to post it by hand).

## General rules

- All secrets (access tokens, client secrets, refresh tokens) live in
  Supabase Edge Function secrets (`supabase secrets set ...`) or Supabase
  Vault — **never** in a client-readable table, never in the Expo app bundle.
- `platform_connections` only ever stores a boolean + who connected it +
  non-secret metadata (e.g. the connected account's display name) — enough
  for the UI, nothing sensitive.
- Every publish attempt is one `publishing_jobs` row; retries are new rows
  against the same `platform_posts.id`, never mutating a past attempt.

## 1. Instagram (Meta Graph API — Instagram Content Publishing)

- A Meta developer account + a Meta Business app in **Live** mode.
- The Instagram account must be a **Business or Creator account** linked to
  a Facebook Page.
- App Review approval for scopes: `instagram_basic`,
  `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`.
- Publishing flow is two-step: create a media container (video/image/
  carousel), poll its status, then publish the container — `checkStatus()`
  in the adapter already models this as `processing → published`.
- Known limits: Reels/video containers can take minutes to finish
  processing server-side; carousels need 2–10 children; no true
  "TikTok-style" scheduled publish-later in the API — the dispatcher Edge
  Function holds the post until `scheduled_at` and calls the API at that
  time itself (Supabase cron), not Meta.
- No webhook is required for basic publishing (poll `checkStatus`), but a
  webhook subscription (`instagram` object, field `comments`/`mentions`) is
  optional if Phase 2 wants comment sync.

## 2. LinkedIn (LinkedIn Marketing API / Community Management API)

- A LinkedIn Developer app tied to a Company Page the team administers.
- Product access request for **Share on LinkedIn** / **Community Management
  API**, which requires LinkedIn's partner review — this can take longer
  than Meta's, factor that into rollout order even though it's step 2.
- OAuth scopes: `w_member_social` (posting as a person) or
  `w_organization_social` (posting as the Page — almost certainly what The
  Majlis Academy wants).
- No native scheduling in the API — same pattern as Instagram, the
  dispatcher calls LinkedIn's `POST /posts` at the scheduled time.
- No webhook needed for publishing; LinkedIn returns the post URN
  synchronously, so `checkStatus()` is mostly a formality here.

## 3. TikTok (TikTok Content Posting API)

- A TikTok for Developers app + **Content Posting API** product access,
  which requires an app audit (expect this to be the slowest approval of
  the three).
- Two publishing modes, both already modeled by
  `platform_posts.publishing_method`:
  - **Direct Post** (`direct`) — fully automated, posts straight to the
    account. Requires the app to pass TikTok's stricter audit tier.
  - **Send to TikTok to finish** (`send_to_finish`) — uploads the video into
    the creator's TikTok drafts/inbox via the same API, and a human opens
    the TikTok app to add sounds/text/effects and taps post themselves.
    This is deliberately kept as a first-class option (Section 17) because
    creators regularly want native TikTok editing before it goes out — it
    is not a fallback, it's a real publishing method, so the UI should
    offer this the same way it offers Direct Post, not hide it behind
    "advanced".
- OAuth scopes: `video.publish` (direct), `video.upload` (drafts/inbox).
- Webhook: TikTok pushes a **publish status callback** — the dispatcher
  needs an Edge Function HTTP endpoint registered as the webhook URL to
  receive it and update `publishing_jobs`/`platform_posts` asynchronously,
  since Direct Post completion isn't always synchronous.

## Rollout checklist per platform (repeat for each)

1. Register developer app, complete business verification.
2. Request the scopes above; submit for review with screen recordings of
   this app's actual publish flow (all three platforms require this).
3. Store the resulting long-lived token via `supabase secrets set` (never
   in a table).
4. Implement the real adapter in `lib/publishing/{platform}.ts`, replacing
   the stub's `not_connected` return with the actual API call.
5. Flip `platform_connections.is_connected = true` for that platform (admin
   action from Team/Settings) — this alone changes the UI from "Not
   Connected" to live publishing, no other code path changes.
6. Keep manual fallback available regardless — a platform being connected
   never removes a user's ability to see "Ready to Post Manually" and copy
   the caption/media by hand if a publish attempt fails.
