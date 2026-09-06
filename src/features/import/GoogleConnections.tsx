import { useEffect, useState } from 'react';
import { useAuth } from '../auth/authContext';
import { useProfile, useUpdateProfile } from '../profile/useProfile';
import { ReimportPrompt } from './ReimportPrompt';
import { useGoogleSync } from './useGoogleSync';
import { disconnectGoogle, getGoogleLinkState, type LinkState } from './googleToken';
import type { OutboundReport } from './googlePush';

// What each connection state means, in the user's terms, plus whether syncing
// can work at all in that state.
const LINK_TEXT: Record<LinkState, string> = {
  linked: 'Connected permanently. Syncs on its own every 15 minutes while the app is open.',
  'session-only':
    'Connected for this browser tab only - the link expires within the hour. Deploy the ' +
    'google-token function (see README) to keep it connected permanently.',
  'not-configured':
    'The google-token function is deployed but has no Google client id/secret, so it cannot ' +
    'refresh the connection. Set them with `supabase secrets set` (see README).',
  unavailable:
    'Not connected, and the google-token function is not reachable. Click "Connect Google" to ' +
    'sync in this tab.',
  none: 'Not connected. Click "Connect Google".',
};

export function GoogleConnections() {
  const { signInWithGoogle, session } = useAuth();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const sync = useGoogleSync();
  const [link, setLink] = useState<LinkState | null>(null);

  const enabled = profile?.google_sync_enabled ?? false;
  const lastSynced = profile?.google_last_synced;
  const isGoogle = session?.user.app_metadata.provider === 'google';

  // Re-read after a sync: a run is when a dead refresh token is discovered and
  // dropped, and the card would otherwise keep claiming a live connection.
  useEffect(() => {
    let live = true;
    getGoogleLinkState().then((s) => live && setLink(s));
    return () => {
      live = false;
    };
  }, [sync.busy]);

  function toggle() {
    updateProfile.mutate({ google_sync_enabled: !enabled });
  }

  async function disconnect() {
    await disconnectGoogle();
    setLink(await getGoogleLinkState());
  }

  const s = sync.summary;

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

      {link && (
        <div className={link === 'linked' ? 'muted' : 'muted warn-text'}>{LINK_TEXT[link]}</div>
      )}

      <div className="actions-row">
        <button className="link" onClick={signInWithGoogle}>Connect Google</button>
        {link === 'linked' && (
          <button className="link" onClick={disconnect}>Disconnect</button>
        )}
        <button onClick={() => sync.run()} disabled={!enabled || sync.busy}>
          {sync.busy ? 'Syncing...' : 'Sync now'}
        </button>
      </div>
      {!enabled && (
        <div className="muted">Turn the switch on to enable syncing, then click Sync now.</div>
      )}
      {sync.status && (
        <div className="muted">
          {sync.status}
          {sync.help && (
            <>
              {' '}
              <a href={sync.help} target="_blank" rel="noreferrer">Open the setting</a>
            </>
          )}
        </div>
      )}
      {s && (
        <div className="muted">
          Synced: {s.inserted} added, {s.skipped} already present
          {s.tags > 0 && `, ${s.tags} labels imported as tags`}
          {s.linked > 0 && `, ${s.linked} linked back to Google for editing`}.
        </div>
      )}
      {sync.outbound && <OutboundNote report={sync.outbound} />}
      <p className="muted small">
        While the switch is on, contacts you add here are created in Google, edits to a
        Google-linked contact are written back, and deleting a contact here deletes it in Google
        too (it lands in Google's own trash for 30 days). Only fields holding a value are pushed -
        clearing a field here leaves Google's copy alone. "Clear all" on the Contacts page is the
        one exception: it never touches Google.
      </p>

      {sync.pending && (
        <ReimportPrompt deleted={sync.pending} onConfirm={sync.confirm} onCancel={sync.cancel} />
      )}
    </div>
  );
}

// The other direction of the sync: what this app just wrote into Google
// Contacts. Named, not counted - these are edits to data living elsewhere, so
// "3 updated" is not enough to check the run did what you expected.
function OutboundNote({ report }: { report: OutboundReport }) {
  if (report.blocked === 'no-token') {
    return (
      <div className="muted">
        Your edits were not sent to Google: reconnect Google, then sync again.
      </div>
    );
  }
  const touched = report.created.length + report.updated.length + report.failed.length;
  if (touched === 0) {
    return <div className="muted">Nothing here needed sending to Google.</div>;
  }
  return (
    <div className="sync-report">
      <div className="section-label">Changed in Google Contacts</div>
      <ul>
        {report.created.map((name) => (
          <li key={`c:${name}`}>Created <strong>{name}</strong></li>
        ))}
        {report.updated.map((name) => (
          <li key={`u:${name}`}>Updated <strong>{name}</strong></li>
        ))}
        {report.failed.map((f) => (
          <li key={`f:${f.name}`} className="error">
            {f.name} could not be sent: {f.error}
          </li>
        ))}
      </ul>
    </div>
  );
}
