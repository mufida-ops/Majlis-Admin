import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radii, spacing } from '@/constants/theme';
import { Avatar } from '@/components/Avatar';
import { useAsync } from '@/lib/useAsync';
import { listTeam, listRolesByUser } from '@/lib/repositories/team';
import { submitForApproval } from '@/lib/repositories/approvals';
import { showAlert } from '@/lib/alert';

export function SubmitForApprovalModal({
  visible, contentItemId, expectedVersion, onClose, onSubmitted
}: {
  visible: boolean;
  contentItemId: string;
  expectedVersion: number;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const { data: team } = useAsync(() => listTeam(), []);
  const { data: rolesByUser } = useAsync(() => listRolesByUser(), []);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  const admins = (team ?? []).filter((p) => rolesByUser?.get(p.id)?.includes('admin'));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function send() {
    if (selected.size === 0) {
      showAlert('Pick an approver', 'Select who should approve this — you, the other admin, or both.');
      return;
    }
    setSending(true);
    try {
      await submitForApproval(contentItemId, expectedVersion, Array.from(selected));
      setSelected(new Set());
      onClose();
      onSubmitted();
    } catch (err) {
      showAlert('Could not submit', err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Send for approval</Text>
          <Text style={styles.hint}>Pick who should approve this — either one is enough to move it forward.</Text>

          <ScrollView style={styles.list} contentContainerStyle={{ gap: 2 }}>
            {admins.length === 0 && <Text style={styles.hint}>No admins found.</Text>}
            {admins.map((p) => {
              const isSelected = selected.has(p.id);
              return (
                <Pressable key={p.id} style={styles.row} onPress={() => toggle(p.id)}>
                  <Avatar name={p.full_name} size={30} />
                  <Text style={styles.rowName} numberOfLines={1}>{p.full_name}</Text>
                  <View style={[styles.checkbox, isSelected && styles.checkboxOn]}>
                    {isSelected && <Feather name="check" size={13} color="#FFF" />}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable style={styles.cancel} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.send, sending && { opacity: 0.6 }]} onPress={send} disabled={sending}>
              <Text style={styles.sendText}>{sending ? 'Sending…' : 'Send for Approval'}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#00000055', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, padding: spacing.lg, gap: spacing.sm, maxHeight: '85%' },
  title: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  hint: { fontSize: 13, color: colors.textSecondary },
  list: { maxHeight: 260, marginTop: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border },
  rowName: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center'
  },
  checkboxOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  cancel: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: radii.md, backgroundColor: colors.surfaceMuted },
  cancelText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  send: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: radii.md, backgroundColor: colors.navy },
  sendText: { fontSize: 14, fontWeight: '700', color: '#FFF' }
});
