import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../features/auth/authContext';
import {
  autoMap,
  MAP_TARGETS,
  parseCsv,
  rowsToContacts,
  type MapTarget,
  type ParsedCsv,
} from '../features/import/parseCsv';
import { fetchGoogleContacts } from '../features/import/googleContacts';
import { getGoogleToken } from '../features/import/googleToken';
import { fetchLinkedInConnections, linkedinRowsToItems, resolveActiveVersion } from '../features/import/linkedinPortability';
import { useImportLinkedInSelf } from '../features/mobility/useLinkedInSelf';
import { useBulkImport, type ImportSummary } from '../features/import/useImport';

export function ImportPage() {
  return (
    <div className="page-pad import-page">
      <h2>Import contacts</h2>
      <LinkedInImport />
      <GoogleImport />
      <CsvImport />
    </div>
  );
}

function LinkedInImport() {
  const bulk = useBulkImport();
  const self = useImportLinkedInSelf();
  const [token, setToken] = useState('');
  const [version, setVersion] = useState('202605');
  const [status, setStatus] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  async function resolve(): Promise<string> {
    setStatus('Finding an active LinkedIn API version...');
    const v = await resolveActiveVersion(token, version);
    if (v !== version) setVersion(v);
    return v;
  }

  async function run() {
    if (!token.trim()) return;
    setSummary(null);
    try {
      const v = await resolve();
      setStatus('Fetching connections from LinkedIn...');
      const rows = await fetchLinkedInConnections(token, v);
      if (rows.length === 0) {
        setStatus('No connections returned. Check the token scope and that data has finished processing.');
        return;
      }
      const items = linkedinRowsToItems(rows);
      const result = await bulk.mutateAsync({ items, source: 'linkedin_csv' });
      setSummary(result);
      setStatus(null);
    } catch (e) {
      setStatus(`Failed: ${(e as Error).message}`);
    }
  }

  async function runSelf() {
    if (!token.trim()) return;
    setSummary(null);
    try {
      const v = await resolve();
      setStatus('Importing your profile + job history...');
      const r = await self.mutateAsync({ token, version: v });
      setStatus(`Imported your trajectory: ${r.positions} positions (${r.placed} placed). See the Mobility tab.`);
    } catch (e) {
      setStatus(`Failed: ${(e as Error).message}`);
    }
  }

  return (
    <section className="import-card">
      <h3>LinkedIn (Member Data Portability)</h3>
      <p className="muted">
        Generate an access token with the <code>r_dma_portability_self_serve</code> scope in
        LinkedIn's{' '}
        <a href="https://www.linkedin.com/developers/tools/oauth" target="_blank" rel="noreferrer">
          OAuth Token Generator
        </a>{' '}
        and paste it below. Pulls your connections via the Member Snapshot API. EEA/Switzerland
        members only. (Works while running the local dev server, which proxies the LinkedIn API.)
      </p>
      <label className="li-field">
        Access token
        <textarea
          rows={3}
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Paste LinkedIn access token"
        />
      </label>
      <label className="li-field">
        API version <span className="muted">(auto-detected; override only if needed)</span>
        <input value={version} onChange={(e) => setVersion(e.target.value)} />
      </label>
      <div className="actions-row">
        <button onClick={run} disabled={bulk.isPending || !token.trim()}>
          Import connections
        </button>
        <button onClick={runSelf} disabled={self.isPending || !token.trim()}>
          Import my profile + job history
        </button>
      </div>
      {status && <div className="muted">{status}</div>}
      {bulk.isError && <div className="error">Import failed: {(bulk.error as Error).message}</div>}
      {summary && (
        <div className="summary">
          Imported {summary.inserted} ({summary.placed} placed), skipped {summary.skipped} duplicates.
        </div>
      )}
    </section>
  );
}

function GoogleImport() {
  const { signInWithGoogle } = useAuth();
  const bulk = useBulkImport();
  const [status, setStatus] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  async function run() {
    setStatus('Connecting to Google...');
    setSummary(null);
    const { data } = await supabase.auth.getSession();
    const token = data.session?.provider_token ?? getGoogleToken();
    if (!token) {
      setStatus('No Google token in session. Reconnect Google to grant Contacts access.');
      return;
    }
    try {
      setStatus('Fetching contacts from Google...');
      const contacts = await fetchGoogleContacts(token);
      const result = await bulk.mutateAsync({ items: contacts, source: 'google' });
      setSummary(result);
      setStatus(null);
    } catch (e) {
      setStatus(`Failed: ${(e as Error).message}`);
    }
  }

  return (
    <section className="import-card">
      <h3>Google Contacts</h3>
      <p className="muted">
        Pulls your Google connections via the People API. Requires the contacts.readonly scope
        granted at sign-in.
      </p>
      <div className="actions-row">
        <button onClick={run} disabled={bulk.isPending}>Import from Google</button>
        <button className="link" onClick={signInWithGoogle}>Reconnect Google</button>
      </div>
      {status && <div className="muted">{status}</div>}
      {bulk.isError && <div className="error">Import failed: {(bulk.error as Error).message}</div>}
      {summary && (
        <div className="summary">
          Imported {summary.inserted} ({summary.placed} placed on map), skipped {summary.skipped}{' '}
          duplicates, {summary.tags} tags from labels.
        </div>
      )}
    </section>
  );
}

function CsvImport() {
  const bulk = useBulkImport();
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [mapping, setMapping] = useState<Record<string, MapTarget>>({});
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSummary(null);
    const text = await file.text();
    const p = parseCsv(text);
    setParsed(p);
    setMapping(autoMap(p.fields));
  }

  async function doImport() {
    if (!parsed) return;
    const source = parsed.isLinkedIn ? 'linkedin_csv' : 'csv';
    const items = rowsToContacts(parsed.rows, mapping, source);
    const result = await bulk.mutateAsync({ items, source });
    setSummary(result);
    setParsed(null);
  }

  const previewCount = parsed
    ? rowsToContacts(parsed.rows, mapping, 'csv').length
    : 0;

  return (
    <section className="import-card">
      <h3>CSV upload</h3>
      <p className="muted">
        Generic CSV or a LinkedIn Connections.csv export (auto-detected). LinkedIn exports have no
        location data, so those contacts land on the map only once you add a city.
      </p>
      <input type="file" accept=".csv,text/csv" onChange={onFile} />

      {parsed && (
        <div className="mapping">
          {parsed.isLinkedIn && <div className="badge">LinkedIn export detected</div>}
          <table className="mapping-table">
            <thead>
              <tr><th>CSV column</th><th>Maps to</th></tr>
            </thead>
            <tbody>
              {parsed.fields.map((f) => (
                <tr key={f}>
                  <td>{f}</td>
                  <td>
                    <select
                      value={mapping[f] ?? 'ignore'}
                      onChange={(e) => setMapping((m) => ({ ...m, [f]: e.target.value as MapTarget }))}
                    >
                      {MAP_TARGETS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="actions-row">
            <button onClick={doImport} disabled={bulk.isPending}>
              Import {previewCount} contacts
            </button>
            <button className="link" onClick={() => setParsed(null)}>Cancel</button>
          </div>
        </div>
      )}

      {bulk.isError && <div className="error">Import failed: {(bulk.error as Error).message}</div>}
      {summary && (
        <div className="summary">
          Imported {summary.inserted} ({summary.placed} placed on map), skipped {summary.skipped}{' '}
          duplicates, {summary.tags} tags from labels.
        </div>
      )}
    </section>
  );
}
