import type { ContactInput } from '../contacts/useContacts';
import { findCountry } from '../../lib/countries';

interface GooglePerson {
  names?: { displayName?: string }[];
  emailAddresses?: { value?: string }[];
  phoneNumbers?: { value?: string }[];
  biographies?: { value?: string }[];
  addresses?: { city?: string; country?: string; countryCode?: string }[];
  organizations?: { name?: string; title?: string }[];
  memberships?: { contactGroupMembership?: { contactGroupResourceName?: string } }[];
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

const FIELDS =
  'names,emailAddresses,phoneNumbers,biographies,addresses,organizations,memberships';

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
    url.searchParams.set('personFields', FIELDS);
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
      const addr = p.addresses?.[0];
      const org = p.organizations?.[0];
      const country = addr?.countryCode || findCountry(addr?.country)?.code || null;
      const custom: Record<string, unknown> = {};
      if (org?.name) custom.company = org.name;
      if (org?.title) custom.position = org.title;

      const labels = (p.memberships ?? [])
        .map((m) => m.contactGroupMembership?.contactGroupResourceName)
        .map((rn) => (rn ? labelNames.get(rn) : undefined))
        .filter((n): n is string => !!n);

      out.push({
        input: {
          full_name: name,
          primary_email: p.emailAddresses?.[0]?.value ?? null,
          phone: p.phoneNumbers?.[0]?.value ?? null,
          notes: p.biographies?.[0]?.value ?? null,
          current_city: addr?.city ?? null,
          current_country: country,
          origin_country: null,
          category: 'other',
          custom,
          source: 'google',
        },
        labels,
      });
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return out;
}
