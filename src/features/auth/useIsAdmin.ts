import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from './authContext';

// Admin rights live in public.admins (no client access) and are read through
// the is_admin() RPC, which answers for the signed-in user only. This only
// decides what the UI shows: every table is owner-scoped by RLS regardless.
export function useIsAdmin() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const { data, isLoading } = useQuery({
    queryKey: ['is_admin', userId],
    enabled: !!userId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('is_admin');
      if (error) throw error;
      return data === true;
    },
  });
  return { isAdmin: data === true, loading: !!userId && isLoading };
}
