import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type { ContactEvent } from '../../lib/database.types';

export function useContactHistory() {
  return useQuery({
    queryKey: ['contact_events'],
    queryFn: async (): Promise<ContactEvent[]> => {
      const { data, error } = await supabase
        .from('contact_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(2000);
      if (error) throw error;
      return data as ContactEvent[];
    },
  });
}

export function useClearContactHistory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from('contact_events').delete().eq('user_id', u.user!.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contact_events'] }),
  });
}
