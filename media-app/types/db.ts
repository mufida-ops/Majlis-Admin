// Mirrors supabase/schema.sql. Kept hand-written (not codegen'd) so the
// shapes stay obvious to read; regenerate with `supabase gen types` later if
// the schema grows large enough to make drift a real risk.

export type AppRole = 'admin' | 'approver' | 'creator' | 'publisher';

export type ContentStage = 'idea' | 'producing' | 'approval' | 'published';

export type ContentPriority = 'low' | 'normal' | 'high' | 'urgent';

export type ApprovalState = 'not_submitted' | 'pending' | 'changes_requested' | 'approved' | 'revoked';

export type MediaSection = 'raw' | 'draft' | 'final' | 'graphic' | 'other';
export type MediaKind = 'video' | 'image' | 'pdf' | 'other';

export type AssignmentRole = 'owner' | 'editor' | 'approver' | 'publisher' | 'contributor';

export type PlatformName = 'instagram' | 'tiktok' | 'linkedin';
export type PostType = 'reel' | 'image' | 'carousel' | 'story' | 'video' | 'post';
export type PublishingMethod = 'direct' | 'send_to_finish';
export type PublicationStatus =
  | 'not_prepared' | 'draft' | 'awaiting_approval' | 'approved' | 'scheduled'
  | 'uploading' | 'processing' | 'published' | 'failed' | 'ready_to_post_manually';

export type ScheduleStatus = 'pending' | 'due' | 'completed' | 'cancelled';
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed';
export type JobTrigger = 'schedule' | 'publish_now' | 'manual_retry';

export type NotificationType =
  | 'assigned' | 'mentioned' | 'approval_requested' | 'changes_requested' | 'approved'
  | 'deadline_approaching' | 'overdue' | 'publish_failed' | 'publish_succeeded' | 'comment_reply';

export interface Profile {
  id: string;
  full_name: string;
  email: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface UserRole {
  user_id: string;
  role: AppRole;
  granted_by: string | null;
  granted_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface Tag {
  id: string;
  name: string;
  created_by: string | null;
  created_at: string;
}

export interface ContentType {
  id: string;
  key: string;
  label: string;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface ContentItem {
  id: string;
  title: string;
  description: string | null;
  script: string | null;
  content_type_id: string | null;
  campaign_id: string | null;
  owner_id: string;
  approver_id: string | null;
  publisher_id: string | null;
  stage: ContentStage;
  priority: ContentPriority;
  due_date: string | null;
  internal_notes: string | null;
  approval_state: ApprovalState;
  approved_by: string | null;
  approved_at: string | null;
  approved_final_media_version_id: string | null;
  needs_reapproval: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  version: number;
  deleted_at: string | null;
}

export interface ContentAssignment {
  id: string;
  content_item_id: string;
  user_id: string;
  role_on_item: AssignmentRole;
  assigned_by: string | null;
  assigned_at: string;
}

export interface MediaAsset {
  id: string;
  content_item_id: string | null;
  section: MediaSection;
  title: string;
  kind: MediaKind;
  is_bank_item: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MediaVersion {
  id: string;
  media_asset_id: string;
  version_number: number;
  version_label: string;
  storage_bucket: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  thumbnail_path: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
  upload_comment: string | null;
}

export interface PlatformPost {
  id: string;
  content_item_id: string;
  platform: PlatformName;
  enabled: boolean;
  caption: string | null;
  hashtags: string[];
  post_type: PostType | null;
  cover_media_version_id: string | null;
  publishing_method: PublishingMethod;
  scheduled_at: string | null;
  timezone: string;
  approval_state: ApprovalState;
  approved_snapshot: Record<string, unknown> | null;
  publication_status: PublicationStatus;
  live_url: string | null;
  error_message: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
  version: number;
}

export interface PlatformPostMedia {
  id: string;
  platform_post_id: string;
  media_version_id: string;
  sort_order: number;
}

export interface PlatformConnection {
  platform: PlatformName;
  is_connected: boolean;
  connected_by: string | null;
  connected_at: string | null;
  meta: Record<string, unknown>;
}

export interface Approval {
  id: string;
  content_item_id: string;
  platform_post_id: string | null;
  decision: 'approved' | 'changes_requested';
  decided_by: string;
  decided_at: string;
  note: string | null;
}

export interface Comment {
  id: string;
  content_item_id: string;
  author_id: string;
  body: string;
  parent_comment_id: string | null;
  media_version_id: string | null;
  video_timestamp_seconds: number | null;
  created_at: string;
  updated_at: string;
}

export interface Mention {
  id: string;
  comment_id: string;
  mentioned_user_id: string;
  created_at: string;
}

export interface Schedule {
  id: string;
  platform_post_id: string;
  content_item_id: string;
  platform: PlatformName;
  scheduled_at: string;
  timezone: string;
  status: ScheduleStatus;
  created_by: string | null;
  created_at: string;
}

export interface PublishingJob {
  id: string;
  platform_post_id: string;
  schedule_id: string | null;
  attempt_number: number;
  status: JobStatus;
  trigger_source: JobTrigger;
  requested_by: string | null;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
  response_payload: Record<string, unknown> | null;
  created_at: string;
}

export interface ActivityLogEntry {
  id: string;
  content_item_id: string;
  actor_id: string | null;
  action: string;
  detail: Record<string, unknown>;
  created_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  content_item_id: string | null;
  platform_post_id: string | null;
  comment_id: string | null;
  actor_id: string | null;
  title: string;
  body: string | null;
  group_key: string | null;
  read_at: string | null;
  created_at: string;
}

export const PIPELINE_STAGES: ContentStage[] = ['idea', 'producing', 'approval', 'published'];

export const STAGE_LABELS: Record<ContentStage, string> = {
  idea: 'Ideas',
  producing: 'Producing',
  approval: 'Approval',
  published: 'Published'
};

export const PLATFORMS: PlatformName[] = ['instagram', 'tiktok', 'linkedin'];

export const PLATFORM_LABELS: Record<PlatformName, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn'
};
