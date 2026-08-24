import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radii } from '@/constants/theme';
import type { ApprovalState, ContentPriority, ContentStage, PublicationStatus } from '@/types/db';
import { STAGE_LABELS } from '@/types/db';

const STAGE_COLOR: Record<ContentStage, string> = {
  idea: colors.stageIdea,
  producing: colors.stageToFilm,
  approval: colors.stageApproval,
  published: colors.stagePublished
};

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: color + '1F', borderColor: color + '55' }]}>
      <Text style={[styles.label, { color }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export function StageBadge({ stage }: { stage: ContentStage }) {
  return <Pill label={STAGE_LABELS[stage]} color={STAGE_COLOR[stage]} />;
}

const PRIORITY_COLOR: Record<ContentPriority, string> = {
  low: colors.priorityLow, normal: colors.priorityNormal, high: colors.priorityHigh, urgent: colors.priorityUrgent
};

export function PriorityBadge({ priority }: { priority: ContentPriority }) {
  if (priority === 'normal') return null;
  return <Pill label={priority[0].toUpperCase() + priority.slice(1)} color={PRIORITY_COLOR[priority]} />;
}

const APPROVAL_LABEL: Record<ApprovalState, string> = {
  not_submitted: 'Not submitted', pending: 'Pending', changes_requested: 'Changes requested',
  approved: 'Approved', revoked: 'Approval required'
};
const APPROVAL_COLOR: Record<ApprovalState, string> = {
  not_submitted: colors.textSecondary, pending: colors.warning, changes_requested: colors.danger,
  approved: colors.success, revoked: colors.danger
};

export function ApprovalBadge({ state }: { state: ApprovalState }) {
  if (state === 'not_submitted') return null;
  return <Pill label={APPROVAL_LABEL[state]} color={APPROVAL_COLOR[state]} />;
}

const PUB_LABEL: Record<PublicationStatus, string> = {
  not_prepared: 'Not prepared', draft: 'Draft', awaiting_approval: 'Awaiting approval', approved: 'Approved',
  scheduled: 'Scheduled', uploading: 'Uploading', processing: 'Processing', published: 'Published',
  failed: 'Failed', ready_to_post_manually: 'Ready to post manually'
};
const PUB_COLOR: Record<PublicationStatus, string> = {
  not_prepared: colors.textSecondary, draft: colors.textSecondary, awaiting_approval: colors.warning,
  approved: colors.success, scheduled: colors.stageScheduled, uploading: colors.info, processing: colors.info,
  published: colors.success, failed: colors.danger, ready_to_post_manually: colors.gold
};

export function PublicationBadge({ status }: { status: PublicationStatus }) {
  return <Pill label={PUB_LABEL[status]} color={PUB_COLOR[status]} />;
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.pill, borderWidth: 1, alignSelf: 'flex-start'
  },
  label: { fontSize: 11, fontWeight: '700' }
});
