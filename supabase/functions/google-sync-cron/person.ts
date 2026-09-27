// Google Person <-> ContactDetails mapping, ported from
// src/features/import/googlePerson.ts (verbatim logic) so the scheduled sync
// stays in step with the interactive one. Duplicated rather than imported
// across the Vite/Deno boundary - Deno requires explicit extensions on every
// relative import a shared module makes in turn, which src/ does not use.
// If you change the mapping in one place, change it in the other.

export interface LabeledValue {
  label: string;
  value: string;
}

export interface ContactAddress {
  label: string;
  street: string;
  city: string;
  region: string;
  postal_code: string;
  country: string; // ISO-3166 alpha-2
}

export interface ContactOrganization {
  name: string;
  title: string;
  department: string;
}

export interface ContactDetails {
  prefix?: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  suffix?: string;
  phonetic_first?: string;
  phonetic_middle?: string;
  phonetic_last?: string;
  file_as?: string;
  nickname?: string;
  birthday?: string;
  organizations?: ContactOrganization[];
  emails?: LabeledValue[];
  phones?: LabeledValue[];
  addresses?: ContactAddress[];
  urls?: LabeledValue[];
  chats?: LabeledValue[];
  relations?: LabeledValue[];
  events?: LabeledValue[];
  user_defined?: LabeledValue[];
}

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

function labeled(list: { value?: string; type?: string }[] | undefined): LabeledValue[] | undefined {
  const out = (list ?? []).filter((e) => e.value).map((e) => ({ label: e.type ?? '', value: e.value! }));
  return out.length ? out : undefined;
}

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

function nonEmpty<T>(list: T[] | undefined, keep: (e: T) => boolean): T[] {
  return (list ?? []).filter(keep);
}

export interface PersonPatch {
  body: Record<string, unknown>;
  mask: string[];
}

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
  if (chats.length) add('imClients', chats.map((e) => ({ username: e.value, protocol: e.label || undefined })));

  const relations = nonEmpty(details.relations, (e) => !!e.value);
  if (relations.length)
    add('relations', relations.map((e) => ({ person: e.value, type: e.label || undefined })));

  const events = nonEmpty(details.events, (e) => !!stringToDate(e.value));
  if (events.length)
    add('events', events.map((e) => ({ date: stringToDate(e.value), type: e.label || undefined })));

  const userDefined = nonEmpty(details.user_defined, (e) => !!e.label || !!e.value);
  if (userDefined.length) add('userDefined', userDefined.map((e) => ({ key: e.label, value: e.value })));

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
