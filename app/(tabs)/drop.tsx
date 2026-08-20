import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { SectionTitle } from '@/components/SectionTitle';
import { Card } from '@/components/Card';
import { theme } from '@/constants/theme';

export default function DropScreen() {
  const [text, setText] = useState('');
  const [feedback, setFeedback] = useState('');

  const save = (urgent = false) => {
    if (!text.trim()) {
      setFeedback('Type or say something first.');
      return;
    }
    setFeedback(urgent ? 'Marked urgent — this would bypass quiet hours.' : 'Saved quietly for Victoria’s next catch-up.');
    setText('');
  };

  return (
    <Screen>
      <SectionTitle title="Drop" subtitle="Capture first. Organise later." />
      <Card>
        <Text style={styles.label}>What’s on your mind?</Text>
        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          placeholder="e.g. We should change Phase 2 so the cultural box comes before teacher CPD"
          placeholderTextColor={theme.colors.muted}
          style={styles.input}
        />
        <View style={styles.buttons}>
          <Pressable style={styles.primary} onPress={() => save(false)}>
            <Text style={styles.primaryText}>Save for catch-up</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={() => save(true)}>
            <Text style={styles.secondaryText}>Mark urgent</Text>
          </Pressable>
        </View>
        {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}
      </Card>
      <Text style={styles.note}>Quiet-hours behavior will be backed by user settings in Supabase. Normal drops wait for the recipient’s catch-up; urgent drops can bypass the boundary.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { color: theme.colors.text, fontSize: 16, fontWeight: '600' },
  input: { minHeight: 150, marginTop: 12, padding: 14, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, color: theme.colors.text, textAlignVertical: 'top', backgroundColor: theme.colors.background },
  buttons: { marginTop: 14, gap: 10 },
  primary: { backgroundColor: theme.colors.navy, padding: 14, borderRadius: theme.radius.md, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '600' },
  secondary: { borderWidth: 1, borderColor: theme.colors.border, padding: 14, borderRadius: theme.radius.md, alignItems: 'center' },
  secondaryText: { color: theme.colors.text, fontWeight: '600' },
  feedback: { color: theme.colors.success, marginTop: 14 },
  note: { color: theme.colors.muted, lineHeight: 21 }
});
