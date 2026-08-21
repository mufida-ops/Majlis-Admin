import * as Notifications from 'expo-notifications';
import type { EventRow } from '@/types/db';

// Local, on-device reminders (not server push) — each phone independently
// keeps its own scheduled notifications in sync with whatever events it
// last saw, so both members get reminded regardless of who created an
// event, with no push-token/server infrastructure needed.

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false
  })
});

const REMINDER_MINUTES_BEFORE = 30;
const ALL_DAY_REMINDER_HOUR = 9;

export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

function reminderDateFor(event: EventRow): Date {
  const start = new Date(event.start_at);
  if (event.all_day) {
    const day = new Date(start);
    day.setHours(ALL_DAY_REMINDER_HOUR, 0, 0, 0);
    return day;
  }
  return new Date(start.getTime() - REMINDER_MINUTES_BEFORE * 60000);
}

// Cancels every reminder this device previously scheduled and re-schedules
// fresh from the given event list. Simpler and safer than trying to diff
// against what's already scheduled — an edited event's old reminder can't
// go stale this way, and the event count here is small enough that a full
// reschedule on every Calendar screen load is cheap.
export async function syncEventReminders(events: EventRow[]): Promise<void> {
  const granted = await ensureNotificationPermission();
  if (!granted) return;

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const ours = scheduled.filter(n => n.content.data?.kind === 'event-reminder');
  await Promise.all(ours.map(n => Notifications.cancelScheduledNotificationAsync(n.identifier)));

  const now = Date.now();
  for (const event of events) {
    const reminderAt = reminderDateFor(event);
    if (reminderAt.getTime() <= now) continue;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: event.all_day ? `Today: ${event.title}` : event.title,
        body: event.all_day
          ? 'All day'
          : `Starts at ${new Date(event.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        data: { kind: 'event-reminder', eventId: event.id }
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminderAt }
    });
  }
}
