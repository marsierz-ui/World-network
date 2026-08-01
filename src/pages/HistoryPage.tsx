import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useContacts } from '../features/contacts/useContacts';
import { useContactHistory, useClearContactHistory } from '../features/contacts/useContactHistory';
import { COUNTRY_BY_CODE } from '../lib/countries';
import type { ContactEvent, ContactEventAction, ContactSource } from '../lib/database.types';

const SOURCE_LABEL: Record<ContactSource, string> = {
  manual: 'Manual',
  google: 'Google',
  csv: 'CSV',
  linkedin_csv: 'LinkedIn',
};

type Filter = 'all' | ContactEventAction;

function dayKey(iso: string) {
  return new Date(iso).toISOString().slice(0, 10);
}

function dayLabel(key: string) {
  const today = new Date().toISOString().slice(0, 10);
  if (key === today) return 'Today';
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (key === yesterday) return 'Yesterday';
  return new Date(`${key}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function place(e: ContactEvent) {
  const country = e.current_country ? COUNTRY_BY_CODE.get(e.current_country)?.name : null;
  return [e.current_city, country ?? e.current_country].filter(Boolean).join(', ');
}

export function HistoryPage() {
  const { data: events = [], isLoading, error } = useContactHistory();
  const { data: contacts = [] } = useContacts();
  const clear = useClearContactHistory();
  const navigate = useNavigate();
  // History outlives the contacts it describes, so only offer a link for the
  // ones that still exist.
  const liveIds = useMemo(() => new Set(contacts.map((c) => c.id)), [contacts]);
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');

  const added = events.filter((e) => e.action === 'added').length;
  const removed = events.length - added;

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = events.filter((e) => {
      if (filter !== 'all' && e.action !== filter) return false;
      if (!needle) return true;
      return (
        e.full_name.toLowerCase().includes(needle) ||
        (e.primary_email ?? '').toLowerCase().includes(needle) ||
        place(e).toLowerCase().includes(needle)
      );
    });

    const map = new Map<string, ContactEvent[]>();
    for (const e of rows) {
      const k = dayKey(e.created_at);
      const list = map.get(k);
      if (list) list.push(e);
      else map.set(k, [e]);
    }
    return [...map.entries()];
  }, [events, filter, q]);

  return (
    <div className="page-pad history-page">
      <div className="history-head">
        <div>
          <h2 className="history-title">History</h2>
          <div className="muted">
            {added} added{removed > 0 && ` · ${removed} removed`}
          </div>
        </div>
        {events.length > 0 && (
          <button
            className="link"
            disabled={clear.isPending}
            onClick={() => {
              if (confirm('Clear the entire contact history? This cannot be undone.')) clear.mutate();
            }}
          >
            Clear history
          </button>
        )}
      </div>

      <div className="toolbar">
        <input
          placeholder="Search name, email or place"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
          <option value="all">All</option>
          <option value="added">Added</option>
          <option value="removed">Removed</option>
        </select>
      </div>

      {isLoading && <div className="muted">Loading history...</div>}
      {error && <div className="error">{(error as Error).message}</div>}

      {!isLoading && events.length === 0 && (
        <div className="muted">
          No history yet. Every contact you add or remove is recorded here automatically.
        </div>
      )}
      {!isLoading && events.length > 0 && groups.length === 0 && (
        <div className="muted">No entries match this filter.</div>
      )}

      {groups.map(([key, rows]) => (
        <section key={key} className="history-day">
          <div className="section-label">
            {dayLabel(key)} <span className="hist-count">{rows.length}</span>
          </div>
          {rows.map((e) => (
            <div key={e.id} className={`hist-row ${e.action}`}>
              <span className="hist-time">
                {new Date(e.created_at).toLocaleTimeString(undefined, {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              <span className="hist-mark" aria-hidden="true">
                {e.action === 'added' ? '+' : '-'}
              </span>
              <span className="hist-name">{e.full_name}</span>
              <span className="hist-place muted">{place(e)}</span>
              {e.source && <span className="hist-source">{SOURCE_LABEL[e.source]}</span>}
              {e.contact_id && liveIds.has(e.contact_id) && (
                <button
                  className="link hist-open"
                  onClick={() => navigate(`/contacts?id=${e.contact_id}`)}
                  title="Open this contact"
                >
                  view
                </button>
              )}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
