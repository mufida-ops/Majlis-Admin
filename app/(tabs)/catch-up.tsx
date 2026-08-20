import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { SectionTitle } from '@/components/SectionTitle';
import { LoadingState, ErrorState } from '@/components/AsyncState';
import { theme } from '@/constants/theme';
import { useWorkspace } from '@/lib/workspace';
import { listActivitySince } from '@/lib/repositories/activity';
import { listDecisions } from '@/lib/repositories/decisions';
import { listProjects } from '@/lib/repositories/projects';
import { listOrganisations } from '@/lib/repositories/organisations';
import { formatRelative } from '@/lib/format';
import type { ActivityEventRow } from '@/types/db';

type Href = string | null;

export default function CatchUpScreen() {
  const { me, workspaceId, updateMyMembership } = useWorkspace();
  const startedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsYou, setNeedsYou] = useState<ActivityEventRow[]>([]);
  const [fyi, setFyi] = useState<ActivityEventRow[]>([]);
  const [hrefs, setHrefs] = useState<Record<string, Href>>({});

  useEffect(() => {
    if (startedRef.current || !workspaceId || !me) return;
    startedRef.current = true;
    const since = me.last_seen_at;

    (async () => {
      try {
        const [activity, decisions, projects, organisations] = await Promise.all([
          listActivitySince(workspaceId, since),
          listDecisions(workspaceId),
          listProjects(workspaceId),
          listOrganisations(workspaceId)
        ]);

        const decisionById = new Map(decisions.map(d => [d.id, d]));
        const taskById = new Map(projects.flatMap(p => p.project_tasks.map(t => [t.id, t] as const)));
        const orgById = new Map(organisations.map(o => [o.id, o]));
        const projectById = new Map(projects.map(p => [p.id, p]));

        const mine: ActivityEventRow[] = [];
        const others: ActivityEventRow[] = [];
        const linkMap: Record<string, Href> = {};

        for (const event of activity) {
          if (event.actor_user_id === me.user_id) continue; // don't catch yourself up on your own changes

          let needsMe = false;
          if (event.entity_type === 'decision') {
            const d = decisionById.get(event.entity_id);
            needsMe = !!d && d.status === 'Waiting' && (d.owner === 'Both' || d.owner === me.display_name);
            linkMap[event.id] = '/(tabs)/decisions';
          } else if (event.entity_type === 'task') {
            const t = taskById.get(event.entity_id);
            needsMe = !!t && t.status !== 'Done' && t.owner_user_id === me.user_id;
            if (t) linkMap[event.id] = `/(tabs)/projects/${t.project_id}`;
          } else if (event.entity_type === 'project') {
            linkMap[event.id] = `/(tabs)/projects/${event.entity_id}`;
            const p = projectById.get(event.entity_id);
            needsMe = !!p && p.status === 'Blocked';
          } else if (event.entity_type === 'organisation') {
            const o = orgById.get(event.entity_id);
            needsMe = !!o && !!o.next_action_at && new Date(o.next_action_at).getTime() < Date.now() + 3 * 86400000;
            linkMap[event.id] = `/(tabs)/crm/${event.entity_id}`;
          } else if (event.entity_type === 'drop') {
            needsMe = event.action === 'urgent_drop';
          }

          (needsMe ? mine : others).push(event);
        }

        setNeedsYou(mine);
        setFyi(others);
        setHrefs(linkMap);
        setLoading(false);

        updateMyMembership({ last_seen_at: new Date().toISOString() }).catch(() => {});
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load your catch-up.');
        setLoading(false);
      }
    })();
  }, [workspaceId, me, updateMyMembership]);

  if (loading) return <LoadingState label="Catching you up…" />;
  if (error) return <ErrorState message={error} />;

  const total = needsYou.length + fyi.length;

  return (
    <Screen>
      <SectionTitle title="Catch-up" subtitle="What changed since you last checked — without reading a wall of chat." />
      <Card>
        <Text style={styles.lead}>Since you last checked</Text>
        <Text style={styles.body}>
          {total === 0
            ? "You're fully caught up. Nothing changed since your last visit."
            : `${total} update${total === 1 ? '' : 's'} while you were away.`}
        </Text>
      </Card>

      {needsYou.length > 0 ? (
        <Card>
          <Text style={styles.label}>Needs you</Text>
          {needsYou.map(event => (
            <ActivityRow key={event.id} event={event} href={hrefs[event.id]} />
          ))}
        </Card>
      ) : null}

      {fyi.length > 0 ? (
        <Card>
          <Text style={styles.label}>FYI</Text>
          {fyi.map(event => (
            <ActivityRow key={event.id} event={event} href={hrefs[event.id]} />
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

function ActivityRow({ event, href }: { event: ActivityEventRow; href?: Href }) {
  const content = (
    <View style={styles.itemRow}>
      <Text style={styles.item}>{event.summary}</Text>
      <Text style={styles.itemMeta}>{formatRelative(event.created_at)}</Text>
    </View>
  );
  if (!href) return content;
  return <Pressable onPress={() => router.push(href as never)}>{content}</Pressable>;
}

const styles = StyleSheet.create({
  lead: { color: theme.colors.navy, fontSize: 18, fontWeight: '600' },
  body: { color: theme.colors.text, marginTop: 10, lineHeight: 23, fontSize: 16 },
  label: { color: theme.colors.gold, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  itemRow: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.colors.border },
  item: { color: theme.colors.text, lineHeight: 21 },
  itemMeta: { color: theme.colors.muted, fontSize: 12, marginTop: 4 }
});
