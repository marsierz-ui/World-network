// Hand-maintained types mirroring supabase/migrations/0001_init.sql.
// Regenerate with `supabase gen types typescript --local` once the stack is running.

export type ViewMode = 'cosmopolitan' | 'homelover';
export type ContactCategory = 'work' | 'private' | 'other';
export type ContactSource = 'google' | 'csv' | 'manual' | 'linkedin_csv';
export type FieldType = 'text' | 'date' | 'number' | 'select' | 'tags' | 'boolean';
export type LocationType = 'residence' | 'work';
export type TagKind = 'community' | 'label';

export interface Profile {
  user_id: string;
  display_name: string | null;
  home_city: string | null;
  home_country: string | null;
  view_mode_default: ViewMode;
  languages_spoken: string[];
  share_on_leaderboard: boolean;
  google_sync_enabled: boolean;
  google_last_synced: string | null;
  created_at: string;
  updated_at: string;
}

/** A repeatable value plus its Google `type` ("home", "work", "mobile", or a custom string). */
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

/**
 * Everything the Google Contacts editor can hold that has no column of its own.
 * Keys mirror the People API so the sync mapping in googlePerson.ts stays legible.
 *
 * The scalar columns are derived from this on save, not the other way round:
 * primary_email is emails[0], phone is phones[0]. current_city/current_country
 * are NOT part of it - those are the map location and are edited separately.
 */
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
  /** 'yyyy-mm-dd', or '--mm-dd' when Google holds no year. */
  birthday?: string;
  organizations?: ContactOrganization[];
  emails?: LabeledValue[];
  phones?: LabeledValue[];
  addresses?: ContactAddress[];
  urls?: LabeledValue[];
  /** label = protocol (skype, jabber, ...), value = username. */
  chats?: LabeledValue[];
  /** label = relation type (spouse, child, ...), value = the person's name. */
  relations?: LabeledValue[];
  /** label = event type (anniversary, ...), value = 'yyyy-mm-dd' or '--mm-dd'. */
  events?: LabeledValue[];
  /** label = the user's own field name. */
  user_defined?: LabeledValue[];
}

export interface Contact {
  id: string;
  user_id: string;
  full_name: string;
  primary_email: string | null;
  phone: string | null;
  notes: string | null;
  avatar_url: string | null;
  origin_country: string | null;
  current_city: string | null;
  current_country: string | null;
  category: ContactCategory;
  source: ContactSource;
  external_ids: Record<string, unknown>;
  custom: Record<string, unknown>;
  details: ContactDetails;
  socials: Record<string, string>;
  // GeoJSON not selected directly; we read lng/lat via the v_contacts_geo view or compute client-side.
  current_lng: number | null;
  current_lat: number | null;
  created_at: string;
  updated_at: string;
}

export interface FieldDefinition {
  id: string;
  user_id: string;
  key: string;
  label: string;
  type: FieldType;
  options: string[];
  sort_order: number;
  created_at: string;
}

export interface LocationHistory {
  id: string;
  contact_id: string;
  user_id: string;
  city: string | null;
  country: string | null;
  lng: number | null;
  lat: number | null;
  date_from: string | null;
  date_to: string | null;
  type: LocationType;
  source: ContactSource;
  note: string | null;
  created_at: string;
}

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  kind: TagKind;
  color: string;
  /** One level of nesting: sublabels point at their parent label. */
  parent_id: string | null;
  created_at: string;
}

export type ContactEventAction = 'added' | 'removed';

// Written by the contacts_log_event trigger; contact_id has no FK so the
// entry outlives the contact it describes.
export interface ContactEvent {
  id: string;
  user_id: string;
  contact_id: string | null;
  full_name: string;
  primary_email: string | null;
  current_city: string | null;
  current_country: string | null;
  category: ContactCategory | null;
  source: ContactSource | null;
  action: ContactEventAction;
  created_at: string;
}
