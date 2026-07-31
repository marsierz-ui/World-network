import { useState } from 'react';
import { useProfile, useUpdateProfile } from '../features/profile/useProfile';
import { COUNTRIES } from '../lib/countries';
import { LANGUAGES } from '../lib/languages';
import { SearchSelect } from '../components/SearchSelect';
import { GoogleConnections } from '../features/import/GoogleConnections';
import type { Profile } from '../lib/database.types';

export function SettingsPage() {
  const { data: profile, isLoading } = useProfile();
  if (isLoading || !profile) return <div className="page-pad">Loading...</div>;
  return <SettingsForm key={profile.user_id} profile={profile} />;
}

function SettingsForm({ profile }: { profile: Profile }) {
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
    <div className="page-pad form-narrow">
      <h2>Settings</h2>
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

      <h2 className="conn-title">Connections</h2>
      <GoogleConnections />
    </div>
  );
}
