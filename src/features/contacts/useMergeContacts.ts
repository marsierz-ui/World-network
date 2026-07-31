import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type { Contact } from '../../lib/database.types';

// Merge `dup` into `survivor`: fill survivor's empty fields, move tags + location history,
// then delete the duplicate.
export function useMergeContacts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ survivor, dup }: { survivor: Contact; dup: Contact }) => {
      const patch: Record<string, unknown> = {};
      const fill = (k: keyof Contact) => {
        if ((survivor[k] === null || survivor[k] === undefined) && dup[k] != null) patch[k] = dup[k];
      };
      (['primary_email', 'phone', 'notes', 'origin_country', 'current_city', 'current_country', 'current_lng', 'current_lat', 'avatar_url'] as (keyof Contact)[]).forEach(fill);
      patch.socials = { ...dup.socials, ...survivor.socials };
      patch.custom = { ...dup.custom, ...survivor.custom };
      if (Object.keys(patch).length) {
        const { error } = await supabase.from('contacts').update(patch).eq('id', survivor.id);
        if (error) throw error;
      }

      // Move location history to the survivor.
      await supabase.from('location_history').update({ contact_id: survivor.id }).eq('contact_id', dup.id);

      // Copy the dup's tags onto the survivor (ignore ones it already has), then delete dup.
      const { data: u } = await supabase.auth.getUser();
      const { data: dupTags } = await supabase.from('contact_tags').select('tag_id').eq('contact_id', dup.id);
      const { data: survTags } = await supabase.from('contact_tags').select('tag_id').eq('contact_id', survivor.id);
      const have = new Set((survTags as { tag_id: string }[] | null)?.map((t) => t.tag_id) ?? []);
      const toAdd = ((dupTags as { tag_id: string }[] | null) ?? [])
        .filter((t) => !have.has(t.tag_id))
        .map((t) => ({ contact_id: survivor.id, tag_id: t.tag_id, user_id: u.user!.id }));
      if (toAdd.length) await supabase.from('contact_tags').insert(toAdd);

      const { error: delErr } = await supabase.from('contacts').delete().eq('id', dup.id);
      if (delErr) throw delErr;
    },
    onSuccess: () =>
      qc.invalidateQueries({
        predicate: (q) =>
          ['contacts', 'contact_tags', 'location_history', 'contact_events'].includes(
            q.queryKey[0] as string,
          ),
      }),
  });
}
