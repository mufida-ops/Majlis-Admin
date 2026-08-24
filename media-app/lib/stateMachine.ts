// The content pipeline state machine (see ARCHITECTURE.md "Content state
// machine"). Manual, user-driven forward/backward moves are checked here;
// the `published -> approval` backward move on a material post-approval
// change is automatic (database triggers), never a manual transition, so it
// deliberately has no entry in MANUAL_TRANSITIONS.
import type { ContentStage } from '@/types/db';

export const MANUAL_TRANSITIONS: Record<ContentStage, ContentStage[]> = {
  idea: ['producing'],
  producing: ['idea', 'approval'],
  approval: ['producing'], // forward move to 'published' only via an approvals insert, not a direct stage edit
  published: []
};

export function canMoveStage(from: ContentStage, to: ContentStage): boolean {
  return MANUAL_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface ReadinessCheck {
  ok: boolean;
  reasons: string[];
}

/** Producing -> Approval requires at least one final media version and at least one enabled, captioned platform. */
export function checkReadyForApproval(input: {
  hasFinalMedia: boolean;
  enabledPlatformsWithCaption: number;
}): ReadinessCheck {
  const reasons: string[] = [];
  if (!input.hasFinalMedia) reasons.push('Upload a final video or image first.');
  if (input.enabledPlatformsWithCaption === 0) reasons.push('Enable at least one platform and write its caption.');
  return { ok: reasons.length === 0, reasons };
}
