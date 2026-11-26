import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { APP_SLUG } from '../../lib/app';
import type { Feedback, FeedbackStatus } from '../../lib/database.types';
import { captureFullPage, FEEDBACK_UI_ATTR, type Shot } from './captureScreenshot';

const STATUSES: FeedbackStatus[] = ['new', 'triaged', 'approved', 'dispatched', 'done', 'wontfix'];
const BUCKET = 'feedback';
const uiAttr = { [FEEDBACK_UI_ATTR]: '' };

type Phase = 'idle' | 'capturing' | 'editing';

// Sidebar entry: a note to whoever runs the app, with the page and device it
// was written on, and a picture of the whole page. The sender is filled in by
// the database, not by the client.
//
// The page is captured first and the dialog opens after, so the picture never
// has the dialog in it. Everything this button shows is portalled to <body>:
// the sidebar carries view-transition-name, which makes it a stacking context,
// and a dialog left inside it is painted under <main> however high its z-index
// (the list rows and their badges showed through the dialog).
export function FeedbackButton() {
  const { pathname } = useLocation();
  const [phase, setPhase] = useState<Phase>('idle');
  const [text, setText] = useState('');
  const [shot, setShot] = useState<(Shot & { url: string }) | null>(null);
  const [shotError, setShotError] = useState(false);
  const [includeShot, setIncludeShot] = useState(true);

  function replaceShot(next: Shot | null) {
    setShot((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return next ? { ...next, url: URL.createObjectURL(next.blob) } : null;
    });
  }

  async function capture() {
    setPhase('capturing');
    // Two frames: one for React to drop the dialog, one for the browser to
    // paint the page without it.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    try {
      replaceShot(await captureFullPage());
      setShotError(false);
    } catch {
      replaceShot(null);
      setShotError(true);
    }
    setPhase('editing');
  }

  const send = useMutation({
    mutationFn: async () => {
      let screenshotPath: string | null = null;
      if (includeShot && shot) {
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) throw new Error('Not signed in');
        // The bucket policy only accepts uploads under the sender's own folder.
        const path = `${u.user.id}/${crypto.randomUUID()}.jpg`;
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(path, shot.blob, { contentType: 'image/jpeg', upsert: false });
        if (error) throw error;
        screenshotPath = path;
      }
      const { error } = await supabase.from('feedback').insert({
        app: APP_SLUG,
        text: text.trim(),
        page: pathname,
        screenshot_path: screenshotPath,
        user_agent: navigator.userAgent,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
      });
      if (error) throw error;
    },
    onSuccess: () => setText(''),
  });

  function open() {
    send.reset();
    setIncludeShot(true);
    void capture();
  }

  function close() {
    setPhase('idle');
    send.reset();
    replaceShot(null);
  }

  useEffect(() => {
    if (phase !== 'editing') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // close only touches state setters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  return (
    <>
      <button className="theme-btn" onClick={open} disabled={phase === 'capturing'} {...uiAttr}>
        Feedback
      </button>
      {phase === 'capturing' &&
        createPortal(
          <div className="fbk-toast" role="status" {...uiAttr}>
            Taking a picture of the page...
          </div>,
          document.body,
        )}
      {phase === 'editing' &&
        createPortal(
          <div className="picker-backdrop" onClick={close} {...uiAttr}>
            <div
              className="merge-modal invite-modal fbk-box"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-label="Send feedback"
            >
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
                    type are sent along{includeShot && shot ? ', with the picture below' : ''}.
                  </p>
                  {shot && (
                    <>
                      <a
                        className="fbk-shot"
                        href={shot.url}
                        target="_blank"
                        rel="noreferrer"
                        title="Open the full picture"
                      >
                        <img src={shot.url} alt="Screenshot of the whole page" />
                      </a>
                      <div className="fbk-row">
                        <label className="fbk-chk">
                          <input
                            type="checkbox"
                            checked={includeShot}
                            onChange={(e) => setIncludeShot(e.target.checked)}
                          />
                          Include a screenshot of the whole page
                        </label>
                        <button className="link" onClick={() => void capture()}>
                          Retake
                        </button>
                      </div>
                      {shot.cropped && (
                        <p className="muted fbk-note">The page is very long; the picture stops partway down.</p>
                      )}
                      {includeShot && (
                        <p className="muted fbk-note">
                          The picture can show names from your contacts. Untick it if that matters.
                        </p>
                      )}
                    </>
                  )}
                  {shotError && (
                    <p className="muted fbk-note">
                      The screenshot did not work on this page; you can still send a note.{' '}
                      <button className="link" onClick={() => void capture()}>
                        Try again
                      </button>
                    </p>
                  )}
                  <textarea
                    rows={5}
                    maxLength={5000}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    autoFocus
                  />
                  <div className="actions-row">
                    <button onClick={() => send.mutate()} disabled={!text.trim() || send.isPending}>
                      {send.isPending ? 'Sending...' : 'Send'}
                    </button>
                    <button className="link" onClick={close}>
                      Cancel
                    </button>
                  </div>
                  {send.isError && <div className="error">That did not go through. Try again.</div>}
                </>
              )}
            </div>
          </div>,
          document.body,
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
        .select('id,app,sender_email,text,page,screenshot_path,status,created_at')
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
          {f.screenshot_path && <ScreenshotLink path={f.screenshot_path} />}
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

// Screenshots sit in a private bucket; an admin reads them through a link that
// stops working after an hour.
function ScreenshotLink({ path }: { path: string }) {
  const { data: url } = useQuery({
    queryKey: ['feedback-shot', path],
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
      if (error) throw error;
      return data.signedUrl;
    },
    staleTime: 50 * 60 * 1000,
  });
  if (!url) return null;
  return (
    <a className="fbk-shot fbk-shot-admin" href={url} target="_blank" rel="noreferrer" title="Open the full picture">
      <img src={url} alt="Screenshot sent with this feedback" loading="lazy" />
    </a>
  );
}
