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
