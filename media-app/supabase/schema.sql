-- Majlis Media Studio — database schema
--
-- This is a completely separate Supabase project from the Founder OS / CRM
-- app at the repo root. Nothing in here references, imports, or depends on
-- that app's schema, and it must never be pointed at the same project.
--
-- Idempotent throughout (create table/policy "if not exists" / drop-then-
-- create for policies) so it is safe to re-run after pulling schema changes.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type app_role as enum ('admin', 'approver', 'creator', 'publisher');
  end if;
  if not exists (select 1 from pg_type where typname = 'content_stage') then
    create type content_stage as enum
      ('idea', 'script', 'to_film', 'editing', 'approval', 'approved', 'scheduled', 'published');
  end if;
  if not exists (select 1 from pg_type where typname = 'content_priority') then
    create type content_priority as enum ('low', 'normal', 'high', 'urgent');
  end if;
  if not exists (select 1 from pg_type where typname = 'approval_state') then
    create type approval_state as enum ('not_submitted', 'pending', 'changes_requested', 'approved', 'revoked');
  end if;
  if not exists (select 1 from pg_type where typname = 'media_section') then
    create type media_section as enum ('raw', 'draft', 'final', 'graphic', 'other');
  end if;
  if not exists (select 1 from pg_type where typname = 'media_kind') then
    create type media_kind as enum ('video', 'image', 'pdf', 'other');
  end if;
  if not exists (select 1 from pg_type where typname = 'assignment_role') then
    create type assignment_role as enum ('owner', 'editor', 'approver', 'publisher', 'contributor');
  end if;
  if not exists (select 1 from pg_type where typname = 'platform_name') then
    create type platform_name as enum ('instagram', 'tiktok', 'linkedin');
  end if;
  if not exists (select 1 from pg_type where typname = 'post_type') then
    create type post_type as enum ('reel', 'image', 'carousel', 'story', 'video', 'post');
  end if;
  if not exists (select 1 from pg_type where typname = 'publishing_method') then
    create type publishing_method as enum ('direct', 'send_to_finish');
  end if;
  if not exists (select 1 from pg_type where typname = 'publication_status') then
    create type publication_status as enum
      ('not_prepared', 'draft', 'awaiting_approval', 'approved', 'scheduled',
       'uploading', 'processing', 'published', 'failed', 'ready_to_post_manually');
  end if;
  if not exists (select 1 from pg_type where typname = 'schedule_status') then
    create type schedule_status as enum ('pending', 'due', 'completed', 'cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'job_status') then
    create type job_status as enum ('queued', 'running', 'succeeded', 'failed');
  end if;
  if not exists (select 1 from pg_type where typname = 'job_trigger') then
    create type job_trigger as enum ('schedule', 'publish_now', 'manual_retry');
  end if;
  if not exists (select 1 from pg_type where typname = 'notification_type') then
    create type notification_type as enum
      ('assigned', 'mentioned', 'approval_requested', 'changes_requested', 'approved',
       'deadline_approaching', 'overdue', 'publish_failed', 'publish_succeeded', 'comment_reply');
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- People & roles
-- ---------------------------------------------------------------------------

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists user_roles (
  user_id uuid not null references profiles(id) on delete cascade,
  role app_role not null,
  granted_by uuid references profiles(id),
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

-- SECURITY DEFINER so RLS policies (including on user_roles itself) can call
-- this without recursing into user_roles' own RLS.
create or replace function has_role(p_user uuid, p_role app_role)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from user_roles where user_id = p_user and role = p_role);
$$;

create or replace function is_admin(p_user uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select has_role(p_user, 'admin');
$$;

-- Bootstraps a profile row (and, for the very first user, an admin role) the
-- moment someone signs up. Mirrors auth.users -> profiles, and gives the team
-- a way in without a manual SQL step for the first admin.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)), new.email)
  on conflict (id) do nothing;

  if not exists (select 1 from user_roles) then
    insert into user_roles (user_id, role) values (new.id, 'admin');
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- Campaigns, tags, content types (all admin-managed, never hard-coded)
-- ---------------------------------------------------------------------------

create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  color text,
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists content_types (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  icon text,
  sort_order int not null default 0,
  is_active boolean not null default true
);

insert into content_types (key, label, icon, sort_order) values
  ('reel', 'Reel / Short-form Video', 'film', 1),
  ('image', 'Static Image', 'image', 2),
  ('carousel', 'Carousel', 'layers', 3),
  ('story', 'Story Asset', 'circle', 4),
  ('testimonial', 'Testimonial', 'message-circle', 5),
  ('founder_video', 'Founder Video', 'user', 6),
  ('educational', 'Educational Post', 'book-open', 7),
  ('product', 'Product Post', 'box', 8),
  ('behind_the_scenes', 'Behind-the-Scenes', 'camera', 9),
  ('long_form', 'Long-form Video', 'video', 10),
  ('other', 'Other', 'more-horizontal', 99)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Master content item
-- ---------------------------------------------------------------------------

create table if not exists content_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  script text,
  content_type_id uuid references content_types(id),
  campaign_id uuid references campaigns(id),
  owner_id uuid not null references profiles(id),
  approver_id uuid references profiles(id),
  publisher_id uuid references profiles(id),
  stage content_stage not null default 'idea',
  priority content_priority not null default 'normal',
  due_date date,
  internal_notes text,
  approval_state approval_state not null default 'not_submitted',
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  approved_final_media_version_id uuid,
  needs_reapproval boolean not null default false,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version int not null default 1,
  deleted_at timestamptz
);

create index if not exists idx_content_items_stage on content_items(stage) where deleted_at is null;
create index if not exists idx_content_items_owner on content_items(owner_id) where deleted_at is null;
create index if not exists idx_content_items_approver on content_items(approver_id) where deleted_at is null;
create index if not exists idx_content_items_campaign on content_items(campaign_id);
create index if not exists idx_content_items_due on content_items(due_date) where deleted_at is null;

create table if not exists content_assignments (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references content_items(id) on delete cascade,
  user_id uuid not null references profiles(id),
  role_on_item assignment_role not null,
  assigned_by uuid references profiles(id),
  assigned_at timestamptz not null default now(),
  unique (content_item_id, user_id, role_on_item)
);

create index if not exists idx_content_assignments_item on content_assignments(content_item_id);
create index if not exists idx_content_assignments_user on content_assignments(user_id);

create table if not exists content_tags (
  content_item_id uuid not null references content_items(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  primary key (content_item_id, tag_id)
);

-- ---------------------------------------------------------------------------
-- Media: assets (logical file slot) + versions (every upload, never deleted)
-- ---------------------------------------------------------------------------

create table if not exists media_assets (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid references content_items(id) on delete set null,
  section media_section not null default 'other',
  title text not null default 'Untitled',
  kind media_kind not null default 'other',
  is_bank_item boolean not null default false,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_media_assets_content_item on media_assets(content_item_id);
create index if not exists idx_media_assets_bank on media_assets(is_bank_item) where is_bank_item;

create table if not exists media_versions (
  id uuid primary key default gen_random_uuid(),
  media_asset_id uuid not null references media_assets(id) on delete cascade,
  version_number int not null,
  version_label text not null,
  storage_bucket text not null default 'media',
  storage_path text not null,
  file_name text not null,
  mime_type text,
  file_size_bytes bigint,
  duration_seconds numeric,
  width int,
  height int,
  thumbnail_path text,
  uploaded_by uuid references profiles(id),
  uploaded_at timestamptz not null default now(),
  upload_comment text,
  unique (media_asset_id, version_number)
);

create index if not exists idx_media_versions_asset on media_versions(media_asset_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'content_items_approved_final_media_fk') then
    alter table content_items
      add constraint content_items_approved_final_media_fk
      foreign key (approved_final_media_version_id) references media_versions(id)
      on delete set null
      not valid;
  end if;
  alter table content_items validate constraint content_items_approved_final_media_fk;
end
$$;

create table if not exists media_asset_tags (
  media_asset_id uuid not null references media_assets(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  primary key (media_asset_id, tag_id)
);

-- ---------------------------------------------------------------------------
-- Platform-specific versions
-- ---------------------------------------------------------------------------

create table if not exists platform_posts (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references content_items(id) on delete cascade,
  platform platform_name not null,
  enabled boolean not null default false,
  caption text,
  hashtags text[] not null default '{}',
  post_type post_type,
  cover_media_version_id uuid references media_versions(id),
  publishing_method publishing_method not null default 'direct',
  scheduled_at timestamptz,
  timezone text not null default 'Asia/Dubai',
  approval_state approval_state not null default 'not_submitted',
  approved_snapshot jsonb,
  publication_status publication_status not null default 'not_prepared',
  live_url text,
  error_message text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id),
  version int not null default 1,
  unique (content_item_id, platform)
);

create index if not exists idx_platform_posts_item on platform_posts(content_item_id);
create index if not exists idx_platform_posts_scheduled on platform_posts(scheduled_at) where enabled;
create index if not exists idx_platform_posts_status on platform_posts(publication_status);

create table if not exists platform_post_media (
  id uuid primary key default gen_random_uuid(),
  platform_post_id uuid not null references platform_posts(id) on delete cascade,
  media_version_id uuid not null references media_versions(id) on delete cascade,
  sort_order int not null default 0,
  unique (platform_post_id, media_version_id)
);

create index if not exists idx_platform_post_media_post on platform_post_media(platform_post_id, sort_order);

-- Per-platform connection flags only — no tokens live in this table. Real
-- OAuth tokens/secrets belong in Supabase Edge Function secrets / Vault,
-- never in a normal Postgres table readable by the client. See
-- ARCHITECTURE.md "Publishing integration".
create table if not exists platform_connections (
  platform platform_name primary key,
  is_connected boolean not null default false,
  connected_by uuid references profiles(id),
  connected_at timestamptz,
  meta jsonb not null default '{}'::jsonb
);

insert into platform_connections (platform, is_connected) values
  ('instagram', false), ('tiktok', false), ('linkedin', false)
on conflict (platform) do nothing;

-- ---------------------------------------------------------------------------
-- Approvals (append-only decision log)
-- ---------------------------------------------------------------------------

create table if not exists approvals (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references content_items(id) on delete cascade,
  platform_post_id uuid references platform_posts(id) on delete cascade,
  decision text not null check (decision in ('approved', 'changes_requested')),
  decided_by uuid not null references profiles(id),
  decided_at timestamptz not null default now(),
  note text
);

create index if not exists idx_approvals_item on approvals(content_item_id, decided_at desc);

-- ---------------------------------------------------------------------------
-- Comments & mentions (per content item, no general chat)
-- ---------------------------------------------------------------------------

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references content_items(id) on delete cascade,
  author_id uuid not null references profiles(id),
  body text not null,
  parent_comment_id uuid references comments(id) on delete cascade,
  media_version_id uuid references media_versions(id) on delete set null,
  video_timestamp_seconds numeric, -- reserved for Phase 2 timestamped video comments
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_comments_item on comments(content_item_id, created_at);

create table if not exists mentions (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references comments(id) on delete cascade,
  mentioned_user_id uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_mentions_user on mentions(mentioned_user_id);

-- ---------------------------------------------------------------------------
-- Scheduling & publishing execution
-- ---------------------------------------------------------------------------

create table if not exists schedules (
  id uuid primary key default gen_random_uuid(),
  platform_post_id uuid not null references platform_posts(id) on delete cascade unique,
  content_item_id uuid not null references content_items(id) on delete cascade,
  platform platform_name not null,
  scheduled_at timestamptz not null,
  timezone text not null default 'Asia/Dubai',
  status schedule_status not null default 'pending',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_schedules_due on schedules(scheduled_at) where status = 'pending';

create table if not exists publishing_jobs (
  id uuid primary key default gen_random_uuid(),
  platform_post_id uuid not null references platform_posts(id) on delete cascade,
  schedule_id uuid references schedules(id) on delete set null,
  attempt_number int not null default 1,
  status job_status not null default 'queued',
  trigger_source job_trigger not null default 'schedule',
  requested_by uuid references profiles(id),
  started_at timestamptz,
  finished_at timestamptz,
  error_message text,
  response_payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_publishing_jobs_post on publishing_jobs(platform_post_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Activity log (system-generated only — no direct client insert policy)
-- ---------------------------------------------------------------------------

create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references content_items(id) on delete cascade,
  actor_id uuid references profiles(id),
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_log_item on activity_log(content_item_id, created_at);

create or replace function log_activity(p_item uuid, p_actor uuid, p_action text, p_detail jsonb default '{}'::jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  insert into activity_log (content_item_id, actor_id, action, detail)
  values (p_item, p_actor, p_action, p_detail);
$$;

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type notification_type not null,
  content_item_id uuid references content_items(id) on delete cascade,
  platform_post_id uuid references platform_posts(id) on delete cascade,
  comment_id uuid references comments(id) on delete cascade,
  actor_id uuid references profiles(id),
  title text not null,
  body text,
  group_key text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user on notifications(user_id, read_at, created_at desc);

create or replace function notify(
  p_user uuid, p_type notification_type, p_title text, p_body text default null,
  p_item uuid default null, p_post uuid default null, p_comment uuid default null,
  p_actor uuid default null, p_group_key text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user is null or p_user = p_actor then
    return;
  end if;
  insert into notifications (user_id, type, title, body, content_item_id, platform_post_id, comment_id, actor_id, group_key)
  values (p_user, p_type, p_title, p_body, p_item, p_post, p_comment, p_actor, p_group_key);
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers: touch/version bump + activity + notifications
-- ---------------------------------------------------------------------------

-- Optimistic concurrency: every update bumps version + updated_at server-side.
-- Clients must include `.eq('version', expectedVersion)` on their update; a
-- 0-row result means someone else saved first (see lib/repositories/contentItems.ts).
create or replace function bump_content_item_version()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.version := old.version + 1;
  return new;
end;
$$;

drop trigger if exists trg_content_items_touch on content_items;
create trigger trg_content_items_touch
  before update on content_items
  for each row execute function bump_content_item_version();

create or replace function bump_platform_post_version()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.version := old.version + 1;
  return new;
end;
$$;

drop trigger if exists trg_platform_posts_touch on platform_posts;
create trigger trg_platform_posts_touch
  before update on platform_posts
  for each row execute function bump_platform_post_version();

-- Stage/assignment/approval-state changes -> activity log + notifications.
create or replace function content_items_after_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
begin
  if new.stage is distinct from old.stage then
    perform log_activity(new.id, actor, 'stage_changed', jsonb_build_object('from', old.stage, 'to', new.stage));
    if new.stage = 'approval' and new.approver_id is not null then
      perform notify(new.approver_id, 'approval_requested', new.title || ' is ready for your approval',
        'Submitted by the content team.', new.id, null, null, actor, 'approval:' || new.id);
    end if;
  end if;

  if new.owner_id is distinct from old.owner_id then
    perform log_activity(new.id, actor, 'owner_changed', jsonb_build_object('from', old.owner_id, 'to', new.owner_id));
    perform notify(new.owner_id, 'assigned', 'You were made owner of ' || new.title, null, new.id, null, null, actor);
  end if;

  if new.approver_id is distinct from old.approver_id and new.approver_id is not null then
    perform log_activity(new.id, actor, 'approver_changed', jsonb_build_object('to', new.approver_id));
  end if;

  if new.needs_reapproval and not old.needs_reapproval then
    perform notify(new.approver_id, 'approval_requested', new.title || ' changed after approval',
      'Approval required — this content changed after approval.', new.id, null, null, actor, 'reapproval:' || new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_content_items_after_update on content_items;
create trigger trg_content_items_after_update
  after update on content_items
  for each row execute function content_items_after_update();

create or replace function content_items_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform log_activity(new.id, coalesce(auth.uid(), new.created_by), 'created', jsonb_build_object('title', new.title));
  if new.owner_id is not null then
    perform notify(new.owner_id, 'assigned', 'You were made owner of ' || new.title, null, new.id, null, null, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_content_items_after_insert on content_items;
create trigger trg_content_items_after_insert
  after insert on content_items
  for each row execute function content_items_after_insert();

-- New assignment -> log + notify (skip self-assignment noise).
create or replace function content_assignments_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  item_title text;
begin
  select title into item_title from content_items where id = new.content_item_id;
  perform log_activity(new.content_item_id, auth.uid(), 'assigned', jsonb_build_object('user_id', new.user_id, 'role', new.role_on_item));
  perform notify(new.user_id, 'assigned', 'You were added as ' || new.role_on_item || ' on ' || item_title,
    null, new.content_item_id, null, null, auth.uid());
  return new;
end;
$$;

drop trigger if exists trg_content_assignments_after_insert on content_assignments;
create trigger trg_content_assignments_after_insert
  after insert on content_assignments
  for each row execute function content_assignments_after_insert();

-- Shared by every revoke path below: if nothing has published yet, pull the
-- item straight back into the Approval column so it re-enters the inbox;
-- if a platform already published, leave the master stage alone (never
-- un-publish Instagram because the TikTok caption changed) — the
-- needs_reapproval flag and per-platform "Approval required" banner still
-- surface the problem either way.
create or replace function maybe_revert_to_approval(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cur_stage content_stage;
  already_published boolean;
begin
  select stage into cur_stage from content_items where id = p_item_id;
  if cur_stage not in ('approved', 'scheduled') then
    return;
  end if;
  select exists(select 1 from platform_posts where content_item_id = p_item_id and publication_status = 'published')
    into already_published;
  if already_published then
    return;
  end if;
  update content_items set stage = 'approval' where id = p_item_id;
end;
$$;

-- New media version -> log + auto-revoke approval if it replaces the locked final.
create or replace function media_versions_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  asset media_assets%rowtype;
  item content_items%rowtype;
begin
  select * into asset from media_assets where id = new.media_asset_id;
  if asset.content_item_id is not null then
    perform log_activity(asset.content_item_id, auth.uid(), 'media_uploaded',
      jsonb_build_object('version_label', new.version_label, 'section', asset.section, 'asset_title', asset.title));

    select * into item from content_items where id = asset.content_item_id;
    if asset.section = 'final' and item.approval_state = 'approved' then
      update content_items
        set approval_state = 'revoked', needs_reapproval = true
        where id = item.id;
      perform maybe_revert_to_approval(item.id);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_media_versions_after_insert on media_versions;
create trigger trg_media_versions_after_insert
  after insert on media_versions
  for each row execute function media_versions_after_insert();

-- Platform post material change after approval -> revoke that platform only.
create or replace function platform_posts_before_update()
returns trigger
language plpgsql
as $$
begin
  if old.approval_state = 'approved' and (
    new.caption is distinct from old.caption or
    new.hashtags is distinct from old.hashtags or
    new.cover_media_version_id is distinct from old.cover_media_version_id or
    new.post_type is distinct from old.post_type or
    new.scheduled_at is distinct from old.scheduled_at
  ) then
    new.approval_state := 'revoked';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_platform_posts_before_update on platform_posts;
create trigger trg_platform_posts_before_update
  before update on platform_posts
  for each row execute function platform_posts_before_update();

create or replace function platform_posts_after_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.approval_state = 'revoked' and old.approval_state = 'approved' then
    perform log_activity(new.content_item_id, auth.uid(), 'platform_approval_revoked', jsonb_build_object('platform', new.platform));
    update content_items set needs_reapproval = true where id = new.content_item_id and not needs_reapproval;
    perform maybe_revert_to_approval(new.content_item_id);
  end if;

  if new.publication_status is distinct from old.publication_status then
    perform log_activity(new.content_item_id, auth.uid(), 'publication_status_changed',
      jsonb_build_object('platform', new.platform, 'from', old.publication_status, 'to', new.publication_status));
    if new.publication_status = 'published' then
      perform notify(new.updated_by, 'publish_succeeded', initcap(new.platform::text) || ' published', new.live_url,
        new.content_item_id, new.id, null, null, 'published:' || new.id);
    elsif new.publication_status = 'failed' then
      perform notify(new.updated_by, 'publish_failed', initcap(new.platform::text) || ' publish failed', new.error_message,
        new.content_item_id, new.id, null, null, 'failed:' || new.id);
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_platform_posts_after_update on platform_posts;
create trigger trg_platform_posts_after_update
  after update on platform_posts
  for each row execute function platform_posts_after_update();

-- Carousel/selection change after approval -> revoke, same rule as caption changes.
create or replace function platform_post_media_after_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  post_id uuid := coalesce(new.platform_post_id, old.platform_post_id);
begin
  update platform_posts
    set approval_state = 'revoked'
    where id = post_id and approval_state = 'approved';
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_platform_post_media_after_change on platform_post_media;
create trigger trg_platform_post_media_after_change
  after insert or update or delete on platform_post_media
  for each row execute function platform_post_media_after_change();

-- The single authoritative path for approval decisions: client inserts one
-- row here; this trigger applies the resulting state transition. See
-- ARCHITECTURE.md "Approval workflow" for the full state table.
create or replace function approvals_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  item content_items%rowtype;
  final_version_id uuid;
begin
  select * into item from content_items where id = new.content_item_id for update;

  if new.platform_post_id is not null then
    if new.decision = 'approved' then
      update platform_posts
        set approval_state = 'approved',
            approved_snapshot = jsonb_build_object(
              'caption', caption, 'hashtags', hashtags, 'cover_media_version_id', cover_media_version_id,
              'post_type', post_type, 'scheduled_at', scheduled_at)
        where id = new.platform_post_id;
    else
      update platform_posts set approval_state = 'changes_requested' where id = new.platform_post_id;
    end if;
    perform log_activity(new.content_item_id, new.decided_by,
      case when new.decision = 'approved' then 'platform_approved' else 'platform_changes_requested' end,
      jsonb_build_object('platform_post_id', new.platform_post_id, 'note', new.note));
    return new;
  end if;

  if new.decision = 'approved' then
    select mv.id into final_version_id
      from media_versions mv join media_assets ma on ma.id = mv.media_asset_id
      where ma.content_item_id = item.id and ma.section = 'final'
      order by mv.uploaded_at desc limit 1;

    update content_items
      set approval_state = 'approved',
          approved_by = new.decided_by,
          approved_at = new.decided_at,
          approved_final_media_version_id = final_version_id,
          needs_reapproval = false,
          stage = case when stage = 'approval' then 'approved' else stage end
      where id = item.id;

    update platform_posts
      set approval_state = 'approved',
          approved_snapshot = jsonb_build_object(
            'caption', caption, 'hashtags', hashtags, 'cover_media_version_id', cover_media_version_id,
            'post_type', post_type, 'scheduled_at', scheduled_at)
      where content_item_id = item.id and enabled;

    perform log_activity(item.id, new.decided_by, 'approved', jsonb_build_object('note', new.note));
    perform notify(item.owner_id, 'approved', item.title || ' was approved', new.note, item.id, null, null, new.decided_by);
  else
    update content_items
      set approval_state = 'changes_requested',
          needs_reapproval = false,
          stage = 'editing'
      where id = item.id;

    perform log_activity(item.id, new.decided_by, 'changes_requested', jsonb_build_object('note', new.note));
    perform notify(item.owner_id, 'changes_requested', item.title || ' needs changes', new.note, item.id, null, null, new.decided_by);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_approvals_after_insert on approvals;
create trigger trg_approvals_after_insert
  after insert on approvals
  for each row execute function approvals_after_insert();

-- Comments -> activity log. Mentions -> notifications.
create or replace function comments_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform log_activity(new.content_item_id, new.author_id, 'commented', jsonb_build_object('comment_id', new.id));
  return new;
end;
$$;

drop trigger if exists trg_comments_after_insert on comments;
create trigger trg_comments_after_insert
  after insert on comments
  for each row execute function comments_after_insert();

create or replace function mentions_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c comments%rowtype;
  item_title text;
begin
  select * into c from comments where id = new.comment_id;
  select title into item_title from content_items where id = c.content_item_id;
  perform notify(new.mentioned_user_id, 'mentioned', 'You were mentioned on ' || item_title,
    left(c.body, 200), c.content_item_id, null, c.id, c.author_id);
  return new;
end;
$$;

drop trigger if exists trg_mentions_after_insert on mentions;
create trigger trg_mentions_after_insert
  after insert on mentions
  for each row execute function mentions_after_insert();

-- Deadline/overdue notifications are time-based, not event-based, so they
-- can't be a row-level trigger. Call this once a day (pg_cron if enabled on
-- the project, otherwise a scheduled Edge Function — see
-- supabase/functions/scheduled-notifications). Dedupes via group_key so a
-- re-run the same day doesn't spam.
create or replace function generate_deadline_notifications()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  gkey text;
begin
  for r in
    select * from content_items
    where deleted_at is null and stage <> 'published' and due_date is not null
      and due_date in (current_date, current_date + 1)
  loop
    gkey := (case when r.due_date = current_date then 'overdue:' else 'due_soon:' end) || r.id || ':' || current_date;
    if not exists (select 1 from notifications where group_key = gkey) then
      perform notify(r.owner_id,
        case when r.due_date < current_date then 'overdue' else 'deadline_approaching' end,
        case when r.due_date < current_date then r.title || ' is overdue' else r.title || ' is due soon' end,
        null, r.id, null, null, null, gkey);
    end if;
  end loop;

  for r in
    select * from content_items
    where deleted_at is null and stage <> 'published' and due_date is not null and due_date < current_date
  loop
    gkey := 'overdue:' || r.id || ':' || current_date;
    if not exists (select 1 from notifications where group_key = gkey) then
      perform notify(r.owner_id, 'overdue', r.title || ' is overdue', null, r.id, null, null, null, gkey);
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table profiles enable row level security;
alter table user_roles enable row level security;
alter table campaigns enable row level security;
alter table tags enable row level security;
alter table content_types enable row level security;
alter table content_items enable row level security;
alter table content_assignments enable row level security;
alter table content_tags enable row level security;
alter table media_assets enable row level security;
alter table media_versions enable row level security;
alter table media_asset_tags enable row level security;
alter table platform_posts enable row level security;
alter table platform_post_media enable row level security;
alter table platform_connections enable row level security;
alter table approvals enable row level security;
alter table comments enable row level security;
alter table mentions enable row level security;
alter table schedules enable row level security;
alter table publishing_jobs enable row level security;
alter table activity_log enable row level security;
alter table notifications enable row level security;

-- profiles: every authenticated team member is visible to every other
-- (small internal team directory); only admin or the user themself edits.
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles for select to authenticated using (true);
drop policy if exists profiles_update on profiles;
create policy profiles_update on profiles for update to authenticated
  using (id = auth.uid() or is_admin(auth.uid()));

-- user_roles: everyone can see who holds what; only admin grants/revokes.
drop policy if exists user_roles_select on user_roles;
create policy user_roles_select on user_roles for select to authenticated using (true);
drop policy if exists user_roles_write on user_roles;
create policy user_roles_write on user_roles for all to authenticated
  using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

-- campaigns: readable by all, managed by admin.
drop policy if exists campaigns_select on campaigns;
create policy campaigns_select on campaigns for select to authenticated using (true);
drop policy if exists campaigns_write on campaigns;
create policy campaigns_write on campaigns for all to authenticated
  using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

-- tags: readable by all; anyone can create-as-you-go, only admin deletes/renames.
drop policy if exists tags_select on tags;
create policy tags_select on tags for select to authenticated using (true);
drop policy if exists tags_insert on tags;
create policy tags_insert on tags for insert to authenticated with check (true);
drop policy if exists tags_update on tags;
create policy tags_update on tags for update to authenticated using (is_admin(auth.uid()));
drop policy if exists tags_delete on tags;
create policy tags_delete on tags for delete to authenticated using (is_admin(auth.uid()));

-- content_types: readable by all, managed by admin.
drop policy if exists content_types_select on content_types;
create policy content_types_select on content_types for select to authenticated using (true);
drop policy if exists content_types_write on content_types;
create policy content_types_write on content_types for all to authenticated
  using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

-- content_items: whole internal team can view; admin/creator/approver/publisher
-- can create; edits allowed for admin or anyone assigned to that item.
drop policy if exists content_items_select on content_items;
create policy content_items_select on content_items for select to authenticated using (deleted_at is null or is_admin(auth.uid()));
drop policy if exists content_items_insert on content_items;
create policy content_items_insert on content_items for insert to authenticated
  with check (is_admin(auth.uid()) or has_role(auth.uid(), 'creator'));
drop policy if exists content_items_update on content_items;
create policy content_items_update on content_items for update to authenticated
  using (
    is_admin(auth.uid()) or owner_id = auth.uid() or approver_id = auth.uid() or publisher_id = auth.uid()
    or exists (select 1 from content_assignments ca where ca.content_item_id = id and ca.user_id = auth.uid())
  );

-- content_assignments
drop policy if exists content_assignments_select on content_assignments;
create policy content_assignments_select on content_assignments for select to authenticated using (true);
drop policy if exists content_assignments_write on content_assignments;
create policy content_assignments_write on content_assignments for all to authenticated
  using (
    is_admin(auth.uid())
    or exists (select 1 from content_items ci where ci.id = content_item_id and (ci.owner_id = auth.uid() or ci.approver_id = auth.uid()))
  )
  with check (
    is_admin(auth.uid())
    or exists (select 1 from content_items ci where ci.id = content_item_id and (ci.owner_id = auth.uid() or ci.approver_id = auth.uid()))
  );

-- content_tags / media_asset_tags: anyone can tag/untag (lightweight, internal team).
drop policy if exists content_tags_all on content_tags;
create policy content_tags_all on content_tags for all to authenticated using (true) with check (true);
drop policy if exists media_asset_tags_all on media_asset_tags;
create policy media_asset_tags_all on media_asset_tags for all to authenticated using (true) with check (true);

-- media_assets / media_versions: readable by all, insert by creator/publisher/admin,
-- never updated/deleted once uploaded (immutable version history).
drop policy if exists media_assets_select on media_assets;
create policy media_assets_select on media_assets for select to authenticated using (true);
drop policy if exists media_assets_insert on media_assets;
create policy media_assets_insert on media_assets for insert to authenticated with check (true);
drop policy if exists media_assets_update on media_assets;
create policy media_assets_update on media_assets for update to authenticated
  using (is_admin(auth.uid()) or created_by = auth.uid());

drop policy if exists media_versions_select on media_versions;
create policy media_versions_select on media_versions for select to authenticated using (true);
drop policy if exists media_versions_insert on media_versions;
create policy media_versions_insert on media_versions for insert to authenticated with check (true);

-- platform_posts / platform_post_media
drop policy if exists platform_posts_select on platform_posts;
create policy platform_posts_select on platform_posts for select to authenticated using (true);
drop policy if exists platform_posts_write on platform_posts;
create policy platform_posts_write on platform_posts for all to authenticated
  using (
    is_admin(auth.uid())
    or exists (
      select 1 from content_items ci where ci.id = content_item_id
      and (ci.owner_id = auth.uid() or ci.approver_id = auth.uid() or ci.publisher_id = auth.uid())
    )
    or exists (select 1 from content_assignments ca where ca.content_item_id = content_item_id and ca.user_id = auth.uid())
  );

drop policy if exists platform_post_media_all on platform_post_media;
create policy platform_post_media_all on platform_post_media for all to authenticated using (true) with check (true);

-- platform_connections: readable by all (drives "Not Connected" UI), only admin flips it.
drop policy if exists platform_connections_select on platform_connections;
create policy platform_connections_select on platform_connections for select to authenticated using (true);
drop policy if exists platform_connections_write on platform_connections;
create policy platform_connections_write on platform_connections for all to authenticated
  using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

-- approvals: readable by all; only the item's approver (or admin) may decide.
drop policy if exists approvals_select on approvals;
create policy approvals_select on approvals for select to authenticated using (true);
drop policy if exists approvals_insert on approvals;
create policy approvals_insert on approvals for insert to authenticated
  with check (
    is_admin(auth.uid())
    or exists (select 1 from content_items ci where ci.id = content_item_id and ci.approver_id = auth.uid())
  );

-- comments: any authenticated team member can read/write; edit/delete own.
drop policy if exists comments_select on comments;
create policy comments_select on comments for select to authenticated using (true);
drop policy if exists comments_insert on comments;
create policy comments_insert on comments for insert to authenticated with check (author_id = auth.uid());
drop policy if exists comments_update on comments;
create policy comments_update on comments for update to authenticated using (author_id = auth.uid() or is_admin(auth.uid()));
drop policy if exists comments_delete on comments;
create policy comments_delete on comments for delete to authenticated using (author_id = auth.uid() or is_admin(auth.uid()));

drop policy if exists mentions_select on mentions;
create policy mentions_select on mentions for select to authenticated using (true);
drop policy if exists mentions_insert on mentions;
create policy mentions_insert on mentions for insert to authenticated with check (true);

-- schedules / publishing_jobs: readable by all; written by publisher/admin
-- (edge functions use the service role key, which bypasses RLS entirely).
drop policy if exists schedules_select on schedules;
create policy schedules_select on schedules for select to authenticated using (true);
drop policy if exists schedules_write on schedules;
create policy schedules_write on schedules for all to authenticated
  using (is_admin(auth.uid()) or has_role(auth.uid(), 'publisher'))
  with check (is_admin(auth.uid()) or has_role(auth.uid(), 'publisher'));

drop policy if exists publishing_jobs_select on publishing_jobs;
create policy publishing_jobs_select on publishing_jobs for select to authenticated using (true);
drop policy if exists publishing_jobs_insert on publishing_jobs;
create policy publishing_jobs_insert on publishing_jobs for insert to authenticated
  with check (is_admin(auth.uid()) or has_role(auth.uid(), 'publisher'));

-- activity_log: read-only to clients; every row is written by a SECURITY
-- DEFINER trigger function, so there is no direct insert policy at all.
drop policy if exists activity_log_select on activity_log;
create policy activity_log_select on activity_log for select to authenticated using (true);

-- notifications: strictly your own.
drop policy if exists notifications_select on notifications;
create policy notifications_select on notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists notifications_update on notifications;
create policy notifications_update on notifications for update to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage: one private bucket, path-scoped, readable/writable by any signed-in
-- team member (small internal team); only the uploader or an admin deletes.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;

drop policy if exists media_bucket_select on storage.objects;
create policy media_bucket_select on storage.objects for select to authenticated
  using (bucket_id = 'media');

drop policy if exists media_bucket_insert on storage.objects;
create policy media_bucket_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'media');

drop policy if exists media_bucket_delete on storage.objects;
create policy media_bucket_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (owner = auth.uid() or is_admin(auth.uid())));
