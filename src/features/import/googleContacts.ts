import type { ContactInput } from '../contacts/useContacts';
import { findCountry } from '../../lib/countries';

interface GooglePerson {
  names?: { displayName?: string }[];
  emailAddresses?: { value?: string }[];
  phoneNumbers?: { value?: string }[];
  biographies?: { value?: string }[];
  addresses?: { city?: string; country?: string; countryCode?: string }[];
  organizations?: { name?: string; title?: string }[];
}

interface ConnectionsResponse {
  connections?: GooglePerson[];
  nextPageToken?: string;
}

const FIELDS = 'names,emailAddresses,phoneNumbers,biographies,addresses,organizations';

// Fetch all connections using a Google OAuth access token (provider_token from the session).
export async function fetchGoogleContacts(accessToken: string): Promise<ContactInput[]> {
  const out: ContactInput[] = [];
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

      out.push({
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
      });
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return out;
}
