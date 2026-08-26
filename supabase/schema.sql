create extension if not exists "pgcrypto";

-- Postgres has no "create type if not exists", so guard each enum for
-- re-runs against a database that already has this script applied.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'owner_type') then
    create type owner_type as enum ('Mufida', 'Victoria', 'Both');
  end if;
  if not exists (select 1 from pg_type where typname = 'project_status') then
    create type project_status as enum ('Active', 'Blocked', 'Complete');
  end if;
  if not exists (select 1 from pg_type where typname = 'task_status') then
    create type task_status as enum ('Not Started', 'Started', 'Ongoing', 'Done');
  end if;
  if not exists (select 1 from pg_type where typname = 'decision_status') then
    create type decision_status as enum ('Waiting', 'Agreed', 'Discuss');
  end if;
  if not exists (select 1 from pg_type where typname = 'ai_action_status') then
    create type ai_action_status as enum ('Proposed', 'Applied', 'Dismissed');
  end if;
  if not exists (select 1 from pg_type where typname = 'priority_level') then
    create type priority_level as enum ('Low', 'Medium', 'High');
  end if;
  if not exists (select 1 from pg_type where typname = 'book_item_key') then
    create type book_item_key as enum (
      'book', 'isbn', 'story_read_english', 'story_read_arabic', 'teacher_toolkit', 'activity_cards',
      'cultural_game', 'sentence_strips', 'flash_cards', 'activity_sheets', 'cultural_box'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'book_box_type') then
    create type book_box_type as enum ('story', 'cultural');
  end if;
end
$$;

-- Postgres can't add an enum value from inside the do-block above (ADD
-- VALUE can't run in the same transaction as other enum DDL), so this is
-- its own statement — a project's lifecycle is now 4 steps (Not Started ->
-- Active -> Blocked -> Complete) instead of 3, since "Active" alone didn't
-- distinguish a project that hasn't been picked up yet from one in motion.
alter type project_status add value if not exists 'Not Started' before 'Active';

-- Covers a database that already ran an earlier version of this file
-- without 'isbn' in book_item_key's initial definition above.
alter type book_item_key add value if not exists 'isbn' after 'book';
alter type book_item_key add value if not exists 'story_read_english' after 'isbn';
alter type book_item_key add value if not exists 'story_read_arabic' after 'story_read_english';

-- A task's lifecycle was originally Todo/Doing/Waiting/Done; Mufida found
-- "Waiting" confusing next to a project's own "Blocked" and asked for
-- clearer wording. RENAME VALUE (unlike ADD VALUE) is safe to run inside a
-- transaction, but has no "IF EXISTS" of its own, so this checks pg_enum
-- first for re-run safety (a fresh install's task_status is created with
-- the new labels above already, so these renames are no-ops there).
do $$
begin
  if exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'task_status' and e.enumlabel = 'Todo') then
    alter type task_status rename value 'Todo' to 'Not Started';
  end if;
  if exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'task_status' and e.enumlabel = 'Doing') then
    alter type task_status rename value 'Doing' to 'Started';
  end if;
  if exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'task_status' and e.enumlabel = 'Waiting') then
    alter type task_status rename value 'Waiting' to 'Ongoing';
  end if;
end
$$;

create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists workspace_members (
  workspace_id uuid references workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_emoji text,
  quiet_hours_start time,
  quiet_hours_end time,
  timezone text not null default 'Asia/Dubai',
  last_seen_at timestamptz,
  -- Per-user opt-in to the advanced personal To-do experience (safely park,
  -- progress history, links, capacity planning). Off by default for
  -- everyone; flipped on for one account at a time via a one-off SQL update,
  -- never hard-coded in the app — the UI just reads this column.
  enhanced_todo_enabled boolean not null default false,
  primary key (workspace_id, user_id)
);

-- Fresh installs get the columns from the table definition above; existing
-- databases created from an earlier version of this script pick them up here.
alter table workspace_members add column if not exists last_seen_at timestamptz;
alter table workspace_members add column if not exists avatar_emoji text;
alter table workspace_members add column if not exists enhanced_todo_enabled boolean not null default false;

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  title text not null,
  status project_status not null default 'Active',
  progress int not null default 0 check (progress between 0 and 100),
  priority priority_level not null default 'Medium',
  next_action text,
  due_at timestamptz,
  needs_review boolean not null default false,
  completed_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table projects add column if not exists priority priority_level not null default 'Medium';
alter table projects add column if not exists due_at timestamptz;
alter table projects add column if not exists needs_review boolean not null default false;
alter table projects add column if not exists completed_at timestamptz;
alter table projects add column if not exists cover_image_path text;

create table if not exists project_tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  project_id uuid references projects(id) on delete cascade not null,
  title text not null,
  owner_user_id uuid references auth.users(id),
  status task_status not null default 'Not Started',
  weight integer not null default 0,
  priority priority_level not null default 'Medium',
  start_at timestamptz,
  due_at timestamptz,
  needs_review boolean not null default false,
  section text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table project_tasks add column if not exists weight integer not null default 0;
alter table project_tasks add column if not exists needs_review boolean not null default false;
alter table project_tasks add column if not exists section text;
alter table project_tasks add column if not exists priority priority_level not null default 'Medium';

create table if not exists task_dependencies (
  task_id uuid references project_tasks(id) on delete cascade,
  depends_on_task_id uuid references project_tasks(id) on delete cascade,
  primary key (task_id, depends_on_task_id)
);

create table if not exists drops (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  created_by uuid references auth.users(id) not null,
  raw_text text not null,
  urgent boolean not null default false,
  processed boolean not null default false,
  summary text,
  created_at timestamptz not null default now()
);
alter table drops add column if not exists summary text;

create table if not exists decisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  project_id uuid references projects(id) on delete set null,
  title text not null,
  rationale text,
  status decision_status not null default 'Waiting',
  owner owner_type,
  created_by uuid references auth.users(id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists organisations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  name text not null,
  stage text not null,
  owner_user_id uuid references auth.users(id),
  last_contact_at timestamptz,
  next_action text,
  next_action_at timestamptz,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  title text not null,
  description text,
  start_at timestamptz not null,
  end_at timestamptz,
  all_day boolean not null default false,
  owner owner_type not null default 'Both',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table events add column if not exists owner owner_type not null default 'Both';

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  organisation_id uuid references organisations(id) on delete cascade,
  name text not null,
  role text,
  email text,
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists threads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  project_id uuid references projects(id) on delete cascade,
  task_id uuid references project_tasks(id) on delete cascade,
  organisation_id uuid references organisations(id) on delete cascade,
  decision_id uuid references decisions(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  thread_id uuid references threads(id) on delete cascade not null,
  author_user_id uuid references auth.users(id) not null,
  body text not null,
  image_path text,
  audio_path text,
  audio_duration_seconds integer,
  created_at timestamptz not null default now()
);

-- Append-only feed of "what changed". Populated by triggers below and read
-- by Catch-Up (changes since a member's last_seen_at) and CRM activity
-- history (changes scoped to one organisation).
create table if not exists activity_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  actor_user_id uuid references auth.users(id),
  entity_type text not null,
  entity_id uuid not null,
  project_id uuid references projects(id) on delete set null,
  organisation_id uuid references organisations(id) on delete set null,
  action text not null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Structured actions proposed by the AI parser (Edge Function) from a Drop.
-- The client reviews these and either applies them (which performs the
-- underlying repository write) or dismisses them.
create table if not exists ai_actions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  drop_id uuid references drops(id) on delete cascade,
  action_type text not null,
  payload jsonb not null default '{}'::jsonb,
  confidence numeric,
  status ai_action_status not null default 'Proposed',
  applied_by uuid references auth.users(id),
  applied_at timestamptz,
  created_at timestamptz not null default now()
);

-- A founder's private back-and-forth with the AI assistant (app/(tabs)/ai.tsx).
-- Not shared with the co-founder — each member only ever sees their own
-- conversation, same privacy boundary as a Drop's raw text.
create table if not exists ai_chat_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

-- A quick personal checklist on Home (app/(tabs)/home.tsx) — sticky-note
-- items for small things that don't need a whole project. Private to the
-- author, same privacy boundary as ai_chat_messages.
create table if not exists todo_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null,
  body text not null,
  done boolean not null default false,
  completed_at timestamptz,
  -- Advanced fields, only surfaced in the UI when the owning user has
  -- enhanced_todo_enabled — but always stored and always private to that
  -- user, same as the rest of this table.
  status text not null default 'active',
  progress_note text,
  estimated_minutes_remaining integer,
  parked_at timestamptz,
  return_at date,
  restart_point text,
  why_it_matters text,
  created_at timestamptz not null default now()
);
alter table todo_items add column if not exists completed_at timestamptz;
alter table todo_items add column if not exists status text not null default 'active';
alter table todo_items add column if not exists progress_note text;
alter table todo_items add column if not exists estimated_minutes_remaining integer;
alter table todo_items add column if not exists parked_at timestamptz;
alter table todo_items add column if not exists return_at date;
alter table todo_items add column if not exists restart_point text;
alter table todo_items add column if not exists why_it_matters text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'todo_items_status_check') then
    alter table todo_items add constraint todo_items_status_check check (status in ('active', 'parked'));
  end if;
end $$;

-- One entry per "update progress" — a running log, never edited or
-- overwritten, so a parked-and-resumed item still shows its full history.
create table if not exists todo_progress_updates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  todo_item_id uuid references todo_items(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null,
  note text not null,
  created_at timestamptz not null default now()
);

-- Links to Canva, ChatGPT/Claude conversations, documents, websites, emails
-- — whatever context a to-do needs, kept with the item instead of scattered.
create table if not exists todo_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  todo_item_id uuid references todo_items(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null,
  link_type text not null default 'other',
  label text,
  url text not null,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'todo_links_type_check') then
    alter table todo_links add constraint todo_links_type_check
      check (link_type in ('chatgpt', 'claude', 'document', 'canva', 'website', 'email', 'other'));
  end if;
end $$;

-- One row per user per day: what they've told the app they have capacity
-- for today. Workload (the other side of the comparison shown on Home) is
-- computed on the fly from estimated_minutes_remaining, not stored here.
create table if not exists todo_daily_capacity (
  workspace_id uuid references workspaces(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null,
  day date not null,
  capacity_minutes integer not null,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id, day)
);

-- Columns added after the initial release; harmless no-ops on a fresh install.
alter table project_tasks add column if not exists created_by uuid references auth.users(id);
alter table decisions add column if not exists owner owner_type;
alter table organisations add column if not exists created_by uuid references auth.users(id);
alter table ai_actions add column if not exists chat_message_id uuid references ai_chat_messages(id) on delete cascade;

create index if not exists idx_events_workspace_start on events(workspace_id, start_at);
create index if not exists idx_project_tasks_project on project_tasks(project_id);
create index if not exists idx_activity_events_workspace_created on activity_events(workspace_id, created_at desc);
create index if not exists idx_activity_events_organisation on activity_events(organisation_id, created_at desc);
create index if not exists idx_ai_actions_workspace_status on ai_actions(workspace_id, status);
create index if not exists idx_ai_actions_drop on ai_actions(drop_id);
create index if not exists idx_ai_actions_chat_message on ai_actions(chat_message_id);
create index if not exists idx_ai_chat_messages_user on ai_chat_messages(workspace_id, user_id, created_at);
create index if not exists idx_todo_items_user on todo_items(workspace_id, user_id, created_at);
create index if not exists idx_todo_progress_updates_item on todo_progress_updates(todo_item_id, created_at desc);
create index if not exists idx_todo_links_item on todo_links(todo_item_id);
create index if not exists idx_threads_project on threads(project_id);
create index if not exists idx_threads_task on threads(task_id);
create index if not exists idx_threads_organisation on threads(organisation_id);
create index if not exists idx_threads_decision on threads(decision_id);
create index if not exists idx_messages_thread on messages(thread_id);

alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table projects enable row level security;
alter table project_tasks enable row level security;
alter table task_dependencies enable row level security;
alter table drops enable row level security;
alter table decisions enable row level security;
alter table organisations enable row level security;
alter table contacts enable row level security;
alter table events enable row level security;
alter table threads enable row level security;
alter table messages enable row level security;
alter table activity_events enable row level security;
alter table ai_actions enable row level security;
alter table ai_chat_messages enable row level security;
alter table todo_items enable row level security;
alter table todo_progress_updates enable row level security;
alter table todo_links enable row level security;
alter table todo_daily_capacity enable row level security;

create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from workspace_members wm
    where wm.workspace_id = target_workspace
      and wm.user_id = auth.uid()
  );
$$;

-- Idempotent policy (re)creation so this script can be re-run safely.
drop policy if exists "members read workspaces" on workspaces;
create policy "members read workspaces" on workspaces
for select using (public.is_workspace_member(id));

drop policy if exists "members read membership" on workspace_members;
create policy "members read membership" on workspace_members
for select using (public.is_workspace_member(workspace_id));

drop policy if exists "members update own membership" on workspace_members;
create policy "members update own membership" on workspace_members
for update using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "members manage projects" on projects;
create policy "members manage projects" on projects
for all using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "members manage project tasks" on project_tasks;
create policy "members manage project tasks" on project_tasks
for all using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "members manage task dependencies" on task_dependencies;
create policy "members manage task dependencies" on task_dependencies
for all using (
  exists(select 1 from project_tasks t where t.id = task_id and public.is_workspace_member(t.workspace_id))
)
with check (
  exists(select 1 from project_tasks t where t.id = task_id and public.is_workspace_member(t.workspace_id))
);

drop policy if exists "members manage drops" on drops;
create policy "members manage drops" on drops
for all using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "members manage decisions" on decisions;
create policy "members manage decisions" on decisions
for all using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "members manage organisations" on organisations;
create policy "members manage organisations" on organisations
for all using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "members manage events" on events;
create policy "members manage events" on events
for all using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "members manage contacts" on contacts;
create policy "members manage contacts" on contacts
for all using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "members manage threads" on threads;
create policy "members manage threads" on threads
for all using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "members manage messages" on messages;
create policy "members manage messages" on messages
for all using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "members read activity" on activity_events;
create policy "members read activity" on activity_events
for select using (public.is_workspace_member(workspace_id));

drop policy if exists "members insert activity" on activity_events;
create policy "members insert activity" on activity_events
for insert with check (public.is_workspace_member(workspace_id));

drop policy if exists "members manage ai actions" on ai_actions;
create policy "members manage ai actions" on ai_actions
for all using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

-- Private to the author, unlike everything else in this file — a founder's
-- own AI chat isn't visible to their co-founder.
drop policy if exists "members manage own ai chat messages" on ai_chat_messages;
create policy "members manage own ai chat messages" on ai_chat_messages
for all using (public.is_workspace_member(workspace_id) and user_id = auth.uid())
with check (public.is_workspace_member(workspace_id) and user_id = auth.uid());

drop policy if exists "members manage own todo items" on todo_items;
create policy "members manage own todo items" on todo_items
for all using (public.is_workspace_member(workspace_id) and user_id = auth.uid())
with check (public.is_workspace_member(workspace_id) and user_id = auth.uid());

drop policy if exists "members manage own todo progress updates" on todo_progress_updates;
create policy "members manage own todo progress updates" on todo_progress_updates
for all using (public.is_workspace_member(workspace_id) and user_id = auth.uid())
with check (public.is_workspace_member(workspace_id) and user_id = auth.uid());

drop policy if exists "members manage own todo links" on todo_links;
create policy "members manage own todo links" on todo_links
for all using (public.is_workspace_member(workspace_id) and user_id = auth.uid())
with check (public.is_workspace_member(workspace_id) and user_id = auth.uid());

drop policy if exists "members manage own todo capacity" on todo_daily_capacity;
create policy "members manage own todo capacity" on todo_daily_capacity
for all using (public.is_workspace_member(workspace_id) and user_id = auth.uid())
with check (public.is_workspace_member(workspace_id) and user_id = auth.uid());

-- Joins the calling user to the shared workspace. Caps membership at two
-- people: reuses the first workspace with a free seat, or creates one.
-- SECURITY DEFINER lets it write workspaces/workspace_members despite the
-- narrower RLS policies above (which don't grant client-side INSERT).
create or replace function public.bootstrap_workspace(p_display_name text default null)
returns workspace_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
  v_row workspace_members;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select wm.workspace_id into v_workspace_id
  from workspace_members wm
  where wm.user_id = auth.uid()
  limit 1;

  if v_workspace_id is null then
    select w.id into v_workspace_id
    from workspaces w
    where (select count(*) from workspace_members m where m.workspace_id = w.id) < 2
    order by w.created_at asc
    limit 1;

    if v_workspace_id is null then
      insert into workspaces (name) values ('Majlis') returning id into v_workspace_id;
    end if;

    insert into workspace_members (workspace_id, user_id, display_name, timezone)
    values (
      v_workspace_id,
      auth.uid(),
      coalesce(nullif(trim(p_display_name), ''), initcap(split_part(auth.jwt() ->> 'email', '@', 1))),
      'Asia/Dubai'
    )
    returning * into v_row;
  else
    select * into v_row from workspace_members where workspace_id = v_workspace_id and user_id = auth.uid();
  end if;

  return v_row;
end;
$$;

grant execute on function public.bootstrap_workspace(text) to authenticated;

-- Activity logging: every insert/update to the core entities writes a
-- human-readable row to activity_events, which is all Catch-Up and CRM
-- history need to read.
create or replace function public.log_project_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into activity_events (workspace_id, actor_user_id, entity_type, entity_id, project_id, action, summary)
    values (new.workspace_id, coalesce(auth.uid(), new.created_by), 'project', new.id, new.id, 'created', 'Created project "' || new.title || '"');
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      insert into activity_events (workspace_id, actor_user_id, entity_type, entity_id, project_id, action, summary)
      values (new.workspace_id, auth.uid(), 'project', new.id, new.id, 'status_changed', '"' || new.title || '" moved to ' || new.status);
    end if;
    if new.progress is distinct from old.progress then
      insert into activity_events (workspace_id, actor_user_id, entity_type, entity_id, project_id, action, summary)
      values (new.workspace_id, auth.uid(), 'project', new.id, new.id, 'progress_changed', '"' || new.title || '" progress updated to ' || new.progress || '%');
    end if;
    if new.next_action is distinct from old.next_action then
      insert into activity_events (workspace_id, actor_user_id, entity_type, entity_id, project_id, action, summary)
      values (new.workspace_id, auth.uid(), 'project', new.id, new.id, 'next_action_changed', '"' || new.title || '" next action set to ' || coalesce(new.next_action, '(cleared)'));
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_project_activity on projects;
create trigger trg_log_project_activity
after insert or update on projects
for each row execute function public.log_project_activity();

create or replace function public.log_task_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_title text;
begin
  select title into v_project_title from projects where id = coalesce(new.project_id, old.project_id);

  if tg_op = 'INSERT' then
    insert into activity_events (workspace_id, actor_user_id, entity_type, entity_id, project_id, action, summary)
    values (new.workspace_id, coalesce(auth.uid(), new.created_by), 'task', new.id, new.project_id, 'created', 'Added task "' || new.title || '" to ' || coalesce(v_project_title, 'a project'));
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      insert into activity_events (workspace_id, actor_user_id, entity_type, entity_id, project_id, action, summary)
      values (new.workspace_id, auth.uid(), 'task', new.id, new.project_id, 'status_changed', '"' || new.title || '" moved to ' || new.status);
    end if;
    if new.owner_user_id is distinct from old.owner_user_id then
      insert into activity_events (workspace_id, actor_user_id, entity_type, entity_id, project_id, action, summary)
      values (new.workspace_id, auth.uid(), 'task', new.id, new.project_id, 'assigned', '"' || new.title || '" reassigned');
    end if;
    if new.due_at is distinct from old.due_at then
      insert into activity_events (workspace_id, actor_user_id, entity_type, entity_id, project_id, action, summary)
      values (new.workspace_id, auth.uid(), 'task', new.id, new.project_id, 'rescheduled', '"' || new.title || '" due date updated');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_task_activity on project_tasks;
create trigger trg_log_task_activity
after insert or update on project_tasks
for each row execute function public.log_task_activity();

create or replace function public.log_event_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into activity_events (workspace_id, actor_user_id, entity_type, entity_id, action, summary)
    values (new.workspace_id, coalesce(auth.uid(), new.created_by), 'event', new.id, 'created', 'Added event "' || new.title || '"');
  elsif tg_op = 'UPDATE' and (new.start_at is distinct from old.start_at or new.title is distinct from old.title) then
    insert into activity_events (workspace_id, actor_user_id, entity_type, entity_id, action, summary)
    values (new.workspace_id, auth.uid(), 'event', new.id, 'updated', 'Updated event "' || new.title || '"');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_event_activity on events;
create trigger trg_log_event_activity
after insert or update on events
for each row execute function public.log_event_activity();

-- A project's progress is derived, not hand-set: every task counts equally
-- (no manual weight to enter — 100 tasks means each is worth 1%), and
-- progress is the share of a project's tasks marked Done. Recalculated
-- whenever any task in the project is added, changed, or removed, so it
-- can never drift from the task list.
create or replace function public.recalc_project_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid;
  v_total integer;
  v_done integer;
begin
  v_project_id := coalesce(new.project_id, old.project_id);

  select count(*), count(*) filter (where status = 'Done')
  into v_total, v_done
  from project_tasks
  where project_id = v_project_id;

  update projects
  set progress = case when v_total = 0 then 0 else round(100.0 * v_done / v_total) end
  where id = v_project_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_recalc_project_progress on project_tasks;
create trigger trg_recalc_project_progress
after insert or update or delete on project_tasks
for each row execute function public.recalc_project_progress();

create or replace function public.log_decision_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into activity_events (workspace_id, actor_user_id, entity_type, entity_id, project_id, action, summary)
    values (new.workspace_id, coalesce(auth.uid(), new.created_by), 'decision', new.id, new.project_id, 'created', 'Raised decision "' || new.title || '"');
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into activity_events (workspace_id, actor_user_id, entity_type, entity_id, project_id, action, summary)
    values (new.workspace_id, auth.uid(), 'decision', new.id, new.project_id, 'status_changed', 'Decision "' || new.title || '" marked ' || new.status);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_decision_activity on decisions;
create trigger trg_log_decision_activity
after insert or update on decisions
for each row execute function public.log_decision_activity();

create or replace function public.log_organisation_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into activity_events (workspace_id, actor_user_id, entity_type, entity_id, organisation_id, action, summary)
    values (new.workspace_id, coalesce(auth.uid(), new.created_by), 'organisation', new.id, new.id, 'created', 'Added ' || new.name || ' to CRM');
  elsif tg_op = 'UPDATE' then
    if new.stage is distinct from old.stage then
      insert into activity_events (workspace_id, actor_user_id, entity_type, entity_id, organisation_id, action, summary)
      values (new.workspace_id, auth.uid(), 'organisation', new.id, new.id, 'stage_changed', new.name || ' moved to ' || new.stage);
    end if;
    if new.notes is distinct from old.notes and new.notes is not null then
      insert into activity_events (workspace_id, actor_user_id, entity_type, entity_id, organisation_id, action, summary)
      values (new.workspace_id, auth.uid(), 'organisation', new.id, new.id, 'note_added', 'Note added on ' || new.name);
    end if;
    if new.next_action is distinct from old.next_action then
      insert into activity_events (workspace_id, actor_user_id, entity_type, entity_id, organisation_id, action, summary)
      values (new.workspace_id, auth.uid(), 'organisation', new.id, new.id, 'follow_up_set', new.name || ' next action: ' || coalesce(new.next_action, '(cleared)'));
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_organisation_activity on organisations;
create trigger trg_log_organisation_activity
after insert or update on organisations
for each row execute function public.log_organisation_activity();

create or replace function public.log_drop_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into activity_events (workspace_id, actor_user_id, entity_type, entity_id, action, summary)
    values (new.workspace_id, coalesce(auth.uid(), new.created_by), 'drop', new.id, case when new.urgent then 'urgent_drop' else 'drop' end,
      left(new.raw_text, 140));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_drop_activity on drops;
create trigger trg_log_drop_activity
after insert on drops
for each row execute function public.log_drop_activity();

create or replace function public.log_message_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_thread threads;
  v_kind text;
  v_anchor_id uuid;
begin
  select * into v_thread from threads where id = new.thread_id;
  v_kind := case
    when v_thread.task_id is not null then 'task'
    when v_thread.project_id is not null then 'project'
    when v_thread.organisation_id is not null then 'organisation'
    when v_thread.decision_id is not null then 'decision'
  end;
  v_anchor_id := coalesce(v_thread.task_id, v_thread.project_id, v_thread.organisation_id, v_thread.decision_id);
  insert into activity_events (workspace_id, actor_user_id, entity_type, entity_id, project_id, organisation_id, action, summary, metadata)
  values (
    new.workspace_id,
    auth.uid(),
    'message',
    new.id,
    v_thread.project_id,
    v_thread.organisation_id,
    'message_posted',
    case
      when trim(new.body) != '' then left(new.body, 140)
      when new.image_path is not null then '📷 Photo'
      when new.audio_path is not null then '🎤 Voice message'
      else left(new.body, 140)
    end,
    jsonb_build_object('thread_kind', v_kind, 'anchor_id', v_anchor_id, 'image_path', new.image_path, 'audio_path', new.audio_path)
  );
  return new;
end;
$$;

drop trigger if exists trg_log_message_activity on messages;
create trigger trg_log_message_activity
after insert on messages
for each row execute function public.log_message_activity();

-- ---------------------------------------------------------------------------
-- Storage: one private bucket for photos attached to messages, path-scoped,
-- readable/writable by any signed-in workspace member (small two-person
-- team); only the uploader deletes their own.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('message-images', 'message-images', false)
on conflict (id) do nothing;

drop policy if exists message_images_select on storage.objects;
create policy message_images_select on storage.objects for select to authenticated
  using (bucket_id = 'message-images');

drop policy if exists message_images_insert on storage.objects;
create policy message_images_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'message-images');

drop policy if exists message_images_delete on storage.objects;
create policy message_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'message-images' and owner = auth.uid());

insert into storage.buckets (id, name, public)
values ('message-audio', 'message-audio', false)
on conflict (id) do nothing;

drop policy if exists message_audio_select on storage.objects;
create policy message_audio_select on storage.objects for select to authenticated
  using (bucket_id = 'message-audio');

drop policy if exists message_audio_insert on storage.objects;
create policy message_audio_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'message-audio');

drop policy if exists message_audio_delete on storage.objects;
create policy message_audio_delete on storage.objects for delete to authenticated
  using (bucket_id = 'message-audio' and owner = auth.uid());

-- Project cover images are shared project data (not personal, unlike
-- messages) — either workspace member can set/replace/remove one.
insert into storage.buckets (id, name, public)
values ('project-covers', 'project-covers', false)
on conflict (id) do nothing;

drop policy if exists project_covers_select on storage.objects;
create policy project_covers_select on storage.objects for select to authenticated
  using (bucket_id = 'project-covers');

drop policy if exists project_covers_insert on storage.objects;
create policy project_covers_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'project-covers');

drop policy if exists project_covers_delete on storage.objects;
create policy project_covers_delete on storage.objects for delete to authenticated
  using (bucket_id = 'project-covers');

-- ---------------------------------------------------------------------------
-- Attachments: links, photos, and documents attached to a project or a task
-- (never both — exactly one of project_id/task_id is set). Shared workspace
-- data, same as the project/task it hangs off, not private to one user.
-- ---------------------------------------------------------------------------

create table if not exists attachments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  project_id uuid references projects(id) on delete cascade,
  task_id uuid references project_tasks(id) on delete cascade,
  label text,
  url text,
  file_path text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (url is not null or file_path is not null),
  check ((project_id is not null) <> (task_id is not null))
);

create index if not exists idx_attachments_project on attachments(project_id);
create index if not exists idx_attachments_task on attachments(task_id);

alter table attachments enable row level security;

drop policy if exists "members manage attachments" on attachments;
create policy "members manage attachments" on attachments
for all using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

drop policy if exists attachments_select on storage.objects;
create policy attachments_select on storage.objects for select to authenticated
  using (bucket_id = 'attachments');

drop policy if exists attachments_insert on storage.objects;
create policy attachments_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments');

drop policy if exists attachments_delete on storage.objects;
create policy attachments_delete on storage.objects for delete to authenticated
  using (bucket_id = 'attachments');

-- ---------------------------------------------------------------------------
-- FS2 Books: a library of completed books, kept separate from the in-progress
-- Projects work. Each book has a fixed checklist of items (Book, Teacher
-- toolkit, Activity cards, Cultural game, Sentence strips, Flash cards,
-- Activity sheets, Cultural box) that can each hold more than one link or
-- attached photo (mostly Canva links, sometimes a photo instead), plus two
-- item lists — Story box items and Cultural box items — that are priced,
-- photographed physical items rather than links.
-- ---------------------------------------------------------------------------

create table if not exists books (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  title text not null,
  cover_image_path text,
  order_index int not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists book_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  book_id uuid references books(id) on delete cascade not null,
  item_key book_item_key not null,
  label text,
  url text,
  file_path text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (url is not null or file_path is not null)
);

create table if not exists book_box_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  book_id uuid references books(id) on delete cascade not null,
  box_type book_box_type not null,
  name text not null,
  price numeric,
  image_path text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_book_links_book on book_links(book_id, item_key);
create index if not exists idx_book_box_items_book on book_box_items(book_id, box_type);

alter table books enable row level security;
alter table book_links enable row level security;
alter table book_box_items enable row level security;

drop policy if exists "members manage books" on books;
create policy "members manage books" on books
for all using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "members manage book links" on book_links;
create policy "members manage book links" on book_links
for all using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "members manage book box items" on book_box_items;
create policy "members manage book box items" on book_box_items
for all using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

insert into storage.buckets (id, name, public)
values ('book-covers', 'book-covers', false)
on conflict (id) do nothing;

drop policy if exists book_covers_select on storage.objects;
create policy book_covers_select on storage.objects for select to authenticated
  using (bucket_id = 'book-covers');

drop policy if exists book_covers_insert on storage.objects;
create policy book_covers_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'book-covers');

drop policy if exists book_covers_delete on storage.objects;
create policy book_covers_delete on storage.objects for delete to authenticated
  using (bucket_id = 'book-covers');

insert into storage.buckets (id, name, public)
values ('book-files', 'book-files', false)
on conflict (id) do nothing;

drop policy if exists book_files_select on storage.objects;
create policy book_files_select on storage.objects for select to authenticated
  using (bucket_id = 'book-files');

drop policy if exists book_files_insert on storage.objects;
create policy book_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'book-files');

drop policy if exists book_files_delete on storage.objects;
create policy book_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'book-files');
