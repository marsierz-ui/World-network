import { useState } from 'react';
import { CountryBall } from './CountryBall';
import { FlagCloud } from './FlagCloud';
import { useMyBallLook, useSaveBallLook } from './useBallLook';
import { DEFAULT_LOOK, EYES, GLASSES, HAIRS, HAIR_COLORS, HATS, randomLook, type BallLook, type LocalChoice } from './look';
import type { LocalMatch } from '../../lib/localFlags';
import { COUNTRIES } from '../../lib/countries';

type Part = 'hair' | 'eyes' | 'glasses' | 'hat';
const PARTS: { key: Part; label: string; options: readonly { id: string; label: string }[] }[] = [
  { key: 'hair', label: 'Hair', options: HAIRS },
  { key: 'eyes', label: 'Eyes', options: EYES },
  { key: 'glasses', label: 'Glasses', options: GLASSES },
  { key: 'hat', label: 'Hat', options: HATS },
];

/**
 * Lets the signed-in member dress up their own countryball. Linked members see
 * this look on their maps; everyone else on CrowdTrails is drawn plain.
 */
export function BallCustomizer(props: { onSaved?: () => void; compact?: boolean }) {
  const { look: saved, country: profileCountry, home } = useMyBallLook();
  // Remounts when the stored look and home arrive (the profile loads after first render).
  const key = `${JSON.stringify(saved)}|${home.region?.id}|${home.city?.id}`;
  return <Editor key={key} {...props} saved={saved} profileCountry={profileCountry} home={home} />;
}

function localFlagFor(choice: LocalChoice | undefined, home: LocalMatch): string | null {
  if (choice === 'city') return home.city?.id ?? null;
  if (choice === 'region') return home.region?.id ?? null;
  return null;
}

/** Saved choice if it still applies, else preselected from home: city flag, then region flag. */
function initialLook(saved: BallLook | null, home: LocalMatch): BallLook {
  const base = saved ?? DEFAULT_LOOK;
  let local: LocalChoice = base.local ?? (home.city ? 'city' : home.region ? 'region' : 'none');
  if (local !== 'none' && !localFlagFor(local, home)) local = home.region ? 'region' : 'none';
  return { ...base, local, localFlag: localFlagFor(local, home) };
}

function localOptions(home: LocalMatch) {
  const out: { choice: LocalChoice; label: string; title: string }[] = [
    { choice: 'none', label: 'National', title: 'National flag' },
  ];
  if (home.region) out.push({ choice: 'region', label: home.region.name, title: `Flag of ${home.region.name}` });
  if (home.city) out.push({ choice: 'city', label: home.city.name, title: `Flag of ${home.city.name}` });
  return out;
}

function Editor({
  onSaved,
  compact,
  saved,
  profileCountry,
  home,
}: {
  onSaved?: () => void;
  compact?: boolean;
  saved: BallLook | null;
  profileCountry: string | null;
  home: LocalMatch;
}) {
  const save = useSaveBallLook();
  const [look, setLook] = useState<BallLook>(() => initialLook(saved, home));
  const [bump, setBump] = useState(0);
  const [done, setDone] = useState<'remote' | 'local' | null>(null);

  const country = look.country ?? profileCountry;
  const set = (patch: Partial<BallLook>) => {
    setLook((l) => ({ ...l, ...patch }));
    setDone(null);
    setBump((b) => b + 1);
  };

  return (
    <div className={compact ? 'cb-custom compact' : 'cb-custom'}>
      <div className="cb-stage">
        <div key={bump} className="cb-preview">
          <span className="cb-with-cloud">
            <CountryBall country={country} look={look} size={compact ? 132 : 168} title="Preview of your countryball" />
            {look.local && look.local !== 'none' && look.localFlag && <FlagCloud key={look.localFlag} flag={look.localFlag} size={compact ? 1.6 : 2} />}
          </span>
        </div>
        <button type="button" className="cb-random" onClick={() => set({ ...randomLook(look.country), local: look.local, localFlag: look.localFlag })}>
          Surprise me
        </button>
      </div>

      <div className="cb-options">
        <label className="cb-row">
          <span className="cb-label">Flag</span>
          <select
            id="cb-country"
            value={look.country ?? ''}
            onChange={(e) => {
              const cc = e.target.value || null;
              // Another country's flag: a home region flag would contradict it.
              const other = cc && home.region && cc !== home.region.cc;
              set(other ? { country: cc, local: 'none', localFlag: null } : { country: cc });
            }}
          >
            <option value="">My home country{profileCountry ? ` (${profileCountry})` : ''}</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
        </label>

        <fieldset className="cb-row">
          <legend className="cb-label">Local flag</legend>
          {home.region || home.city ? (
            <div className="cb-choices">
              {localOptions(home).map((o) => {
                const on = (look.local ?? 'none') === o.choice;
                return (
                  <button
                    key={o.choice}
                    type="button"
                    className={on ? 'cb-choice on' : 'cb-choice'}
                    aria-pressed={on}
                    title={o.title}
                    onClick={() => set({ local: o.choice, localFlag: localFlagFor(o.choice, home) })}
                  >
                    <span className="cb-with-cloud">
                      <CountryBall country={country} look={look} size={40} />
                      {localFlagFor(o.choice, home) && <FlagCloud flag={localFlagFor(o.choice, home)!} size={0.7} />}
                    </span>
                    <span>{o.label}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="muted cb-hint">Add your home city in Settings to show your region's or city's flag in a cloud by your ball.</p>
          )}
        </fieldset>

        {PARTS.map((part) => (
          <fieldset key={part.key} className="cb-row">
            <legend className="cb-label">{part.label}</legend>
            <div className="cb-choices">
              {part.options.map((o) => {
                const on = look[part.key] === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    className={on ? 'cb-choice on' : 'cb-choice'}
                    aria-pressed={on}
                    title={o.label}
                    onClick={() => set({ [part.key]: o.id } as Partial<BallLook>)}
                  >
                    <CountryBall country={country} look={{ ...look, [part.key]: o.id }} size={40} />
                    <span>{o.label}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}

        <fieldset className="cb-row">
          <legend className="cb-label">Hair colour</legend>
          <div className="cb-swatches">
            {HAIR_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={look.hairColor === c ? 'cb-swatch on' : 'cb-swatch'}
                style={{ background: c }}
                aria-label={`Hair colour ${c}`}
                aria-pressed={look.hairColor === c}
                onClick={() => set({ hairColor: c })}
              />
            ))}
          </div>
        </fieldset>

        <div className="cb-actions">
          <button
            type="button"
            className="cb-save"
            disabled={save.isPending}
            onClick={() =>
              save.mutate(look, {
                onSuccess: (r) => {
                  setDone(r.remote ? 'remote' : 'local');
                  onSaved?.();
                },
              })
            }
          >
            {save.isPending ? 'Saving...' : 'Save my ball'}
          </button>
          {done === 'remote' && <span className="muted">Saved. Connected members see it on their map.</span>}
          {done === 'local' && <span className="muted">Saved on this device. It reaches your connections once sync is switched on.</span>}
        </div>
      </div>
    </div>
  );
}
