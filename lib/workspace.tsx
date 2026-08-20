import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { WorkspaceMember } from '@/types/db';

type WorkspaceContextValue = {
  loading: boolean;
  error: string | null;
  workspaceId: string | null;
  me: WorkspaceMember | null;
  partner: WorkspaceMember | null;
  refresh: () => Promise<void>;
  updateMyMembership: (patch: Partial<Pick<WorkspaceMember, 'display_name' | 'quiet_hours_start' | 'quiet_hours_end' | 'timezone' | 'last_seen_at'>>) => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);

  const userId = session?.user.id ?? null;

  const load = useCallback(async () => {
    if (!supabase || !userId) {
      setMembers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data: bootstrapped, error: bootstrapError } = await supabase.rpc('bootstrap_workspace', {
        p_display_name: (session?.user.email ?? '').split('@')[0]
      });
      if (bootstrapError) throw bootstrapError;

      const workspaceId = (bootstrapped as WorkspaceMember | null)?.workspace_id;
      if (!workspaceId) throw new Error('Could not join a workspace.');

      const { data: rows, error: membersError } = await supabase
        .from('workspace_members')
        .select('*')
        .eq('workspace_id', workspaceId);
      if (membersError) throw membersError;

      setMembers((rows ?? []) as WorkspaceMember[]);
    } catch (err) {
      // Supabase errors (PostgrestError, AuthError, FunctionsHttpError) are
      // plain objects with a `.message`, not `instanceof Error` — checking
      // that first silently swallowed the real reason and always showed the
      // generic fallback below.
      const message =
        err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string'
          ? (err as { message: string }).message
          : err instanceof Error
            ? err.message
            : 'Failed to load workspace.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [userId, session?.user.email]);

  useEffect(() => {
    load();
  }, [load]);

  const me = useMemo(() => members.find(m => m.user_id === userId) ?? null, [members, userId]);
  const partner = useMemo(() => members.find(m => m.user_id !== userId) ?? null, [members, userId]);

  const updateMyMembership: WorkspaceContextValue['updateMyMembership'] = useCallback(
    async patch => {
      if (!supabase || !me) return;
      const { error: updateError } = await supabase
        .from('workspace_members')
        .update(patch)
        .eq('workspace_id', me.workspace_id)
        .eq('user_id', me.user_id);
      if (updateError) {
        setError(updateError.message);
        return;
      }
      setMembers(prev => prev.map(m => (m.user_id === me.user_id ? { ...m, ...patch } : m)));
    },
    [me]
  );

  const value: WorkspaceContextValue = {
    loading,
    error,
    workspaceId: me?.workspace_id ?? null,
    me,
    partner,
    refresh: load,
    updateMyMembership
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within a WorkspaceProvider');
  return ctx;
}
