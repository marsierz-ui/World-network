// The single place that knows how a Google People API Person maps onto our
// ContactDetails, in both directions. googleContacts.ts (pull) and
// googlePush.ts (push) both go through here so the two can never drift.

import type {
  ContactAddress,
  ContactDetails,
  ContactOrganization,
  LabeledValue,
} from '../../lib/database.types';

/**
 * Every field the sync touches. `memberships` is read for labels but never
 * written - labels are managed as tags, and writing them needs contact group
 * resource names. `metadata` carries the etag that updateContact demands.
 */
export const PERSON_FIELDS =
  'names,nicknames,fileAses,emailAddresses,phoneNumbers,addresses,biographies,' +
  'organizations,birthdays,urls,imClients,relations,events,userDefined,memberships,metadata';

interface GoogleDate {
  year?: number;
  month?: number;
  day?: number;
}

export interface GooglePerson {
  resourceName?: string;
  etag?: string;
  names?: {
    displayName?: string;
    givenName?: string;
    middleName?: string;
    familyName?: string;
    honorificPrefix?: string;
    honorificSuffix?: string;
    phoneticGivenName?: string;
    phoneticMiddleName?: string;
    phoneticFamilyName?: string;
  }[];
  nicknames?: { value?: string }[];
  fileAses?: { value?: string }[];
  emailAddresses?: { value?: string; type?: string }[];
  phoneNumbers?: { value?: string; type?: string }[];
  addresses?: {
    type?: string;
    streetAddress?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    country?: string;
    countryCode?: string;
  }[];
  biographies?: { value?: string }[];
  organizations?: { name?: string; title?: string; department?: string }[];
  birthdays?: { date?: GoogleDate; text?: string }[];
  urls?: { value?: string; type?: string }[];
  imClients?: { username?: string; protocol?: string; type?: string }[];
  relations?: { person?: string; type?: string }[];
  events?: { date?: GoogleDate; type?: string }[];
  userDefined?: { key?: string; value?: string }[];
  memberships?: { contactGroupMembership?: { contactGroupResourceName?: string } }[];
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// dates
// ---------------------------------------------------------------------------

/** Google omits the year for birthdays entered without one; '--mm-dd' keeps that. */
function dateToString(d?: GoogleDate): string {
  if (!d?.month || !d.day) return '';
  const mm = String(d.month).padStart(2, '0');
  const dd = String(d.day).padStart(2, '0');
  return d.year ? `${d.year}-${mm}-${dd}` : `--${mm}-${dd}`;
}

function stringToDate(v: string): GoogleDate | null {
  const m = /^(\d{4})?-(\d{2})-(\d{2})$/.exec(v.trim().replace(/^--/, '-'));
  if (!m) return null;
  const date: GoogleDate = { month: Number(m[2]), day: Number(m[3]) };
  if (m[1]) date.year = Number(m[1]);
  return date;
}

// ---------------------------------------------------------------------------
// Google -> ours
// ---------------------------------------------------------------------------

function labeled(
  list: { value?: string; type?: string }[] | undefined,
): LabeledValue[] | undefined {
  const out = (list ?? [])
    .filter((e) => e.value)
    .map((e) => ({ label: e.type ?? '', value: e.value! }));
  return out.length ? out : undefined;
}

// Drops keys whose value is empty so a contact with three fields does not carry
// twenty empty ones through every sync.
function compact(d: ContactDetails): ContactDetails {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(d)) {
    if (v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) continue;
    out[k] = v;
  }
  return out as ContactDetails;
}

export function personToDetails(p: GooglePerson): ContactDetails {
  const n = p.names?.[0];
  const orgs = (p.organizations ?? [])
    .filter((o) => o.name || o.title || o.department)
    .map((o) => ({ name: o.name ?? '', title: o.title ?? '', department: o.department ?? '' }));
  const addresses = (p.addresses ?? [])
    .filter((a) => a.streetAddress || a.city || a.region || a.postalCode || a.countryCode)
    .map((a) => ({
      label: a.type ?? '',
      street: a.streetAddress ?? '',
      city: a.city ?? '',
      region: a.region ?? '',
      postal_code: a.postalCode ?? '',
      country: a.countryCode ?? '',
    }));

  return compact({
    prefix: n?.honorificPrefix ?? '',
    first_name: n?.givenName ?? '',
    middle_name: n?.middleName ?? '',
    last_name: n?.familyName ?? '',
    suffix: n?.honorificSuffix ?? '',
    phonetic_first: n?.phoneticGivenName ?? '',
    phonetic_middle: n?.phoneticMiddleName ?? '',
    phonetic_last: n?.phoneticFamilyName ?? '',
    file_as: p.fileAses?.[0]?.value ?? '',
    nickname: p.nicknames?.[0]?.value ?? '',
    birthday: dateToString(p.birthdays?.[0]?.date) || (p.birthdays?.[0]?.text ?? ''),
    organizations: orgs.length ? orgs : undefined,
    emails: labeled(p.emailAddresses),
    phones: labeled(p.phoneNumbers),
    addresses: addresses.length ? addresses : undefined,
    urls: labeled(p.urls),
    chats: (p.imClients ?? [])
      .filter((c) => c.username)
      .map((c) => ({ label: c.protocol ?? c.type ?? '', value: c.username! })),
    relations: (p.relations ?? [])
      .filter((r) => r.person)
      .map((r) => ({ label: r.type ?? '', value: r.person! })),
    events: (p.events ?? [])
      .filter((e) => e.date)
      .map((e) => ({ label: e.type ?? '', value: dateToString(e.date) })),
    user_defined: (p.userDefined ?? [])
      .filter((u) => u.key || u.value)
      .map((u) => ({ label: u.key ?? '', value: u.value ?? '' })),
  });
}

// ---------------------------------------------------------------------------
// ours -> Google
// ---------------------------------------------------------------------------

function nonEmpty<T>(list: T[] | undefined, keep: (e: T) => boolean): T[] {
  return (list ?? []).filter(keep);
}

export interface PersonPatch {
  body: Record<string, unknown>;
  /** Field names for updatePersonFields; only fields we actually have a value for. */
  mask: string[];
}

/**
 * Build the Person fields for a create or update.
 *
 * An empty list on our side means "nothing to say", not "delete it": a field we
 * hold nothing for is left out of the mask entirely, so Google's copy survives.
 * That is what makes this safe for contacts imported before `details` existed,
 * which have almost every key missing.
 */
export function detailsToPerson(
  details: ContactDetails,
  scalars: { fullName: string; notes: string | null },
): PersonPatch {
  const body: Record<string, unknown> = {};
  const mask: string[] = [];
  const add = (field: string, value: unknown) => {
    body[field] = value;
    mask.push(field);
  };

  const fullName = scalars.fullName.trim();
  // names[].displayName is output-only, so the structured parts carry the name.
  // Fall back to splitting the display name for contacts that have no parts.
  if (fullName || details.first_name || details.last_name) {
    const parts = fullName.split(/\s+/).filter(Boolean);
    add('names', [
      {
        givenName: details.first_name || parts[0] || '',
        middleName: details.middle_name || '',
        familyName: details.last_name || parts.slice(1).join(' '),
        honorificPrefix: details.prefix || '',
        honorificSuffix: details.suffix || '',
        phoneticGivenName: details.phonetic_first || '',
        phoneticMiddleName: details.phonetic_middle || '',
        phoneticFamilyName: details.phonetic_last || '',
        unstructuredName: fullName,
      },
    ]);
  }

  if (details.nickname) add('nicknames', [{ value: details.nickname }]);
  if (details.file_as) add('fileAses', [{ value: details.file_as }]);
  if (scalars.notes) add('biographies', [{ value: scalars.notes, contentType: 'TEXT_PLAIN' }]);

  const birthday = details.birthday ? stringToDate(details.birthday) : null;
  if (birthday) add('birthdays', [{ date: birthday }]);

  const emails = nonEmpty(details.emails, (e) => !!e.value);
  if (emails.length) add('emailAddresses', emails.map((e) => ({ value: e.value, type: e.label || undefined })));

  const phones = nonEmpty(details.phones, (e) => !!e.value);
  if (phones.length) add('phoneNumbers', phones.map((e) => ({ value: e.value, type: e.label || undefined })));

  const urls = nonEmpty(details.urls, (e) => !!e.value);
  if (urls.length) add('urls', urls.map((e) => ({ value: e.value, type: e.label || undefined })));

  const chats = nonEmpty(details.chats, (e) => !!e.value);
  if (chats.length)
    add('imClients', chats.map((e) => ({ username: e.value, protocol: e.label || undefined })));

  const relations = nonEmpty(details.relations, (e) => !!e.value);
  if (relations.length)
    add('relations', relations.map((e) => ({ person: e.value, type: e.label || undefined })));

  const events = nonEmpty(details.events, (e) => !!stringToDate(e.value));
  if (events.length)
    add('events', events.map((e) => ({ date: stringToDate(e.value), type: e.label || undefined })));

  const userDefined = nonEmpty(details.user_defined, (e) => !!e.label || !!e.value);
  if (userDefined.length)
    add('userDefined', userDefined.map((e) => ({ key: e.label, value: e.value })));

  const orgs = nonEmpty(details.organizations, (o) => !!o.name || !!o.title || !!o.department);
  if (orgs.length)
    add(
      'organizations',
      orgs.map((o: ContactOrganization) => ({
        name: o.name || undefined,
        title: o.title || undefined,
        department: o.department || undefined,
      })),
    );

  const addresses = nonEmpty(
    details.addresses,
    (a) => !!(a.street || a.city || a.region || a.postal_code || a.country),
  );
  if (addresses.length)
    add(
      'addresses',
      addresses.map((a: ContactAddress) => ({
        type: a.label || undefined,
        streetAddress: a.street || undefined,
        city: a.city || undefined,
        region: a.region || undefined,
        postalCode: a.postal_code || undefined,
        countryCode: a.country || undefined,
      })),
    );

  return { body, mask };
}
