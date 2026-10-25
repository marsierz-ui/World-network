import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type { SharedLinkedIn } from '../../lib/database.types';

// Other users' opted-in LinkedIn histories, keyed by the caller's contact id.
export function useSharedLinkedIn() {
  return useQuery({
    queryKey: ['shared_linkedin'],
    queryFn: async (): Promise<Map<string, SharedLinkedIn>> => {
      const { data, error } = await supabase.rpc('shared_linkedin_for_my_contacts');
      if (error) throw error;
      return new Map(((data as SharedLinkedIn[] | null) ?? []).map((r) => [r.contact_id, r]));
    },
  });
}
