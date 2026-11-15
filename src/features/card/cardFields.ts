import type { CardField } from '../../lib/database.types';

// The optional parts of a card. The display name is always on it.
export const CARD_FIELDS: { key: CardField; label: string; short: string }[] = [
  { key: 'phone', label: 'Phone', short: 'phone' },
  { key: 'emails', label: 'Email addresses (login email and the others in Settings)', short: 'email' },
  { key: 'socials', label: 'Social profiles, including LinkedIn', short: 'social profiles' },
  { key: 'home', label: 'Home city and country', short: 'home city' },
];
