// Pull side: fetch this user's Google contacts. Ported from
// src/features/import/googleContacts.ts + googleError.ts (see person.ts for
// why this is a copy, not an import), with one deliberate simplification: the
// interactive importer falls back to `findCountry(p.addresses[0].country)`
// (the free-text country name) when Google's `countryCode` is blank. Google
// populates countryCode for the very large majority of structured addresses,
// so that fallback is skipped here rather than dragging the ~150-line country
// name/alias table into a cron job for an edge case the user can fix by hand
// (the contact still imports - just possibly without current_country set).

import { PERSON_FIELDS, personToDetails, type ContactDetails, type GooglePerson } from './person.ts';

export interface GoogleErrorDetail {
  reason?: string;
  metadata?: { activationUrl?: string };
}

export class GoogleApiError extends Error {
  readonly status: number;
  readonly reason: string | null;

  constructor(status: number, reason: string | null, message: string) {
    super(`People API ${status}: ${message}`);
    this.name = 'GoogleApiError';
    this.status = status;
    this.reason = reason;
  }
}

export function googleApiError(status: number, body: string): GoogleApiError {
  let reason: string | null = null;
  let message = body.slice(0, 300);
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string; status?: string; details?: GoogleErrorDetail[] } };
    if (parsed.error) {
      message = parsed.error.message ?? message;
      for (const d of parsed.error.details ?? []) reason ??= d.reason ?? null;
      reason ??= parsed.error.status ?? null;
    }
  } catch {
    // Not JSON - keep the raw text.
  }
  return new GoogleApiError(status, reason, message);
}

interface ConnectionsResponse {
  connections?: GooglePerson[];
  nextPageToken?: string;
}

interface ContactGroup {
  resourceName?: string;
  name?: string;
  formattedName?: string;
  groupType?: string;
}

async function fetchLabelNames(accessToken: string): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  let pageToken: string | undefined;

  do {
    const url = new URL('https://people.googleapis.com/v1/contactGroups');
    url.searchParams.set('pageSize', '1000');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw googleApiError(res.status, await res.text());
    const data: { contactGroups?: ContactGroup[]; nextPageToken?: string } = await res.json();

    for (const g of data.contactGroups ?? []) {
      const label = g.formattedName || g.name;
      if (g.resourceName && label && g.groupType === 'USER_CONTACT_GROUP') {
        names.set(g.resourceName, label);
      }
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return names;
}

export interface PulledContact {
  full_name: string;
  primary_email: string | null;
  phone: string | null;
  notes: string | null;
  current_city: string | null;
  current_country: string | null;
  details: ContactDetails;
  google_resource_name: string | null;
  labels: string[];
}

/** Fetch every connection for the account behind `accessToken`. */
export async function fetchGoogleContacts(accessToken: string): Promise<PulledContact[]> {
  const labelNames = await fetchLabelNames(accessToken);
  const out: PulledContact[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL('https://people.googleapis.com/v1/people/me/connections');
    url.searchParams.set('personFields', PERSON_FIELDS);
    url.searchParams.set('pageSize', '1000');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw googleApiError(res.status, await res.text());
    const data: ConnectionsResponse = await res.json();

    for (const p of data.connections ?? []) {
      const name = p.names?.[0]?.displayName;
      if (!name) continue;

      const details = personToDetails(p);
      const addr = details.addresses?.[0];

      const labels = (p.memberships ?? [])
        .map((m) => m.contactGroupMembership?.contactGroupResourceName)
        .map((rn) => (rn ? labelNames.get(rn) : undefined))
        .filter((n): n is string => !!n);

      out.push({
        full_name: name,
        primary_email: details.emails?.[0]?.value ?? null,
        phone: details.phones?.[0]?.value ?? null,
        notes: p.biographies?.[0]?.value ?? null,
        current_city: addr?.city || null,
        current_country: addr?.country || null,
        details,
        google_resource_name: p.resourceName ?? null,
        labels,
      });
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return out;
}
