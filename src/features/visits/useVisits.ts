import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/authContext';
import type { LinkedLocation, VisitNotice } from '../../lib/database.types';

// The city each linked member currently shares, keyed by the caller's contact id.
export function useLinkedLocations() {
  return useQuery({
    queryKey: ['linked_locations'],
    queryFn: async (): Promise<Map<string, LinkedLocation>> => {
      const { data, error } = await supabase.rpc('linked_locations');
      if (error) throw error;
      return new Map(((data as LinkedLocation[] | null) ?? []).map((r) => [r.contact_id, r]));
    },
  });
}

// Notices sent to the caller, newest first.
export function useVisitNotices() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['visit_notices', userId],
    enabled: !!userId,
    refetchInterval: 5 * 60_000,
    queryFn: async (): Promise<VisitNotice[]> => {
      const { data, error } = await supabase
        .from('visit_notices')
        .select('*')
        .eq('to_user', userId!)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as VisitNotice[];
    },
  });
}

export interface VisitNoticeInput {
  contactIds: string[];
  city: string;
  country: string | null;
  from: string | null;
  to: string | null;
  message: string;
}

// Reaches only the contacts that are linked members; returns how many it did.
export function useSendVisitNotice() {
  return useMutation({
    mutationFn: async (v: VisitNoticeInput): Promise<number> => {
      const { data, error } = await supabase.rpc('send_visit_notice', {
        contact_ids: v.contactIds,
        p_city: v.city,
        p_country: v.country,
        p_from: v.from,
        p_to: v.to,
        p_message: v.message,
      });
      if (error) throw error;
      return data as number;
    },
  });
}

export function useMarkNoticesRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('visit_notices')
        .update({ read_at: new Date().toISOString() })
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['visit_notices'] }),
  });
}

export function useDeleteNotice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('visit_notices').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['visit_notices'] }),
  });
}
