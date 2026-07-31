import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { geocode } from '../../lib/geocode';
import type { Contact, FieldDefinition } from '../../lib/database.types';

const CONTACT_COLUMNS =
  'id,user_id,full_name,primary_email,phone,notes,avatar_url,origin_country,current_city,current_country,category,source,external_ids,custom,socials,current_lng,current_lat,created_at,updated_at';

export type ContactInput = Pick<
  Contact,
  | 'full_name'
  | 'primary_email'
  | 'phone'
  | 'notes'
  | 'origin_country'
  | 'current_city'
  | 'current_country'
  | 'category'
  | 'custom'
> & {
  source?: Contact['source'];
  socials?: Record<string, string>;
  // explicit pin (manual location). When both set, overrides geocoding.
  current_lng?: number | null;
  current_lat?: number | null;
};

export function useContacts() {
  return useQuery({
    queryKey: ['contacts'],
    queryFn: async (): Promise<Contact[]> => {
      const { data, error } = await supabase
        .from('contacts')
        .select(CONTACT_COLUMNS)
        .order('full_name');
      if (error) throw error;
      return data as Contact[];
    },
  });
}

// Explicit pin wins; otherwise geocode from city/country.
function resolveGeo(input: Partial<ContactInput>) {
  if (input.current_lng != null && input.current_lat != null) {
    return { current_lng: input.current_lng, current_lat: input.current_lat };
  }
  const g = geocode(input.current_city, input.current_country);
  return { current_lng: g?.lng ?? null, current_lat: g?.lat ?? null };
}

export function useCreateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ContactInput) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from('contacts').insert({
        ...input,
        ...resolveGeo(input),
        user_id: u.user!.id,
        source: input.source ?? 'manual',
      });
      if (error) throw error;
    },
    onSuccess: () =>
      qc.invalidateQueries({
        predicate: (q) => ['contacts', 'contact_events'].includes(q.queryKey[0] as string),
      }),
  });
}

export function useUpdateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<ContactInput> }) => {
      const touchesLocation =
        input.current_city !== undefined ||
        input.current_country !== undefined ||
        input.current_lng != null;
      const row = touchesLocation ? { ...input, ...resolveGeo(input) } : input;
      const { error } = await supabase.from('contacts').update(row).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  });
}

export function useDeleteContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('contacts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () =>
      qc.invalidateQueries({
        predicate: (q) => ['contacts', 'contact_events'].includes(q.queryKey[0] as string),
      }),
  });
}

// Delete all of the current user's contacts (contact_tags + location_history cascade).
export function useDeleteAllContacts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from('contacts').delete().eq('user_id', u.user!.id);
      if (error) throw error;
    },
    onSuccess: () =>
      qc.invalidateQueries({
        predicate: (q) =>
          ['contacts', 'contact_tags', 'contact_events'].includes(q.queryKey[0] as string),
      }),
  });
}

// ---- custom field definitions ----
export function useFieldDefinitions() {
  return useQuery({
    queryKey: ['field_definitions'],
    queryFn: async (): Promise<FieldDefinition[]> => {
      const { data, error } = await supabase
        .from('field_definitions')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateFieldDefinition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (def: Pick<FieldDefinition, 'label' | 'type' | 'options'>) => {
      const { data: u } = await supabase.auth.getUser();
      const key = def.label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
      const { error } = await supabase
        .from('field_definitions')
        .insert({ ...def, key, user_id: u.user!.id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['field_definitions'] }),
  });
}

export function useDeleteFieldDefinition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('field_definitions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['field_definitions'] }),
  });
}
