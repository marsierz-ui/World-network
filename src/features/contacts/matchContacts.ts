import type { Contact } from '../../lib/database.types';

function normName(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// Group contacts that are very likely the same person: same email, or same normalized name.
// Conservative (exact-normalized) to avoid wrong merges - the user confirms each anyway.
export function findDuplicateGroups(contacts: Contact[]): Contact[][] {
  const byKey = new Map<string, Contact[]>();
  for (const c of contacts) {
    const key = c.primary_email
      ? `e:${c.primary_email.toLowerCase().trim()}`
      : `n:${normName(c.full_name)}`;
    const list = byKey.get(key) ?? [];
    list.push(c);
    byKey.set(key, list);
  }
  return [...byKey.values()].filter((g) => g.length > 1);
}

// More-complete record is the better merge survivor.
export function completeness(c: Contact): number {
  let n = 0;
  if (c.primary_email) n++;
  if (c.phone) n++;
  if (c.notes) n++;
  if (c.current_lng != null) n++;
  if (c.origin_country) n++;
  n += Object.keys(c.socials ?? {}).length;
  n += Object.keys(c.custom ?? {}).length;
  return n;
}
