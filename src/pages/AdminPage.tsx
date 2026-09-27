import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import type { FeedbackStatus } from '../lib/database.types';
import {
  AGENT_EFFORTS,
  AGENT_MODELS,
  useAdminFeedback,
  useDispatchFeedback,
  useIsAdmin,
  useUpdateFeedback,
  type AdminFeedback,
  type DispatchOptions,
} from '../features/feedback/useFeedback';

const STATUSES: FeedbackStatus[] = ['new', 'triaged', 'approved', 'dispatched', 'done', 'wontfix'];
const OPEN: FeedbackStatus[] = ['new', 'triaged', 'approved'];

/**
 * The admin inbox for feedback. Everything users send lands here first; an
 * admin triages it and, for what should be built, clicks "Send to AI agent",
 * which opens a pull request for review (see feedback-dispatch).
 */
export function AdminPage() {
  const isAdmin = useIsAdmin();
  const feedback = useAdminFeedback();
  const [filter, setFilter] = useState<'open' | 'all' | FeedbackStatus>('open');

  if (isAdmin.isLoading) return <div className="page-pad">Loading...</div>;
  if (!isAdmin.data) return <Navigate to="/" replace />;

  const rows = (feedback.data ?? []).filter((f) =>
    filter === 'all' ? true : filter === 'open' ? OPEN.includes(f.status) : f.status === filter,
  );

  return (
    <div className="page-pad admin-page">
      <div className="page-head">
        <h2>Feedback</h2>
        <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
          <option value="open">Open (new, triaged, approved)</option>
          <option value="all">All</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      {feedback.isLoading && <p className="muted">Loading...</p>}
      {feedback.error && <p className="error">{String(feedback.error)}</p>}
      {feedback.data && rows.length === 0 && <p className="muted">Nothing here.</p>}
      <div className="fb-list">
        {rows.map((f) => (
          <FeedbackCard key={f.id} item={f} />
        ))}
      </div>
    </div>
  );
}

function FeedbackCard({ item }: { item: AdminFeedback }) {
  const update = useUpdateFeedback();
  const dispatch = useDispatchFeedback();
  const [status, setStatus] = useState(item.status);
  const [category, setCategory] = useState(item.category ?? '');
  const [note, setNote] = useState(item.admin_note ?? '');
  const [model, setModel] = useState<DispatchOptions['model']>('opus');
  const [effort, setEffort] = useState<DispatchOptions['effort']>('high');
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    setMessage(null);
    try {
      await update.mutateAsync({
        id: item.id,
        patch: { status, category: category.trim() || null, admin_note: note.trim() || null },
      });
      setMessage('Saved');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
  }

  async function sendToAgent() {
    setMessage(null);
    try {
      await dispatch.mutateAsync({ id: item.id, model, effort, comment: note.trim() });
      setStatus('dispatched');
      setMessage('Sent. The agent opens a pull request in a few minutes.');
    } catch (e) {
      setMessage(`Dispatch failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return (
    <div className="fb-card">
      <div className="fb-meta">
        <b>#{item.id}</b>
        <span>{item.sender_email ?? item.user_id.slice(0, 8)}</span>
        <span className="muted">{new Date(item.created_at).toLocaleString()}</span>
        {item.page && <span className="muted">on {item.page}</span>}
        {item.dispatched_at && (
          <span className="muted">sent to agent {new Date(item.dispatched_at).toLocaleString()}</span>
        )}
      </div>
      <div className="fb-text">{item.text}</div>
      {item.screenshot_url && (
        <a href={item.screenshot_url} target="_blank" rel="noreferrer" className="fb-shot-link">
          <img src={item.screenshot_url} alt={`Screenshot for feedback ${item.id}`} />
        </a>
      )}
      {(item.viewport || item.user_agent) && (
        <div className="muted fb-device">
          {[item.viewport, item.user_agent].filter(Boolean).join(' | ')}
        </div>
      )}
      <textarea
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Admin note: scope or guidance for the agent (saved, and sent on dispatch)"
      />
      <div className="fb-controls">
        <select value={status} onChange={(e) => setStatus(e.target.value as FeedbackStatus)}>
          {STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="category" />
        <button className="toggle" onClick={save} disabled={update.isPending}>
          Save
        </button>
        <span className="fb-spacer" />
        <select
          value={model}
          onChange={(e) => setModel(e.target.value as DispatchOptions['model'])}
          title="Model the AI agent uses"
        >
          {AGENT_MODELS.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <select
          value={effort}
          onChange={(e) => setEffort(e.target.value as DispatchOptions['effort'])}
          title="Reasoning effort the AI agent uses"
        >
          {AGENT_EFFORTS.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <button
          onClick={sendToAgent}
          disabled={dispatch.isPending}
          title="The agent implements this on a branch and opens a pull request for your review. Nothing ships until you merge."
        >
          {dispatch.isPending ? 'Sending...' : 'Send to AI agent'}
        </button>
      </div>
      {message && <div className="muted">{message}</div>}
    </div>
  );
}
