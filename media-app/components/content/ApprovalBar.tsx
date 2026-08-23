import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { showAlert } from '@/lib/alert';
import { colors, radii, spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { canApprove } from '@/lib/permissions';
import { decide } from '@/lib/repositories/approvals';
import type { ContentItem } from '@/types/db';

export function ApprovalBar({ item, canEdit, onChanged }: { item: ContentItem; canEdit: boolean; onChanged: () => void }) {
  const { session, roles } = useAuth();
  const [note, setNote] = useState('');
  const [showRequestChanges, setShowRequestChanges] = useState(false);
  const [busy, setBusy] = useState(false);

  const ctx = { userId: session?.user.id ?? null, roles };
  const eligible = item.stage === 'approval' && canApprove(ctx, item);
  if (!eligible || !session) return null;

  async function approve() {
    setBusy(true);
    try {
      await decide({ contentItemId: item.id, decidedBy: session!.user.id, decision: 'approved' });
      onChanged();
    } catch (err) {
      showAlert('Could not approve', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function requestChanges() {
    setBusy(true);
    try {
      await decide({ contentItemId: item.id, decidedBy: session!.user.id, decision: 'changes_requested', note });
      setShowRequestChanges(false);
      setNote('');
      onChanged();
    } catch (err) {
      showAlert('Could not submit', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.bar}>
      <Pressable style={[styles.button, styles.changesButton]} onPress={() => setShowRequestChanges(true)} disabled={busy}>
        <Text style={styles.changesText}>Request Changes</Text>
      </Pressable>
      <Pressable style={[styles.button, styles.approveButton]} onPress={approve} disabled={busy}>
        {busy ? <ActivityIndicator color="#FFF" /> : <Text style={styles.approveText}>Approve</Text>}
      </Pressable>

      <Modal visible={showRequestChanges} transparent animationType="fade" onRequestClose={() => setShowRequestChanges(false)}>
        <Pressable style={styles.backdrop} onPress={() => setShowRequestChanges(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>What needs to change?</Text>
            <TextInput
              style={styles.noteInput}
              value={note}
              onChangeText={setNote}
              placeholder="e.g. @Farah please shorten the opening."
              placeholderTextColor={colors.textSecondary}
              multiline
              autoFocus
            />
            <Pressable style={styles.submitButton} onPress={requestChanges} disabled={busy}>
              <Text style={styles.submitText}>Send back to Editing</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', gap: spacing.sm, padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  button: { flex: 1, paddingVertical: 14, borderRadius: radii.md, alignItems: 'center' },
  changesButton: { backgroundColor: colors.surfaceMuted },
  changesText: { color: colors.danger, fontWeight: '700', fontSize: 14 },
  approveButton: { backgroundColor: colors.success },
  approveText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  backdrop: { flex: 1, backgroundColor: '#00000055', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, padding: spacing.lg, gap: spacing.md },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  noteInput: { backgroundColor: colors.surfaceMuted, borderRadius: radii.md, padding: spacing.md, fontSize: 14, minHeight: 90, textAlignVertical: 'top' },
  submitButton: { backgroundColor: colors.danger, borderRadius: radii.md, paddingVertical: 14, alignItems: 'center' },
  submitText: { color: '#FFF', fontWeight: '700', fontSize: 15 }
});
