import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { SectionTitle } from '@/components/SectionTitle';
import { MonthGrid } from '@/components/MonthGrid';
import { LoadingState, ErrorState, EmptyState } from '@/components/AsyncState';
import { theme } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useWorkspace } from '@/lib/workspace';
import { useAsync } from '@/lib/useAsync';
import { listEvents, createEvent, deleteEvent } from '@/lib/repositories/events';
import { memberLabel } from '@/lib/ownerLabel';
import { formatTime, localDateKey } from '@/lib/format';
import { syncEventReminders } from '@/lib/notifications';
import type { EventRow } from '@/types/db';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

function dateHeader(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
}

const MONTH_LABEL_FMT = new Intl.DateTimeFormat([], { month: 'long', year: 'numeric' });

export default function CalendarScreen() {
  const { session } = useAuth();
  const { workspaceId, me, partner } = useWorkspace();
  const { data: events, loading, error, refresh } = useAsync(
    () => (workspaceId ? listEvents(workspaceId) : Promise.resolve([])),
    [workspaceId]
  );

  const [view, setView] = useState<'agenda' | 'month'>('agenda');
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedDay, setSelectedDay] = useState(localDateKey());

  const [title, setTitle] = useState('');
  const [date, setDate] = useState(localDateKey());
  const [time, setTime] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (events) syncEventReminders(events).catch(() => {});
  }, [events]);

  const upcoming = useMemo(() => {
    if (!events) return [];
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return events.filter(e => new Date(e.end_at ?? e.start_at).getTime() >= startOfToday.getTime());
  }, [events]);

  const agendaGroups = useMemo(() => {
    const map = new Map<string, EventRow[]>();
    for (const event of upcoming) {
      const key = localDateKey(new Date(event.start_at));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(event);
    }
    return Array.from(map.entries());
  }, [upcoming]);

  const datesWithEvents = useMemo(() => new Set((events ?? []).map(e => localDateKey(new Date(e.start_at)))), [events]);

  const selectedDayEvents = useMemo(
    () => (events ?? []).filter(e => localDateKey(new Date(e.start_at)) === selectedDay),
    [events, selectedDay]
  );

  const changeMonth = (delta: number) => {
    setMonthCursor(prev => {
      const next = new Date(prev.year, prev.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  const create = async () => {
    setFormError('');
    if (!title.trim() || !workspaceId || !session) return;
    if (!DATE_RE.test(date)) {
      setFormError('Use YYYY-MM-DD for the date, e.g. 2026-08-25.');
      return;
    }
    if (!allDay && !TIME_RE.test(time)) {
      setFormError('Use 24-hour HH:MM for the time, e.g. 14:30 — or turn on All day.');
      return;
    }
    const startAt = new Date(`${date}T${allDay ? '00:00' : time}:00`);
    if (Number.isNaN(startAt.getTime())) {
      setFormError("That date doesn't look right.");
      return;
    }
    setCreating(true);
    try {
      await createEvent({
        workspace_id: workspaceId,
        title: title.trim(),
        description: description.trim() || null,
        start_at: startAt.toISOString(),
        all_day: allDay,
        created_by: session.user.id
      });
      setTitle('');
      setTime('');
      setDescription('');
      setAllDay(false);
      setDate(localDateKey());
      refresh();
    } finally {
      setCreating(false);
    }
  };

  const confirmDelete = (event: EventRow) => {
    Alert.alert('Delete event?', `Remove "${event.title}" from the calendar? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteEvent(event.id);
          refresh();
        }
      }
    ]);
  };

  const eventCard = (event: EventRow) => (
    <Card key={event.id}>
      <View style={styles.eventRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eventTitle}>{event.title}</Text>
          <Text style={styles.meta}>
            {event.all_day ? 'All day' : formatTime(event.start_at)} · {memberLabel(event.created_by, me, partner)}
          </Text>
          {event.description ? <Text style={styles.description}>{event.description}</Text> : null}
        </View>
        <Pressable hitSlop={10} onPress={() => confirmDelete(event)}>
          <Text style={styles.delete}>Delete</Text>
        </Pressable>
      </View>
    </Card>
  );

  return (
    <Screen>
      <SectionTitle title="Calendar" subtitle="Shared events for both of you." />

      <View style={styles.viewToggle}>
        <Pressable style={[styles.toggleButton, view === 'agenda' && styles.toggleButtonActive]} onPress={() => setView('agenda')}>
          <Text style={[styles.toggleText, view === 'agenda' && styles.toggleTextActive]}>Agenda</Text>
        </Pressable>
        <Pressable style={[styles.toggleButton, view === 'month' && styles.toggleButtonActive]} onPress={() => setView('month')}>
          <Text style={[styles.toggleText, view === 'month' && styles.toggleTextActive]}>Month</Text>
        </Pressable>
      </View>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : view === 'agenda' ? (
        agendaGroups.length === 0 ? (
          <EmptyState label="Nothing coming up. Add an event below." />
        ) : (
          agendaGroups.map(([day, dayEvents]) => (
            <View key={day} style={{ gap: 8 }}>
              <Text style={styles.dayHeader}>{dateHeader(day)}</Text>
              {dayEvents.map(eventCard)}
            </View>
          ))
        )
      ) : (
        <>
          <Card>
            <View style={styles.monthNav}>
              <Pressable hitSlop={10} onPress={() => changeMonth(-1)}>
                <Text style={styles.monthNavArrow}>‹</Text>
              </Pressable>
              <Text style={styles.monthLabel}>{MONTH_LABEL_FMT.format(new Date(monthCursor.year, monthCursor.month, 1))}</Text>
              <Pressable hitSlop={10} onPress={() => changeMonth(1)}>
                <Text style={styles.monthNavArrow}>›</Text>
              </Pressable>
            </View>
            <MonthGrid
              year={monthCursor.year}
              month={monthCursor.month}
              selectedDay={selectedDay}
              datesWithEvents={datesWithEvents}
              onSelectDay={setSelectedDay}
            />
            <Pressable onPress={() => setSelectedDay(localDateKey())}>
              <Text style={styles.today}>Today</Text>
            </Pressable>
          </Card>

          <Text style={styles.dayHeader}>{dateHeader(selectedDay)}</Text>
          {selectedDayEvents.length === 0 ? (
            <EmptyState label="Nothing on this day." />
          ) : (
            selectedDayEvents.map(eventCard)
          )}
        </>
      )}

      <Card>
        <Text style={styles.label}>New event</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Event title"
          placeholderTextColor={theme.colors.muted}
          style={styles.input}
        />
        <View style={styles.row}>
          <TextInput
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={theme.colors.muted}
            style={[styles.input, { flex: 1, marginTop: 0 }]}
          />
          {!allDay ? (
            <TextInput
              value={time}
              onChangeText={setTime}
              placeholder="HH:MM"
              placeholderTextColor={theme.colors.muted}
              style={[styles.input, { flex: 1, marginTop: 0 }]}
            />
          ) : null}
        </View>
        <View style={styles.allDayRow}>
          <Text style={styles.fieldLabel}>All day</Text>
          <Switch value={allDay} onValueChange={setAllDay} />
        </View>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Notes (optional)"
          placeholderTextColor={theme.colors.muted}
          multiline
          style={[styles.input, { minHeight: 60 }]}
        />
        {formError ? <Text style={styles.error}>{formError}</Text> : null}
        <Pressable style={styles.primary} onPress={create} disabled={creating || !title.trim()}>
          <Text style={styles.primaryText}>{creating ? 'Adding…' : '+ Add event'}</Text>
        </Pressable>
        <Text style={styles.reminderNote}>You'll get a reminder on this phone — 30 minutes before a timed event, or 9am for an all-day one.</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  viewToggle: { flexDirection: 'row', gap: 8 },
  toggleButton: { flex: 1, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, paddingVertical: 10, alignItems: 'center' },
  toggleButtonActive: { backgroundColor: theme.colors.navy, borderColor: theme.colors.navy },
  toggleText: { color: theme.colors.text, fontWeight: '600' },
  toggleTextActive: { color: '#fff' },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthNavArrow: { color: theme.colors.navy, fontSize: 24, fontWeight: '700', paddingHorizontal: 12 },
  monthLabel: { color: theme.colors.text, fontSize: 16, fontWeight: '600' },
  today: { color: theme.colors.navy, fontWeight: '600', textAlign: 'center', marginTop: 12 },
  dayHeader: { color: theme.colors.gold, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginTop: 6 },
  eventRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  eventTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '600' },
  meta: { color: theme.colors.muted, fontSize: 13, marginTop: 4 },
  description: { color: theme.colors.text, marginTop: 8, lineHeight: 20 },
  delete: { color: theme.colors.danger, fontSize: 12, fontWeight: '600' },
  label: { color: theme.colors.text, fontSize: 16, fontWeight: '600' },
  fieldLabel: { color: theme.colors.text, fontSize: 14, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 10, marginTop: 12 },
  allDayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  input: {
    marginTop: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    color: theme.colors.text,
    backgroundColor: theme.colors.background
  },
  error: { color: theme.colors.danger, marginTop: 12 },
  primary: { backgroundColor: theme.colors.navy, padding: 14, borderRadius: theme.radius.md, alignItems: 'center', marginTop: 14 },
  primaryText: { color: '#fff', fontWeight: '600' },
  reminderNote: { color: theme.colors.muted, fontSize: 12, marginTop: 12, lineHeight: 17 }
});
