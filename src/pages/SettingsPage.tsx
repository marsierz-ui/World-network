import { useState } from 'react';
import { useProfile, useUpdateProfile } from '../features/profile/useProfile';
import { COUNTRIES } from '../lib/countries';
import { LANGUAGES } from '../lib/languages';
import { useTheme } from '../lib/theme';
import { SearchSelect } from '../components/SearchSelect';
import { GoogleConnections } from '../features/import/GoogleConnections';
import type { Profile } from '../lib/database.types';

export function SettingsPage() {
  const { data: profile, isLoading } = useProfile();
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
      <h2 className="conn-title">Connections</h2>
      <GoogleConnections />
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

function ProfileForm({ profile }: { profile: Profile }) {
  const update = useUpdateProfile();
  const [displayName, setDisplayName] = useState(profile.display_name ?? '');
  const [homeCity, setHomeCity] = useState(profile.home_city ?? '');
  const [homeCountry, setHomeCountry] = useState(profile.home_country ?? '');
  const [languages, setLanguages] = useState<string[]>(profile.languages_spoken);
  const [share, setShare] = useState(profile.share_on_leaderboard);

  function save(e: React.FormEvent) {
    e.preventDefault();
    update.mutate({
      display_name: displayName || null,
      home_city: homeCity || null,
      home_country: homeCountry || null,
      languages_spoken: languages,
      share_on_leaderboard: share,
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
        <select value={homeCountry} onChange={(e) => setHomeCountry(e.target.value)}>
          <option value="">-- select --</option>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>{c.name}</option>
          ))}
        </select>
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
      <button type="submit" disabled={update.isPending}>
        {update.isPending ? 'Saving...' : 'Save'}
      </button>
      {update.isError && <div className="error">Save failed.</div>}
      {update.isSuccess && <div className="muted">Saved.</div>}
    </form>
  );
}
