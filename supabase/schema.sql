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
    create type task_status as enum ('Todo', 'Doing', 'Waiting', 'Done');
  end if;
  if not exists (select 1 from pg_type where typname = 'decision_status') then
    create type decision_status as enum ('Waiting', 'Agreed', 'Discuss');
  end if;
  if not exists (select 1 from pg_type where typname = 'ai_action_status') then
    create type ai_action_status as enum ('Proposed', 'Applied', 'Dismissed');
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
  quiet_hours_start time,
  quiet_hours_end time,
  timezone text not null default 'Asia/Dubai',
  last_seen_at timestamptz,
  primary key (workspace_id, user_id)
);

-- Fresh installs get the column from the table definition above; existing
-- databases created from an earlier version of this script pick it up here.
alter table workspace_members add column if not exists last_seen_at timestamptz;

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  title text not null,
  status project_status not null default 'Active',
  progress int not null default 0 check (progress between 0 and 100),
  next_action text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists project_tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  project_id uuid references projects(id) on delete cascade not null,
  title text not null,
  owner_user_id uuid references auth.users(id),
  status task_status not null default 'Todo',
  weight integer not null default 0,
  start_at timestamptz,
  due_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table project_tasks add column if not exists weight integer not null default 0;

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

-- Columns added after the initial release; harmless no-ops on a fresh install.
alter table project_tasks add column if not exists created_by uuid references auth.users(id);
alter table decisions add column if not exists owner owner_type;
alter table organisations add column if not exists created_by uuid references auth.users(id);

create index if not exists idx_project_tasks_project on project_tasks(project_id);
create index if not exists idx_activity_events_workspace_created on activity_events(workspace_id, created_at desc);
create index if not exists idx_activity_events_organisation on activity_events(organisation_id, created_at desc);
create index if not exists idx_ai_actions_workspace_status on ai_actions(workspace_id, status);
create index if not exists idx_ai_actions_drop on ai_actions(drop_id);
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
alter table threads enable row level security;
alter table messages enable row level security;
alter table activity_events enable row level security;
alter table ai_actions enable row level security;

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

-- A project's progress is derived, not hand-set: each task carries a
-- weight (percentage points), and progress is the sum of weights of that
-- project's Done tasks. Recalculated whenever any task in the project is
-- added, changed, or removed, so it can never drift from the task list.
create or replace function public.recalc_project_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid;
  v_total integer;
begin
  v_project_id := coalesce(new.project_id, old.project_id);

  select coalesce(sum(weight), 0) into v_total
  from project_tasks
  where project_id = v_project_id and status = 'Done';

  update projects set progress = least(100, greatest(0, v_total)) where id = v_project_id;
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
begin
  select * into v_thread from threads where id = new.thread_id;
  insert into activity_events (workspace_id, actor_user_id, entity_type, entity_id, project_id, organisation_id, action, summary)
  values (
    new.workspace_id,
    auth.uid(),
    'message',
    new.id,
    v_thread.project_id,
    v_thread.organisation_id,
    'message_posted',
    left(new.body, 140)
  );
  return new;
end;
$$;

drop trigger if exists trg_log_message_activity on messages;
create trigger trg_log_message_activity
after insert on messages
for each row execute function public.log_message_activity();
