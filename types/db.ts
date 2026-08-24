// Row shapes as they come back from Supabase (snake_case, matching
// supabase/schema.sql). Kept separate from types/index.ts, which holds the
// view-model shapes the UI renders.

export type OwnerType = 'Mufida' | 'Victoria' | 'Both';
export type ProjectStatus = 'Not Started' | 'Active' | 'Blocked' | 'Complete';
export type TaskStatus = 'Not Started' | 'Started' | 'Ongoing' | 'Done';
export type PriorityLevel = 'Low' | 'Medium' | 'High';
export type DecisionStatus = 'Waiting' | 'Agreed' | 'Discuss';
export type AiActionStatus = 'Proposed' | 'Applied' | 'Dismissed';

export type Workspace = {
  id: string;
  name: string;
  created_at: string;
};

export type WorkspaceMember = {
  workspace_id: string;
  user_id: string;
  display_name: string;
  avatar_emoji: string | null;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  timezone: string;
  last_seen_at: string | null;
};

export type ProjectRow = {
  id: string;
  workspace_id: string;
  title: string;
  status: ProjectStatus;
  progress: number;
  priority: PriorityLevel;
  next_action: string | null;
  due_at: string | null;
  needs_review: boolean;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectTaskRow = {
  id: string;
  workspace_id: string;
  project_id: string;
  title: string;
  owner_user_id: string | null;
  status: TaskStatus;
  weight: number;
  priority: PriorityLevel;
  start_at: string | null;
  due_at: string | null;
  needs_review: boolean;
  section: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskDependencyRow = {
  task_id: string;
  depends_on_task_id: string;
};

export type DropRow = {
  id: string;
  workspace_id: string;
  created_by: string;
  raw_text: string;
  urgent: boolean;
  processed: boolean;
  summary: string | null;
  created_at: string;
};

export type DecisionRow = {
  id: string;
  workspace_id: string;
  project_id: string | null;
  title: string;
  rationale: string | null;
  status: DecisionStatus;
  owner: OwnerType | null;
  created_by: string | null;
  decided_at: string | null;
  created_at: string;
};

export type OrganisationRow = {
  id: string;
  workspace_id: string;
  name: string;
  stage: string;
  owner_user_id: string | null;
  last_contact_at: string | null;
  next_action: string | null;
  next_action_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type EventRow = {
  id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ContactRow = {
  id: string;
  workspace_id: string;
  organisation_id: string | null;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
};

export type ThreadRow = {
  id: string;
  workspace_id: string;
  project_id: string | null;
  task_id: string | null;
  organisation_id: string | null;
  decision_id: string | null;
  created_at: string;
};

export type MessageRow = {
  id: string;
  workspace_id: string;
  thread_id: string;
  author_user_id: string;
  body: string;
  image_path: string | null;
  created_at: string;
};

export type ActivityEventRow = {
  id: string;
  workspace_id: string;
  actor_user_id: string | null;
  entity_type: string;
  entity_id: string;
  project_id: string | null;
  organisation_id: string | null;
  action: string;
  summary: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type AiActionRow = {
  id: string;
  workspace_id: string;
  drop_id: string | null;
  chat_message_id: string | null;
  action_type: string;
  payload: Record<string, unknown>;
  confidence: number | null;
  status: AiActionStatus;
  applied_by: string | null;
  applied_at: string | null;
  created_at: string;
};

export type AiChatRole = 'user' | 'assistant';

export type AiChatMessageRow = {
  id: string;
  workspace_id: string;
  user_id: string;
  role: AiChatRole;
  content: string;
  created_at: string;
};
