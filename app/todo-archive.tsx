import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { LoadingState, ErrorState, EmptyState } from '@/components/AsyncState';
import { theme } from '@/constants/theme';
import { useWorkspace } from '@/lib/workspace';
import { useAsync } from '@/lib/useAsync';
import { listTodos, setTodoDone, deleteTodo } from '@/lib/repositories/todos';
import { formatShortDate, formatMonthYear } from '@/lib/format';

export default function TodoArchiveScreen() {
  const { me, workspaceId } = useWorkspace();
  const { data: todos, loading, error, refresh, setData } = useAsync(
    () => (workspaceId && me ? listTodos(workspaceId, me.user_id) : Promise.resolve([])),
    [workspaceId, me?.user_id]
  );

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const uncheck = async (id: string) => {
    setData(prev => (prev ?? []).filter(t => t.id !== id));
    try {
      await setTodoDone(id, false);
    } catch {
      refresh();
    }
  };

  const remove = async (id: string) => {
    setData(prev => (prev ?? []).filter(t => t.id !== id));
    try {
      await deleteTodo(id);
    } catch {
      refresh();
    }
  };

  const done = (todos ?? []).filter(t => t.done);
  const groups: { month: string; items: typeof done }[] = [];
  for (const item of [...done].sort(
    (a, b) => new Date(b.completed_at ?? b.created_at).getTime() - new Date(a.completed_at ?? a.created_at).getTime()
  )) {
    const month = formatMonthYear(item.completed_at ?? item.created_at);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.month === month) lastGroup.items.push(item);
    else groups.push({ month, items: [item] });
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'To-do archive',
          headerStyle: { backgroundColor: theme.colors.background },
          headerTintColor: theme.colors.navy
        }}
      />
      <Text style={styles.sub}>Everything you've checked off your to-do list, grouped by the month you finished it.</Text>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : groups.length === 0 ? (
        <EmptyState label="Nothing checked off yet." />
      ) : (
        groups.map(group => (
          <View key={group.month} style={styles.monthGroup}>
            <Text style={styles.monthLabel}>{group.month}</Text>
            <Card style={{ gap: 2 }}>
              {group.items.map((item, index) => (
                <View key={item.id} style={[styles.row, index > 0 && styles.rowDivider]}>
                  <Pressable onPress={() => uncheck(item.id)} hitSlop={10}>
                    <Ionicons name="checkmark-circle" size={22} color={theme.colors.gold} />
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemText}>{item.body}</Text>
                    <Text style={styles.meta}>Done {formatShortDate(item.completed_at ?? item.created_at)}</Text>
                  </View>
                  <Pressable onPress={() => remove(item.id)} hitSlop={10}>
                    <Ionicons name="trash-outline" size={18} color={theme.colors.muted} />
                  </Pressable>
                </View>
              ))}
            </Card>
          </View>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sub: { color: theme.colors.muted, fontSize: 14, lineHeight: 20 },
  monthGroup: { gap: 10 },
  monthLabel: { color: theme.colors.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  rowDivider: { borderTopWidth: 1, borderTopColor: theme.colors.border },
  itemText: { color: theme.colors.text, fontSize: 15, fontWeight: '600', textDecorationLine: 'line-through' },
  meta: { color: theme.colors.muted, fontSize: 12, marginTop: 2 }
});
