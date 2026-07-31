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
