import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type { Tag } from '../../lib/database.types';

export function useTags() {
  return useQuery({
    queryKey: ['tags'],
    queryFn: async (): Promise<Tag[]> => {
      const { data, error } = await supabase.from('tags').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });
}

// contact_id -> tag_id[]
export function useContactTagMap() {
  return useQuery({
    queryKey: ['contact_tags'],
    queryFn: async (): Promise<Record<string, string[]>> => {
      const { data, error } = await supabase.from('contact_tags').select('contact_id,tag_id');
      if (error) throw error;
      const map: Record<string, string[]> = {};
      for (const row of data as { contact_id: string; tag_id: string }[]) {
        (map[row.contact_id] ??= []).push(row.tag_id);
      }
      return map;
    },
  });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (t: Pick<Tag, 'name' | 'kind' | 'color'>) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from('tags').insert({ ...t, user_id: u.user!.id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tags'] }),
  });
}

// Distinct hues for sublabels so they read apart on the map.
const SUBLABEL_COLORS = [
  '#f59e0b', '#22c55e', '#38bdf8', '#e879f9', '#fb7185',
  '#a3e635', '#facc15', '#2dd4bf', '#c084fc', '#fb923c',
];

/**
 * Group existing labels under a new parent label. The children keep all their
 * contact links, so nothing needs re-tagging; the parent is a view over them.
 * Each child gets a distinct colour unless it already had a custom one.
 */
export function useGroupTags() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      name,
      childIds,
      kind = 'label',
    }: {
      name: string;
      childIds: string[];
      kind?: Tag['kind'];
    }) => {
      const { data: u } = await supabase.auth.getUser();
      const { data: parent, error: pErr } = await supabase
        .from('tags')
        .insert({ user_id: u.user!.id, name, kind, color: '#6366f1' })
        .select('id')
        .single();
      if (pErr) throw pErr;

      for (const [i, id] of childIds.entries()) {
        const { error } = await supabase
          .from('tags')
          .update({ parent_id: parent.id, color: SUBLABEL_COLORS[i % SUBLABEL_COLORS.length] })
          .eq('id', id);
        if (error) throw error;
      }
      return parent.id as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tags'] }),
  });
}

export function useUpdateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Pick<Tag, 'name' | 'color' | 'parent_id'>> }) => {
      const { error } = await supabase.from('tags').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tags'] }),
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tags').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () =>
      qc.invalidateQueries({
        predicate: (q) => ['tags', 'contact_tags'].includes(q.queryKey[0] as string),
      }),
  });
}

export function useSetContactTags() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ contactId, tagIds }: { contactId: string; tagIds: string[] }) => {
      const { data: u } = await supabase.auth.getUser();
      await supabase.from('contact_tags').delete().eq('contact_id', contactId);
      if (tagIds.length) {
        const rows = tagIds.map((tag_id) => ({
          contact_id: contactId,
          tag_id,
          user_id: u.user!.id,
        }));
        const { error } = await supabase.from('contact_tags').insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contact_tags'] }),
  });
}
