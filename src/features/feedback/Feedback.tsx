import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { APP_SLUG } from '../../lib/app';
import type { Feedback, FeedbackStatus } from '../../lib/database.types';

const STATUSES: FeedbackStatus[] = ['new', 'triaged', 'approved', 'dispatched', 'done', 'wontfix'];

// Sidebar entry: a note to whoever runs the app, with the page and device it
// was written on. The sender is filled in by the database, not by the client.
export function FeedbackButton() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const send = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('feedback').insert({
        app: APP_SLUG,
        text: text.trim(),
        page: pathname,
        user_agent: navigator.userAgent,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
      });
      if (error) throw error;
    },
    onSuccess: () => setText(''),
  });

  function close() {
    setOpen(false);
    send.reset();
  }

  return (
    <>
      <button className="theme-btn" onClick={() => setOpen(true)}>Feedback</button>
      {open && (
        <div className="picker-backdrop" onClick={close}>
          <div className="merge-modal invite-modal" onClick={(e) => e.stopPropagation()}>
            <strong>Send feedback</strong>
            {send.isSuccess ? (
              <>
                <p className="muted">Thank you. It has been passed on.</p>
                <div className="actions-row">
                  <button onClick={close}>Close</button>
                </div>
              </>
            ) : (
              <>
                <p className="muted">
                  Something broken, confusing or missing? The page you are on and your device
                  type are sent along.
                </p>
                <textarea
                  rows={6}
                  maxLength={5000}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  autoFocus
                />
                <div className="actions-row">
                  <button onClick={() => send.mutate()} disabled={!text.trim() || send.isPending}>
                    {send.isPending ? 'Sending...' : 'Send'}
                  </button>
                  <button className="link" onClick={close}>Cancel</button>
                </div>
                {send.isError && <div className="error">That did not go through. Try again.</div>}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// Admins only (RLS returns other people's rows to nobody else): feedback from
// every app in the project, newest first.
export function FeedbackInbox() {
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({
    queryKey: ['feedback'],
    queryFn: async (): Promise<Feedback[]> => {
      const { data, error } = await supabase
        .from('feedback')
        .select('id,app,sender_email,text,page,status,created_at')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as Feedback[];
    },
  });
  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: FeedbackStatus }) => {
      const { error } = await supabase.from('feedback').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feedback'] }),
  });

  if (rows.length === 0) return <div className="connection-card muted">No feedback yet.</div>;
  return (
    <div className="connection-card people-list">
      {rows.map((f) => (
        <div key={f.id} className="notice">
          <div className="muted">
            {f.app} · {f.page ?? '-'} · {f.sender_email ?? 'unknown'} ·{' '}
            {new Date(f.created_at).toLocaleDateString()}
          </div>
          <div className="notice-text">{f.text}</div>
          <select
            className="sort-select"
            value={f.status}
            onChange={(e) => setStatus.mutate({ id: f.id, status: e.target.value as FeedbackStatus })}
          >
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      ))}
    </div>
  );
}
