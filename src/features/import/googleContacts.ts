import type { ContactInput } from '../contacts/useContacts';
import { findCountry } from '../../lib/countries';
import { PERSON_FIELDS, personToDetails, type GooglePerson } from './googlePerson';

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

/**
 * Google labels are "contact groups". A person only carries group resource
 * names, so the group list has to be fetched separately to resolve them.
 * System groups (myContacts, starred, ...) are skipped - they are not labels
 * the user created, and importing them would tag every single contact.
 */
async function fetchLabelNames(accessToken: string): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  let pageToken: string | undefined;

  do {
    const url = new URL('https://people.googleapis.com/v1/contactGroups');
    url.searchParams.set('pageSize', '1000');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new Error(`People API ${res.status}: ${await res.text()}`);
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

export interface GoogleContact {
  input: ContactInput;
  labels: string[];
}

// Fetch all connections using a Google OAuth access token (provider_token from the session).
export async function fetchGoogleContacts(accessToken: string): Promise<GoogleContact[]> {
  const labelNames = await fetchLabelNames(accessToken);
  const out: GoogleContact[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL('https://people.googleapis.com/v1/people/me/connections');
    url.searchParams.set('personFields', PERSON_FIELDS);
    url.searchParams.set('pageSize', '1000');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) {
      throw new Error(`People API ${res.status}: ${await res.text()}`);
    }
    const data: ConnectionsResponse = await res.json();

    for (const p of data.connections ?? []) {
      const name = p.names?.[0]?.displayName;
      if (!name) continue;

      const details = personToDetails(p);
      // The scalar columns are the app's own view of the first entry: the map,
      // search, dedupe and contacts table all read them, not the lists.
      const addr = details.addresses?.[0];
      const country =
        addr?.country || findCountry(p.addresses?.[0]?.country)?.code || null;

      const labels = (p.memberships ?? [])
        .map((m) => m.contactGroupMembership?.contactGroupResourceName)
        .map((rn) => (rn ? labelNames.get(rn) : undefined))
        .filter((n): n is string => !!n);

      out.push({
        input: {
          full_name: name,
          primary_email: details.emails?.[0]?.value ?? null,
          phone: details.phones?.[0]?.value ?? null,
          notes: p.biographies?.[0]?.value ?? null,
          current_city: addr?.city || null,
          current_country: country,
          origin_country: null,
          category: 'other',
          custom: {},
          details,
          source: 'google',
          // Keeps the link back to the Google contact so later edits can be
          // pushed to it.
          external_ids: p.resourceName ? { google: p.resourceName } : {},
        },
        labels,
      });
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return out;
}
