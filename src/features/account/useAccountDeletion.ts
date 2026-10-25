import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/authContext';

export interface PendingDeletion {
  requested_at: string;
  purge_after: string;
}

// The user's own account_deletions row, if they asked for deletion. Readable by
// the client (select-own); only the delete-account function writes it. Not
// retried: if the table is missing the app should open, not hang on a spinner.
export function usePendingDeletion() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['account_deletion', userId],
    enabled: !!userId,
    staleTime: 60_000,
    retry: false,
    queryFn: async (): Promise<PendingDeletion | null> => {
      const { data, error } = await supabase
        .from('account_deletions')
        .select('requested_at,purge_after')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

async function call(action: 'request' | 'cancel') {
  const { data, error } = await supabase.functions.invoke<{ ok: boolean; reason?: string }>(
    'delete-account',
    { body: { action } },
  );
  if (data?.reason === 'admin_protected') {
    throw new Error('Admin accounts cannot be deleted from the app.');
  }
  if (error || !data?.ok) throw new Error('That did not go through. Try again in a moment.');
}

export function useRequestDeletion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => call('request'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['account_deletion'] }),
  });
}

export function useRestoreAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => call('cancel'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['account_deletion'] }),
  });
}
