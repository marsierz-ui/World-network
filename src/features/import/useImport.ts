import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { geocode } from '../../lib/geocode';
import type { ImportItem } from './parseCsv';
import type { Contact, ContactEvent, ContactSource, Tag } from '../../lib/database.types';

export interface ImportSummary {
  inserted: number;
  skipped: number;
  tags: number;
  placed: number;
  /** Contacts already present that gained a Google resource name this run. */
  linked: number;
}

function dedupeKey(name: string, email?: string | null) {
  return email ? `e:${email.toLowerCase()}` : `n:${name.toLowerCase()}`;
}

/**
 * Incoming contacts that were deliberately deleted here at some point.
 *
 * A sync would otherwise quietly resurrect them, so the caller has to get the
 * user's approval first. The check is the latest event per contact: a contact
 * deleted and later re-added has 'added' on top and is not flagged again.
 */
export async function findDeletedMatches(items: ImportItem[]): Promise<ImportItem[]> {
  const { data } = await supabase
    .from('contact_events')
    .select('full_name,primary_email,action,created_at')
    .order('created_at', { ascending: false });

  const latest = new Map<string, string>();
  for (const e of (data as Pick<ContactEvent, 'full_name' | 'primary_email' | 'action'>[] | null) ??
    []) {
    const key = dedupeKey(e.full_name, e.primary_email);
    if (!latest.has(key)) latest.set(key, e.action);
  }

  return items.filter(
    (i) => latest.get(dedupeKey(i.input.full_name, i.input.primary_email)) === 'removed',
  );
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

      const { data: existing } = await supabase
        .from('contacts')
        .select('id,full_name,primary_email,external_ids');
      // Keep the rows: a re-sync should still apply newly-added labels to
      // contacts we already have, not drop them along with the duplicate row.
      type ExistingRow = Pick<Contact, 'id' | 'full_name' | 'primary_email' | 'external_ids'>;
      const existingRows = new Map<string, ExistingRow>();
      for (const c of (existing as ExistingRow[] | null) ?? []) {
        existingRows.set(dedupeKey(c.full_name, c.primary_email), c);
      }
      const seen = new Set(existingRows.keys());

      // Dedupe, geocode, and keep labels aligned with the rows we will insert.
      const rows: Record<string, unknown>[] = [];
      const rowLabels: string[][] = [];
      // Labels destined for contacts that already exist, keyed by contact id.
      const existingLabels = new Map<string, string[]>();
      // Contacts imported before two-way sync existed carry no Google resource
      // name, so their edits can never reach Google. Adopt it on re-sync.
      const backfill: { id: string; external_ids: Record<string, unknown> }[] = [];
      let skipped = 0;
      let placed = 0;
      for (const { input, labels } of items) {
        const key = dedupeKey(input.full_name, input.primary_email);
        if (seen.has(key)) {
          skipped++;
          const row = existingRows.get(key);
          if (row && labels.length) {
            existingLabels.set(row.id, [...(existingLabels.get(row.id) ?? []), ...labels]);
          }
          const rn = input.external_ids?.google;
          if (row && rn && !row.external_ids?.google) {
            backfill.push({ id: row.id, external_ids: { ...row.external_ids, google: rn } });
          }
          continue;
        }
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
          details: input.details ?? {},
          external_ids: input.external_ids ?? {},
          source,
          current_lng: g?.lng ?? null,
          current_lat: g?.lat ?? null,
        });
        rowLabels.push(labels);
      }

      // Create/dedupe tags for all labels we are about to assign.
      const uniqueLabels = [...new Set([...rowLabels.flat(), ...[...existingLabels.values()].flat()])];
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

      for (const [contactId, labels] of existingLabels) {
        for (const label of new Set(labels)) {
          const tagId = tagMap.get(label.toLowerCase());
          if (tagId) contactTags.push({ contact_id: contactId, tag_id: tagId, user_id: userId });
        }
      }

      // Chunked rather than one-by-one: each row gets a different value, so
      // there is nothing to batch into a single statement.
      for (let i = 0; i < backfill.length; i += 25) {
        await Promise.all(
          backfill
            .slice(i, i + 25)
            .map((b) =>
              supabase.from('contacts').update({ external_ids: b.external_ids }).eq('id', b.id),
            ),
        );
      }

      for (let i = 0; i < contactTags.length; i += 1000) {
        // Upsert: a contact already carrying the tag must not fail the batch.
        const { error } = await supabase
          .from('contact_tags')
          .upsert(contactTags.slice(i, i + 1000), {
            onConflict: 'contact_id,tag_id',
            ignoreDuplicates: true,
          });
        if (error) throw error;
      }

      await supabase.from('import_jobs').insert({
        user_id: userId,
        source,
        status: 'done',
        summary: { inserted, skipped, tags: tagMap.size, placed, linked: backfill.length },
      });

      return { inserted, skipped, tags: uniqueLabels.length, placed, linked: backfill.length };
    },
    onSuccess: () =>
      qc.invalidateQueries({
        predicate: (q) =>
          ['contacts', 'tags', 'contact_tags', 'contact_events'].includes(q.queryKey[0] as string),
      }),
  });
}
