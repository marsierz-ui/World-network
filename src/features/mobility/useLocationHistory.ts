import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { geocode } from '../../lib/geocode';
import type { LocationHistory, LocationType, ContactSource } from '../../lib/database.types';

const COLUMNS =
  'id,contact_id,user_id,city,country,lng,lat,date_from,date_to,type,source,note,created_at';

export interface LocationInput {
  city: string | null;
  country: string | null;
  date_from: string | null;
  date_to: string | null;
  type: LocationType;
  note?: string | null;
  source?: ContactSource;
}

// All location-history rows for the user (used by the mobility map/slider).
export function useAllLocationHistory() {
  return useQuery({
    queryKey: ['location_history'],
    queryFn: async (): Promise<LocationHistory[]> => {
      const { data, error } = await supabase
        .from('location_history')
        .select(COLUMNS)
        .order('date_from', { nullsFirst: false });
      if (error) throw error;
      return data as LocationHistory[];
    },
  });
}

export function useContactLocationHistory(contactId: string | undefined) {
  return useQuery({
    enabled: !!contactId,
    queryKey: ['location_history', contactId],
    queryFn: async (): Promise<LocationHistory[]> => {
      const { data, error } = await supabase
        .from('location_history')
        .select(COLUMNS)
        .eq('contact_id', contactId!)
        .order('date_from', { nullsFirst: false });
      if (error) throw error;
      return data as LocationHistory[];
    },
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['location_history'] });
}

export function useAddLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ contactId, input }: { contactId: string; input: LocationInput }) => {
      const { data: u } = await supabase.auth.getUser();
      const g = geocode(input.city, input.country);
      const { error } = await supabase.from('location_history').insert({
        contact_id: contactId,
        user_id: u.user!.id,
        city: input.city,
        country: input.country,
        lng: g?.lng ?? null,
        lat: g?.lat ?? null,
        date_from: input.date_from,
        date_to: input.date_to,
        type: input.type,
        source: input.source ?? 'manual',
        note: input.note ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidate(qc),
  });
}

export function useDeleteLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('location_history').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(qc),
  });
}
