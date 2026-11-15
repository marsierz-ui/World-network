import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { geocode, loadCityDataset } from '../../lib/geocode';
import type { ContactLink } from '../../lib/database.types';

export interface InvitePreview {
  display_name: string;
  home_city: string | null;
  home_country: string | null;
  is_self: boolean;
  linked: boolean;
}

// Which of the caller's contacts are other members, keyed by contact id.
export function useContactLinks() {
  return useQuery({
    queryKey: ['contact_links'],
    queryFn: async (): Promise<Map<string, ContactLink>> => {
      const { data, error } = await supabase.from('contact_links').select('contact_id,peer_id');
      if (error) throw error;
      return new Map((data as ContactLink[]).map((l) => [l.contact_id, l]));
    },
  });
}

// Deleting the row drops the other member's side too (a database trigger); both
// contacts stay, as ordinary contacts.
export function useUnlink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (contactId: string) => {
      const { error } = await supabase.from('contact_links').delete().eq('contact_id', contactId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contact_links'] }),
  });
}

// null when the token matches nobody: the link was replaced, or mistyped.
export function useInvitePreview(token: string | null) {
  return useQuery({
    queryKey: ['invite_preview', token],
    enabled: !!token,
    retry: false,
    queryFn: async (): Promise<InvitePreview | null> => {
      const { data, error } = await supabase.rpc('invite_preview', { token });
      if (error) throw error;
      return (data as InvitePreview[] | null)?.[0] ?? null;
    },
  });
}

export function useAcceptInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (token: string) => {
      const { data: contactId, error } = await supabase.rpc('accept_invite', { token });
      if (error) throw error;

      // The card carries the inviter's stored home coordinates. A profile saved
      // before those existed has none, so place the new contact here.
      const { data: c } = await supabase
        .from('contacts')
        .select('current_city,current_country,current_lng')
        .eq('id', contactId as string)
        .single();
      if (c && c.current_lng == null && (c.current_city || c.current_country)) {
        await loadCityDataset();
        const g = geocode(c.current_city, c.current_country);
        if (g) {
          await supabase
            .from('contacts')
            .update({ current_lng: g.lng, current_lat: g.lat })
            .eq('id', contactId as string);
        }
      }
    },
    onSuccess: () =>
      qc.invalidateQueries({
        predicate: (q) =>
          ['contacts', 'contact_links', 'contact_events'].includes(q.queryKey[0] as string),
      }),
  });
}
