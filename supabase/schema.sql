create extension if not exists "pgcrypto";

create type owner_type as enum ('Mufida', 'Victoria', 'Both');
create type project_status as enum ('Active', 'Blocked', 'Complete');
create type task_status as enum ('Todo', 'Doing', 'Waiting', 'Done');
create type decision_status as enum ('Waiting', 'Agreed', 'Discuss');

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
  primary key (workspace_id, user_id)
);

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
  start_at timestamptz,
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
  created_at timestamptz not null default now()
);

create table if not exists decisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  project_id uuid references projects(id) on delete set null,
  title text not null,
  rationale text,
  status decision_status not null default 'Waiting',
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

create policy "members read workspaces" on workspaces
for select using (public.is_workspace_member(id));

create policy "members read membership" on workspace_members
for select using (public.is_workspace_member(workspace_id));

create policy "members manage projects" on projects
for all using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy "members manage project tasks" on project_tasks
for all using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy "members manage drops" on drops
for all using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy "members manage decisions" on decisions
for all using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy "members manage organisations" on organisations
for all using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy "members manage contacts" on contacts
for all using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy "members manage threads" on threads
for all using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy "members manage messages" on messages
for all using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));
