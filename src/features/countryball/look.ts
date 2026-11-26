// A member's countryball look. Stored as profiles.avatar (jsonb) once the
// 20261122120000_countryball_avatar migration is applied, and in localStorage
// until then, so the customiser works either way.

export const HAIRS = [
  { id: 'none', label: 'None' },
  { id: 'spiky', label: 'Spiky' },
  { id: 'bob', label: 'Bob' },
  { id: 'curly', label: 'Curly' },
  { id: 'bun', label: 'Bun' },
  { id: 'mohawk', label: 'Mohawk' },
  { id: 'long', label: 'Long' },
] as const;

export const EYES = [
  { id: 'classic', label: 'Classic' },
  { id: 'happy', label: 'Happy' },
  { id: 'sleepy', label: 'Sleepy' },
  { id: 'stern', label: 'Stern' },
  { id: 'wink', label: 'Wink' },
  { id: 'dots', label: 'Pupils' },
] as const;

export const GLASSES = [
  { id: 'none', label: 'None' },
  { id: 'round', label: 'Round' },
  { id: 'square', label: 'Square' },
  { id: 'shades', label: 'Shades' },
  { id: 'monocle', label: 'Monocle' },
] as const;

export const HATS = [
  { id: 'none', label: 'None' },
  { id: 'cap', label: 'Cap' },
  { id: 'beanie', label: 'Beanie' },
  { id: 'tophat', label: 'Top hat' },
  { id: 'crown', label: 'Crown' },
  { id: 'headphones', label: 'Headphones' },
  { id: 'flower', label: 'Flower' },
] as const;

export const HAIR_COLORS = ['#2a1b12', '#6b3f1f', '#e0b04a', '#b5452a', '#9aa0a6', '#ff48b0', '#0078bf'];

export type HairId = (typeof HAIRS)[number]['id'];
export type EyesId = (typeof EYES)[number]['id'];
export type GlassesId = (typeof GLASSES)[number]['id'];
export type HatId = (typeof HATS)[number]['id'];

export interface BallLook {
  hair: HairId;
  hairColor: string;
  eyes: EyesId;
  glasses: GlassesId;
  hat: HatId;
  /** ISO alpha-2 of the flag the member wants on their ball; null = profile's country. */
  country: string | null;
  /**
   * Local flag choice: none, the home region's flag, or the home city's flag.
   * Absent on looks saved before it existed (the customiser then preselects one).
   */
  local?: LocalChoice;
  /** The flag id that choice resolved to when saved (lib/localFlags), so others can draw it. */
  localFlag?: string | null;
}

export type LocalChoice = 'none' | 'region' | 'city';

export const DEFAULT_LOOK: BallLook = {
  hair: 'none',
  hairColor: HAIR_COLORS[0],
  eyes: 'classic',
  glasses: 'none',
  hat: 'none',
  country: null,
};

const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];

export function randomLook(country: string | null = null): BallLook {
  return {
    hair: pick(HAIRS).id,
    hairColor: pick(HAIR_COLORS),
    eyes: pick(EYES).id,
    glasses: Math.random() < 0.5 ? 'none' : pick(GLASSES).id,
    hat: Math.random() < 0.45 ? 'none' : pick(HATS).id,
    country,
  };
}

const ids = (list: readonly { id: string }[]) => new Set(list.map((x) => x.id));
const HAIR_IDS = ids(HAIRS), EYE_IDS = ids(EYES), GLASS_IDS = ids(GLASSES), HAT_IDS = ids(HATS);

/** Accepts anything (a database row, localStorage) and returns a valid look or null. */
export function parseLook(v: unknown): BallLook | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const str = (k: string) => (typeof o[k] === 'string' ? (o[k] as string) : '');
  const look: BallLook = {
    hair: (HAIR_IDS.has(str('hair')) ? str('hair') : 'none') as HairId,
    hairColor: /^#[0-9a-f]{6}$/i.test(str('hairColor')) ? str('hairColor') : HAIR_COLORS[0],
    eyes: (EYE_IDS.has(str('eyes')) ? str('eyes') : 'classic') as EyesId,
    glasses: (GLASS_IDS.has(str('glasses')) ? str('glasses') : 'none') as GlassesId,
    hat: (HAT_IDS.has(str('hat')) ? str('hat') : 'none') as HatId,
    country: /^[A-Z]{2}$/.test(str('country')) ? str('country') : null,
  };
  if (['none', 'region', 'city'].includes(str('local'))) look.local = str('local') as LocalChoice;
  if (/^(city:[a-z]+|[A-Z]{2}-[A-Z0-9]{1,3})$/.test(str('localFlag'))) look.localFlag = str('localFlag');
  return look;
}
