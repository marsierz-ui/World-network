import { useAuth } from '../auth/authContext';
import { useProfile, useUpdateProfile } from '../profile/useProfile';
import { ReimportPrompt } from './ReimportPrompt';
import { useGoogleSync } from './useGoogleSync';
import type { OutboundReport } from './googlePush';

export function GoogleConnections() {
  const { signInWithGoogle, session } = useAuth();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const sync = useGoogleSync();

  const enabled = profile?.google_sync_enabled ?? false;
  const lastSynced = profile?.google_last_synced;
  const isGoogle = session?.user.app_metadata.provider === 'google';

  function toggle() {
    updateProfile.mutate({ google_sync_enabled: !enabled });
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
      <div className="actions-row">
        <button className="link" onClick={signInWithGoogle}>Connect Google</button>
        <button onClick={() => sync.run()} disabled={!enabled || sync.busy}>
          {sync.busy ? 'Syncing...' : 'Sync now'}
        </button>
      </div>
      {!enabled && (
        <div className="muted">Turn the switch on to enable syncing, then click Sync now.</div>
      )}
      {sync.status && <div className="muted">{sync.status}</div>}
      {s && (
        <div className="muted">
          Synced: {s.inserted} added, {s.skipped} already present
          {s.tags > 0 && `, ${s.tags} labels imported as tags`}
          {s.linked > 0 && `, ${s.linked} linked back to Google for editing`}.
        </div>
      )}
      {sync.outbound && <OutboundNote report={sync.outbound} />}
      <p className="muted small">
        Pull is on-demand (runs when you click, or right after connecting Google). Automatic
        background sync requires a server component and is planned.
      </p>
      <p className="muted small">
        While the switch is on, contacts you add here are created in Google, and edits to a
        Google-linked contact are written back. Only fields holding a value are pushed - clearing a
        field here leaves Google's copy alone, and deleting a contact here never deletes it from
        Google. Because Google keeps it, the next sync asks before bringing it back.
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
