import { useState } from 'react';
import { useProfile, useUpdateProfile } from '../features/profile/useProfile';
import { COUNTRIES, COUNTRY_BY_CODE } from '../lib/countries';
import { LANGUAGES } from '../lib/languages';
import { useTheme } from '../lib/theme';
import { SearchSelect } from '../components/SearchSelect';
import { ComboSelect } from '../components/ComboSelect';
import { GoogleConnections } from '../features/import/GoogleConnections';
import { DeleteAccountCard } from '../features/account/DeleteAccountCard';
import { LabelManager } from '../features/tags/LabelManager';
import { PLATFORMS } from '../lib/socials';
import { geocode, loadCityDataset } from '../lib/geocode';
import { cityPatch, detectCity } from '../features/visits/useCityLocation';
import { useIsAdmin } from '../features/auth/useIsAdmin';
import { FeedbackInbox } from '../features/feedback/Feedback';
import type { Profile } from '../lib/database.types';

export function SettingsPage() {
  const { data: profile, isLoading } = useProfile();
  const { isAdmin } = useIsAdmin();
  return (
    <div className="page-pad form-narrow">
      <h2>Settings</h2>
      <AppearanceCard />
      <h2 className="conn-title">Profile</h2>
      {isLoading || !profile ? (
        <div className="muted">Loading profile...</div>
      ) : (
        <ProfileForm key={profile.user_id} profile={profile} />
      )}
      {profile && (
        <>
          <h2 className="conn-title">Location</h2>
          <LocationCard profile={profile} />
        </>
      )}

      <h2 className="conn-title">Labels</h2>
      <div className="connection-card">
        <div className="muted" style={{ marginBottom: 10 }}>
          Group labels under a parent to see them together on the map, each sublabel in its
          own colour.
        </div>
        <LabelManager />
      </div>

      <h2 className="conn-title">Connections</h2>
      <GoogleConnections />

      {isAdmin && (
        <>
          <h2 className="conn-title">Feedback inbox</h2>
          <FeedbackInbox />
        </>
      )}

      <h2 className="conn-title">Delete account</h2>
      <DeleteAccountCard />
    </div>
  );
}

function AppearanceCard() {
  const theme = useTheme((s) => s.theme);
  const setTheme = useTheme((s) => s.setTheme);
  return (
    <div className="connection-card">
      <div className="conn-head">
        <div>
          <strong>Theme</strong>
          <div className="muted">Applies to the app and the map basemap.</div>
        </div>
      </div>
      <div className="view-toggle appearance-toggle">
        <button
          className={theme === 'dark' ? 'seg active' : 'seg'}
          onClick={() => setTheme('dark')}
        >
          Dark
        </button>
        <button
          className={theme === 'light' ? 'seg active' : 'seg'}
          onClick={() => setTheme('light')}
        >
          Light
        </button>
      </div>
      <p className="muted small">
        Remembered on this device. Defaults to your system setting until you pick one.
      </p>
    </div>
  );
}

function LocationCard({ profile }: { profile: Profile }) {
  const update = useUpdateProfile();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function toggle(on: boolean) {
    setNote(null);
    if (!on) {
      // Off also forgets: nothing is left for connected members to see.
      update.mutate({
        location_enabled: false,
        current_city: null,
        current_country: null,
        current_lng: null,
        current_lat: null,
        location_updated_at: null,
      });
      return;
    }
    setBusy(true);
    const city = await detectCity();
    setBusy(false);
    if (!city) {
      setNote('Your browser did not share a location. Allow it for this site and try again.');
      return;
    }
    update.mutate({ location_enabled: true, ...cityPatch(city) });
  }

  return (
    <div className="connection-card">
      <div className="conn-head">
        <div>
          <strong>Use the city I am in</strong>
          <div className="muted">
            When you open the app away from home, it shows who you know there. Members you are
            connected with can see the city too.
          </div>
        </div>
        <label className="switch">
          <input
            type="checkbox"
            checked={profile.location_enabled}
            disabled={busy || update.isPending}
            onChange={(e) => void toggle(e.target.checked)}
          />
          <span className="slider" />
        </label>
      </div>
      <p className="muted small">
        City only. Your device works out the nearest city and that is all that is saved: no
        address, no coordinates of where you stand, no history of where you were. Switching this
        off deletes the saved city.
      </p>
      {busy && <div className="muted">Finding your city...</div>}
      {profile.location_enabled && profile.current_city && (
        <div className="muted">
          Currently: {profile.current_city}
          {profile.current_country
            ? `, ${COUNTRY_BY_CODE.get(profile.current_country)?.name ?? profile.current_country}`
            : ''}
        </div>
      )}
      {note && <div className="error">{note}</div>}
    </div>
  );
}

function ProfileForm({ profile }: { profile: Profile }) {
  const update = useUpdateProfile();
  const [displayName, setDisplayName] = useState(profile.display_name ?? '');
  const [homeCity, setHomeCity] = useState(profile.home_city ?? '');
  const [homeCountry, setHomeCountry] = useState(profile.home_country ?? '');
  const [languages, setLanguages] = useState<string[]>(profile.languages_spoken);
  const [share, setShare] = useState(profile.share_on_leaderboard);
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [emails, setEmails] = useState(profile.emails.join(', '));
  const [socials, setSocials] = useState<Record<string, string>>(profile.socials);
  const [linkedinConsent, setLinkedinConsent] = useState(profile.linkedin_location_consent);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    // Stored with the profile so the card and the visit alerts have a point to
    // measure from. Waits for the full city list: the curated one would place
    // most towns on their country's centroid.
    await loadCityDataset();
    const home = geocode(homeCity, homeCountry);
    update.mutate({
      display_name: displayName || null,
      home_city: homeCity || null,
      home_country: homeCountry || null,
      home_lng: home?.lng ?? null,
      home_lat: home?.lat ?? null,
      linkedin_location_consent: linkedinConsent,
      languages_spoken: languages,
      share_on_leaderboard: share,
      phone: phone.trim() || null,
      emails: [
        ...new Set(
          emails
            .split(/[\s,;]+/)
            .map((e) => e.trim().toLowerCase())
            .filter(Boolean),
        ),
      ],
      socials: Object.fromEntries(
        Object.entries(socials)
          .map(([k, v]) => [k, v.trim()])
          .filter(([, v]) => v),
      ),
    });
  }

  return (
    <form onSubmit={save}>
      <label>
        Display name
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      </label>
      <label>
        Home city
        <input value={homeCity} onChange={(e) => setHomeCity(e.target.value)} />
      </label>
      <label>
        Home country <span className="muted">(pivot for cosmopolitan vs homelover)</span>
        <ComboSelect
          options={COUNTRIES.map((c) => ({ value: c.code, label: c.name }))}
          value={homeCountry}
          onChange={setHomeCountry}
          emptyLabel="-- select --"
          placeholder="Search countries..."
        />
      </label>
      <label>
        Languages spoken <span className="muted">(search and select)</span>
        <SearchSelect
          options={LANGUAGES}
          value={languages}
          onChange={setLanguages}
          placeholder="Search languages..."
          allowCustom
        />
      </label>
      <label className="checkbox">
        <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} />
        Share my scores on the global leaderboard
      </label>
      <h3>Your details</h3>
      <p className="muted small">
        Private until you hand them over: they go on your card for people you connect with
        (choose which under My card), and they recognise you in other users' contacts so the
        history you choose to share reaches the right people. Your login email counts
        automatically.
      </p>
      <label>
        Phone
        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </label>
      <label>
        Other emails <span className="muted">(comma separated)</span>
        <input value={emails} onChange={(e) => setEmails(e.target.value)} />
      </label>
      {PLATFORMS.map((p) => (
        <label key={p.key}>
          {p.label}
          <input
            value={socials[p.key] ?? ''}
            onChange={(e) => setSocials({ ...socials, [p.key]: e.target.value })}
            placeholder={p.key === 'linkedin' ? 'https://www.linkedin.com/in/...' : undefined}
          />
        </label>
      ))}
      <label className="checkbox">
        <input
          type="checkbox"
          checked={linkedinConsent}
          onChange={(e) => setLinkedinConsent(e.target.checked)}
        />
        Use the location on my LinkedIn profile as my home city when I import my LinkedIn
        profile
      </label>
      <button type="submit" disabled={update.isPending}>
        {update.isPending ? 'Saving...' : 'Save'}
      </button>
      {update.isError && <div className="error">Save failed.</div>}
      {update.isSuccess && <div className="muted">Saved.</div>}
    </form>
  );
}
