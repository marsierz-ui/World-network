import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { geocode } from '../../lib/geocode';
import { enqueueGoogleDelete, enqueueGoogleSync } from '../import/googleQueue';
import type { Contact, ContactDetails, FieldDefinition } from '../../lib/database.types';

const CONTACT_COLUMNS =
  'id,user_id,full_name,primary_email,phone,notes,avatar_url,origin_country,current_city,current_country,category,source,external_ids,custom,details,socials,current_lng,current_lat,created_at,updated_at';

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
  external_ids?: Record<string, unknown>;
  details?: ContactDetails;
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

// The list query is ordered by full_name; cache patches keep that order so a
// rename does not make the row jump on the next refetch instead of now.
function sortByName(list: Contact[]): Contact[] {
  return [...list].sort((a, b) => a.full_name.localeCompare(b.full_name));
}

// primary_email and phone are the app's denormalised view of the first list
// entry - dedupe, search, the contacts table and the map read the columns and
// never the lists, so they are rewritten whenever `details` is supplied.
function deriveScalars(input: Partial<ContactInput>): Partial<ContactInput> {
  if (!input.details) return {};
  return {
    primary_email: input.details.emails?.[0]?.value || null,
    phone: input.details.phones?.[0]?.value || null,
  };
}

export function useCreateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ContactInput): Promise<Contact> => {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('contacts')
        .insert({
          ...input,
          ...deriveScalars(input),
          ...resolveGeo(input),
          user_id: u.user!.id,
          source: input.source ?? 'manual',
        })
        .select(CONTACT_COLUMNS)
        .single();
      if (error) throw error;
      return data as Contact;
    },
    onSuccess: (created) => {
      // Splice the new row in rather than refetching every contact.
      qc.setQueryData<Contact[]>(['contacts'], (old) => sortByName([...(old ?? []), created]));
      qc.invalidateQueries({ queryKey: ['contact_events'] });
      enqueueGoogleSync(created, 'create', (resourceName) =>
        qc.setQueryData<Contact[]>(['contacts'], (old) =>
          old?.map((c) =>
            c.id === created.id
              ? { ...c, external_ids: { ...c.external_ids, google: resourceName } }
              : c,
          ),
        ),
      );
    },
  });
}

export function useUpdateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: Partial<ContactInput>;
    }): Promise<Contact> => {
      const touchesLocation =
        input.current_city !== undefined ||
        input.current_country !== undefined ||
        input.current_lng != null;
      const row = {
        ...input,
        ...deriveScalars(input),
        ...(touchesLocation ? resolveGeo(input) : {}),
      };
      const { data, error } = await supabase
        .from('contacts')
        .update(row)
        .eq('id', id)
        .select(CONTACT_COLUMNS)
        .single();
      if (error) throw error;
      return data as Contact;
    },
    // Repaint from the edit itself so the table and map react on the same frame
    // the user clicks. The authoritative row replaces it a round-trip later.
    onMutate: async ({ id, input }) => {
      await qc.cancelQueries({ queryKey: ['contacts'] });
      const prev = qc.getQueryData<Contact[]>(['contacts']);
      qc.setQueryData<Contact[]>(['contacts'], (old) =>
        old?.map((c) => (c.id === id ? ({ ...c, ...input } as Contact) : c)),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['contacts'], ctx.prev);
    },
    onSuccess: (updated) => {
      qc.setQueryData<Contact[]>(['contacts'], (old) =>
        sortByName((old ?? []).map((c) => (c.id === updated.id ? updated : c))),
      );
      enqueueGoogleSync(updated, 'update');
    },
  });
}

export function useDeleteContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Returning the deleted row is what makes the Google delete possible: the
      // resource name has to be read before the row disappears, and doing it in
      // the same statement means no extra round-trip and no race.
      const { data, error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', id)
        .select('id,full_name,external_ids')
        // maybeSingle, not single: deleting a row that is already gone (a
        // double-click, a stale list) is a no-op, not an error.
        .maybeSingle();
      if (error) throw error;
      return { id, deleted: data as Pick<Contact, 'full_name' | 'external_ids'> | null };
    },
    onSuccess: ({ id, deleted }) => {
      const resourceName = deleted?.external_ids?.google;
      if (typeof resourceName === 'string' && resourceName) {
        enqueueGoogleDelete(deleted!.full_name, resourceName);
      }
      qc.setQueryData<Contact[]>(['contacts'], (old) => old?.filter((c) => c.id !== id));
      qc.invalidateQueries({
        predicate: (q) => ['contact_tags', 'contact_events'].includes(q.queryKey[0] as string),
      });
    },
  });
}

// Delete all of the current user's contacts (contact_tags + location_history
// cascade). Deliberately local-only: a single click emptying an entire Google
// address book is a blast radius no undo covers, and the next sync pulls the
// contacts back rather than losing them.
export function useDeleteAllContacts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from('contacts').delete().eq('user_id', u.user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.setQueryData<Contact[]>(['contacts'], []);
      qc.invalidateQueries({
        predicate: (q) => ['contact_tags', 'contact_events'].includes(q.queryKey[0] as string),
      });
    },
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

/**
 * Apply the same patch to many contacts in one statement. Only the fields the
 * bulk editor actually filled are in `input`, so untouched columns keep their
 * per-contact values.
 */
export function useBulkUpdateContacts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      ids,
      input,
    }: {
      ids: string[];
      input: Partial<ContactInput>;
    }): Promise<Contact[]> => {
      const touchesLocation =
        input.current_city !== undefined || input.current_country !== undefined;
      const row = { ...input, ...(touchesLocation ? resolveGeo(input) : {}) };
      const { data, error } = await supabase
        .from('contacts')
        .update(row)
        .in('id', ids)
        .select(CONTACT_COLUMNS);
      if (error) throw error;
      return data as Contact[];
    },
    onSuccess: (updated) => {
      const byId = new Map(updated.map((c) => [c.id, c]));
      qc.setQueryData<Contact[]>(['contacts'], (old) =>
        sortByName((old ?? []).map((c) => byId.get(c.id) ?? c)),
      );
      for (const c of updated) enqueueGoogleSync(c, 'update');
    },
  });
}
