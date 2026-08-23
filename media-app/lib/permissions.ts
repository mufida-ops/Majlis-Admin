// Client-side permission checks for UI gating only. The real security
// boundary is Postgres Row Level Security (supabase/schema.sql) — these
// mirrors just keep the UI from offering actions that would fail server-side.
import type { AppRole, ContentItem } from '@/types/db';

export interface PermissionContext {
  userId: string | null;
  roles: AppRole[];
}

const isAdmin = (ctx: PermissionContext) => ctx.roles.includes('admin');

export function canCreateContent(ctx: PermissionContext): boolean {
  return isAdmin(ctx) || ctx.roles.includes('creator');
}

export function canEditContent(ctx: PermissionContext, item: Pick<ContentItem, 'owner_id' | 'approver_id' | 'publisher_id'>): boolean {
  if (isAdmin(ctx)) return true;
  if (!ctx.userId) return false;
  return item.owner_id === ctx.userId || item.approver_id === ctx.userId || item.publisher_id === ctx.userId;
}

export function canApprove(ctx: PermissionContext, item: Pick<ContentItem, 'approver_id'>): boolean {
  if (isAdmin(ctx)) return true;
  if (!ctx.userId) return false;
  return ctx.roles.includes('approver') && item.approver_id === ctx.userId;
}

export function canSchedulePublish(ctx: PermissionContext): boolean {
  return isAdmin(ctx) || ctx.roles.includes('publisher');
}

export function canManageCampaignsTags(ctx: PermissionContext): boolean {
  return isAdmin(ctx);
}

export function canManageUsers(ctx: PermissionContext): boolean {
  return isAdmin(ctx);
}

export function canDeleteContent(ctx: PermissionContext): boolean {
  return isAdmin(ctx);
}

export function roleLabel(role: AppRole): string {
  switch (role) {
    case 'admin': return 'Admin';
    case 'approver': return 'Approver';
    case 'creator': return 'Creator / Editor';
    case 'publisher': return 'Publisher';
  }
}
