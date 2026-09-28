// Dedupe/import for one user, ported from src/features/import/useImport.ts's
// findDeletedMatches and useBulkImport. The client versions rely on RLS
// (every query is implicitly `where user_id = auth.uid()`); this runs under
// the service role, which bypasses RLS, so every query here filters by
// `userId` explicitly - that substitution is the only real difference from
// the client logic.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { geocodeMinimal } from './geo.ts';
import type { PulledContact } from './pull.ts';

function dedupeKey(name: string, email?: string | null) {
  return email ? `e:${email.toLowerCase()}` : `n:${name.toLowerCase()}`;
}

/**
 * Contacts deliberately deleted here at some point. Imported unattended, a
 * background sync has no one to ask before resurrecting one, so these are
 * dropped rather than re-added - matching the client's `skipDeleted: true`
 * background path, never its interactive "confirm re-import" prompt.
 */
export async function findDeletedContactKeys(
  admin: SupabaseClient,
  userId: string,
): Promise<Set<string>> {
  const { data } = await admin
    .from('contact_events')
    .select('full_name,primary_email,action,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  const latest = new Map<string, string>();
  for (const e of (data as { full_name: string; primary_email: string | null; action: string }[] | null) ?? []) {
    const key = dedupeKey(e.full_name, e.primary_email);
    if (!latest.has(key)) latest.set(key, e.action);
  }
  const removed = new Set<string>();
  for (const [key, action] of latest) if (action === 'removed') removed.add(key);
  return removed;
}

async function ensureTags(admin: SupabaseClient, userId: string, labelNames: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const { data: existing } = await admin.from('tags').select('id,name').eq('user_id', userId);
  for (const t of (existing as { id: string; name: string }[] | null) ?? []) {
    map.set(t.name.toLowerCase(), t.id);
  }
  const missing = labelNames.filter((n) => !map.has(n.toLowerCase()));
  if (missing.length) {
    const rows = missing.map((name) => ({ user_id: userId, name, kind: 'label' as const }));
    const { data: created, error } = await admin.from('tags').insert(rows).select('id,name');
    if (error) throw error;
    for (const t of (created as { id: string; name: string }[] | null) ?? []) {
      map.set(t.name.toLowerCase(), t.id);
    }
  }
  return map;
}

export interface ImportSummary {
  inserted: number;
  skipped: number;
  linked: number;
}

/**
 * Insert contacts new to this user, link labels to tags, and backfill the
 * Google resource name onto rows that already exist but predate two-way sync
 * (a contact CSV-imported before this, say). Existing rows are otherwise left
 * untouched - the People API is the source of truth for what a sync overwrites,
 * and a contact this app never linked to Google should not start being pushed
 * to it.
 */
export async function importForUser(
  admin: SupabaseClient,
  userId: string,
  items: PulledContact[],
): Promise<ImportSummary> {
  const { data: existing } = await admin
    .from('contacts')
    .select('id,full_name,primary_email,external_ids')
    .eq('user_id', userId);
  type ExistingRow = { id: string; full_name: string; primary_email: string | null; external_ids: Record<string, unknown> };
  const existingRows = new Map<string, ExistingRow>();
  for (const c of (existing as ExistingRow[] | null) ?? []) {
    existingRows.set(dedupeKey(c.full_name, c.primary_email), c);
  }
  const seen = new Set(existingRows.keys());

  const rows: Record<string, unknown>[] = [];
  const rowLabels: string[][] = [];
  const existingLabels = new Map<string, string[]>();
  const backfill: { id: string; external_ids: Record<string, unknown> }[] = [];
  let skipped = 0;

  for (const item of items) {
    const key = dedupeKey(item.full_name, item.primary_email);
    if (seen.has(key)) {
      skipped++;
      const row = existingRows.get(key);
      if (row && item.labels.length) {
        existingLabels.set(row.id, [...(existingLabels.get(row.id) ?? []), ...item.labels]);
      }
      if (row && item.google_resource_name && !row.external_ids?.google) {
        backfill.push({ id: row.id, external_ids: { ...row.external_ids, google: item.google_resource_name } });
      }
      continue;
    }
    seen.add(key);
    const g = geocodeMinimal(item.current_city, item.current_country);
    rows.push({
      user_id: userId,
      full_name: item.full_name,
      primary_email: item.primary_email,
      phone: item.phone,
      notes: item.notes,
      origin_country: null,
      current_city: item.current_city,
      current_country: item.current_country,
      category: 'other',
      custom: {},
      details: item.details ?? {},
      external_ids: item.google_resource_name ? { google: item.google_resource_name } : {},
      source: 'google',
      current_lng: g?.lng ?? null,
      current_lat: g?.lat ?? null,
    });
    rowLabels.push(item.labels);
  }

  const uniqueLabels = [...new Set([...rowLabels.flat(), ...[...existingLabels.values()].flat()])];
  const tagMap = uniqueLabels.length ? await ensureTags(admin, userId, uniqueLabels) : new Map<string, string>();

  const contactTags: { contact_id: string; tag_id: string; user_id: string }[] = [];
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { data: ins, error } = await admin.from('contacts').insert(chunk).select('id');
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

  for (let i = 0; i < backfill.length; i += 25) {
    await Promise.all(
      backfill.slice(i, i + 25).map((b) => admin.from('contacts').update({ external_ids: b.external_ids }).eq('id', b.id)),
    );
  }

  for (let i = 0; i < contactTags.length; i += 1000) {
    const { error } = await admin
      .from('contact_tags')
      .upsert(contactTags.slice(i, i + 1000), { onConflict: 'contact_id,tag_id', ignoreDuplicates: true });
    if (error) throw error;
  }

  await admin.from('import_jobs').insert({
    user_id: userId,
    source: 'google',
    status: 'done',
    summary: { inserted, skipped, tags: tagMap.size, linked: backfill.length },
  });

  return { inserted, skipped, linked: backfill.length };
}
