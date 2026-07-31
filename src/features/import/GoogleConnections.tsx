import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/authContext';
import { useProfile, useUpdateProfile } from '../profile/useProfile';
import { fetchGoogleContacts } from './googleContacts';
import { useBulkImport } from './useImport';

export function GoogleConnections() {
  const { signInWithGoogle, session } = useAuth();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const bulk = useBulkImport();
  const [status, setStatus] = useState<string | null>(null);

  const enabled = profile?.google_sync_enabled ?? false;
  const lastSynced = profile?.google_last_synced;
  const isGoogle = session?.user.app_metadata.provider === 'google';

  function toggle() {
    updateProfile.mutate({ google_sync_enabled: !enabled });
  }

  async function syncNow() {
    setStatus('Checking Google connection...');
    const { data } = await supabase.auth.getSession();
    const token = data.session?.provider_token;
    if (!token) {
      setStatus('Google not connected in this session. Click "Connect Google" and try again.');
      return;
    }
    try {
      setStatus('Syncing contacts from Google...');
      const contacts = await fetchGoogleContacts(token);
      const result = await bulk.mutateAsync({
        items: contacts.map((input) => ({ input, labels: [] })),
        source: 'google',
      });
      updateProfile.mutate({ google_last_synced: new Date().toISOString() });
      setStatus(`Synced: ${result.inserted} added, ${result.skipped} already present.`);
    } catch (e) {
      setStatus(`Sync failed: ${(e as Error).message}`);
    }
  }

  return (
    <div className="connection-card">
      <div className="conn-head">
        <div>
          <strong>Google Contacts</strong>
          <div className="muted">
            {isGoogle ? 'Connected via Google sign-in.' : 'Sign in with Google to enable syncing.'}
            {lastSynced && ` Last synced ${new Date(lastSynced).toLocaleString()}.`}
          </div>
        </div>
        <label className="switch">
          <input type="checkbox" checked={enabled} onChange={toggle} />
          <span className="slider" />
        </label>
      </div>
      <div className="actions-row">
        <button className="link" onClick={signInWithGoogle}>Connect Google</button>
        <button onClick={syncNow} disabled={!enabled || bulk.isPending}>
          {bulk.isPending ? 'Syncing...' : 'Sync now'}
        </button>
      </div>
      {status && <div className="muted">{status}</div>}
      <p className="muted small">
        Sync is on-demand (runs when you click, or right after connecting Google). Automatic
        background sync requires a server component and is planned.
      </p>
    </div>
  );
}
