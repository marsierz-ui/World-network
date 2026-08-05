import { supabase } from '../../lib/supabase';
import { getGoogleToken } from './googleToken';
import {
  PERSON_FIELDS,
  detailsToPerson,
  personToDetails,
  type GooglePerson,
  type PersonPatch,
} from './googlePerson';
import type { Contact, ContactDetails } from '../../lib/database.types';

export type PushResult =
  | 'not-linked' // contact never came from Google, so there is nothing to update
  | 'disabled' // sync switch is off in settings
  | 'no-token' // Google not connected in this browser session
  | 'unchanged' // nothing we hold differs from Google's copy
  | 'updated'
  | 'created';

export function googleResourceName(contact: Contact): string | null {
  const rn = contact.external_ids?.google;
  return typeof rn === 'string' && rn ? rn : null;
}

// ---------------------------------------------------------------------------
// transport
// ---------------------------------------------------------------------------

async function call(token: string, url: URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    // A write with a contacts.readonly token lands here. Tokens granted before
    // two-way sync existed are read-only, so this is the common first failure.
    if (res.status === 403) {
      throw new Error(
        'Google refused the write. Click "Connect Google" to re-grant access with ' +
          `permission to edit contacts. (${text.slice(0, 200)})`,
      );
    }
    throw new Error(`People API ${res.status}: ${text}`);
  }
  return res;
}

type Gate = { token: string; blocked?: undefined } | { token?: undefined; blocked: PushResult };

async function openGate(): Promise<Gate> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('google_sync_enabled')
    .single();
  if (!profile?.google_sync_enabled) return { blocked: 'disabled' };

  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.provider_token ?? getGoogleToken();
  if (!token) return { blocked: 'no-token' };
  return { token };
}

// ---------------------------------------------------------------------------
// payload
// ---------------------------------------------------------------------------

function patchFor(contact: Contact): PersonPatch {
  const details: ContactDetails = { ...(contact.details ?? {}) };
  // current_city/current_country are the app's map location, not a postal
  // address. Send them as one only when the contact carries no address of its
  // own, so Google still learns where the person is without overwriting a real
  // street address.
  if (!details.addresses?.length && (contact.current_city || contact.current_country)) {
    details.addresses = [
      {
        label: '',
        street: '',
        city: contact.current_city ?? '',
        region: '',
        postal_code: '',
        country: contact.current_country ?? '',
      },
    ];
  }
  return detailsToPerson(details, { fullName: contact.full_name, notes: contact.notes });
}

async function getPerson(token: string, resourceName: string): Promise<GooglePerson> {
  const url = new URL(`https://people.googleapis.com/v1/${resourceName}`);
  url.searchParams.set('personFields', PERSON_FIELDS);
  return (await call(token, url)).json();
}

/**
 * Fields whose value actually differs from Google's copy.
 *
 * Google's person is normalised through our own model and re-serialised, so the
 * comparison is like-for-like and a save that changed nothing sends no request.
 */
function changedFields(ours: PersonPatch, person: GooglePerson): string[] {
  const theirs = detailsToPerson(personToDetails(person), {
    fullName: person.names?.[0]?.displayName ?? '',
    notes: person.biographies?.[0]?.value ?? null,
  });
  return ours.mask.filter((f) => JSON.stringify(ours.body[f]) !== JSON.stringify(theirs.body[f]));
}

// ---------------------------------------------------------------------------
// public API
// ---------------------------------------------------------------------------

/** Push a contact's edits to the Google contact it was imported from. */
export async function pushContactToGoogle(contact: Contact): Promise<PushResult> {
  const resourceName = googleResourceName(contact);
  if (!resourceName) return 'not-linked';

  const gate = await openGate();
  if (gate.blocked) return gate.blocked;

  const person = await getPerson(gate.token, resourceName);
  const ours = patchFor(contact);
  const mask = changedFields(ours, person);
  if (!mask.length) return 'unchanged';

  // The fetched person carries the etag and metadata updateContact requires;
  // our fields are layered on top. Fields absent from the mask are untouched,
  // which is what protects data Google holds and we do not model.
  const body = { ...person, ...ours.body };
  const url = new URL(`https://people.googleapis.com/v1/${resourceName}:updateContact`);
  url.searchParams.set('updatePersonFields', mask.join(','));
  await call(gate.token, url, { method: 'PATCH', body: JSON.stringify(body) });

  return 'updated';
}

/**
 * Create the contact in Google. Returns the new resourceName so the caller can
 * store the link, or null when nothing was created.
 */
export async function createContactInGoogle(
  contact: Contact,
): Promise<{ result: PushResult; resourceName: string | null }> {
  if (googleResourceName(contact)) return { result: 'unchanged', resourceName: null };

  const gate = await openGate();
  if (gate.blocked) return { result: gate.blocked, resourceName: null };

  const { body, mask } = patchFor(contact);
  if (!mask.length) return { result: 'unchanged', resourceName: null };

  const url = new URL('https://people.googleapis.com/v1/people:createContact');
  url.searchParams.set('personFields', 'names');
  const res = await call(gate.token, url, { method: 'POST', body: JSON.stringify(body) });
  const created: GooglePerson = await res.json();

  return { result: 'created', resourceName: created.resourceName ?? null };
}
