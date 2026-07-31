import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { geocode } from '../../lib/geocode';
import type { ImportItem } from './parseCsv';
import type { Contact, ContactSource, Tag } from '../../lib/database.types';

export interface ImportSummary {
  inserted: number;
  skipped: number;
  tags: number;
  placed: number;
}

function dedupeKey(name: string, email?: string | null) {
  return email ? `e:${email.toLowerCase()}` : `n:${name.toLowerCase()}`;
}

// Ensure a tag exists for every label name; returns lowercased-name -> tag id.
async function ensureTags(userId: string, labelNames: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const { data: existing } = await supabase.from('tags').select('id,name');
  for (const t of (existing as Pick<Tag, 'id' | 'name'>[] | null) ?? []) {
    map.set(t.name.toLowerCase(), t.id);
  }
  const missing = labelNames.filter((n) => !map.has(n.toLowerCase()));
  if (missing.length) {
    const rows = missing.map((name) => ({ user_id: userId, name, kind: 'label' as const }));
    const { data: created, error } = await supabase.from('tags').insert(rows).select('id,name');
    if (error) throw error;
    for (const t of (created as Pick<Tag, 'id' | 'name'>[] | null) ?? []) {
      map.set(t.name.toLowerCase(), t.id);
    }
  }
  return map;
}

export function useBulkImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      items,
      source,
    }: {
      items: ImportItem[];
      source: ContactSource;
    }): Promise<ImportSummary> => {
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user!.id;

      const { data: existing } = await supabase.from('contacts').select('full_name,primary_email');
      const seen = new Set(
        (existing as Pick<Contact, 'full_name' | 'primary_email'>[] | null)?.map((c) =>
          dedupeKey(c.full_name, c.primary_email),
        ) ?? [],
      );

      // Dedupe, geocode, and keep labels aligned with the rows we will insert.
      const rows: Record<string, unknown>[] = [];
      const rowLabels: string[][] = [];
      let skipped = 0;
      let placed = 0;
      for (const { input, labels } of items) {
        const key = dedupeKey(input.full_name, input.primary_email);
        if (seen.has(key)) { skipped++; continue; }
        seen.add(key);
        const g =
          input.current_lng != null && input.current_lat != null
            ? { lng: input.current_lng, lat: input.current_lat }
            : geocode(input.current_city, input.current_country);
        if (g) placed++;
        rows.push({
          user_id: userId,
          full_name: input.full_name,
          primary_email: input.primary_email,
          phone: input.phone,
          notes: input.notes,
          origin_country: input.origin_country,
          current_city: input.current_city,
          current_country: input.current_country,
          category: input.category,
          custom: input.custom,
          source,
          current_lng: g?.lng ?? null,
          current_lat: g?.lat ?? null,
        });
        rowLabels.push(labels);
      }

      // Create/dedupe tags for all labels we are about to assign.
      const uniqueLabels = [...new Set(rowLabels.flat())];
      const tagMap = uniqueLabels.length ? await ensureTags(userId, uniqueLabels) : new Map();

      // Insert contacts in chunks, capturing ids in order to assign tags.
      const contactTags: { contact_id: string; tag_id: string; user_id: string }[] = [];
      let inserted = 0;
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        const { data: ins, error } = await supabase.from('contacts').insert(chunk).select('id');
        if (error) throw error;
        const ids = (ins as { id: string }[]) ?? [];
        inserted += ids.length;
        ids.forEach((r, j) => {
          for (const label of rowLabels[i + j]) {
            const tagId = tagMap.get(label.toLowerCase());
            if (tagId) contactTags.push({ contact_id: r.id, tag_id: tagId, user_id: userId });
          }
        });
      }

      for (let i = 0; i < contactTags.length; i += 1000) {
        const { error } = await supabase.from('contact_tags').insert(contactTags.slice(i, i + 1000));
        if (error) throw error;
      }

      await supabase.from('import_jobs').insert({
        user_id: userId,
        source,
        status: 'done',
        summary: { inserted, skipped, tags: tagMap.size, placed },
      });

      return { inserted, skipped, tags: uniqueLabels.length, placed };
    },
    onSuccess: () =>
      qc.invalidateQueries({
        predicate: (q) =>
          ['contacts', 'tags', 'contact_tags', 'contact_events'].includes(q.queryKey[0] as string),
      }),
  });
}
