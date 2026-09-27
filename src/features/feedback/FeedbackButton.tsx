import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { captureArea, FEEDBACK_UI_ATTR, type Rect } from './captureScreenshot';
import { useSubmitFeedback } from './useFeedback';

type Phase = 'idle' | 'selecting' | 'capturing' | 'editing';

const uiAttr = { [FEEDBACK_UI_ATTR]: '' };

/**
 * The same flow as attention-tracker's Feedback button: select an area of the
 * live screen first (so the screenshot is big and has no dialog in it), then
 * write the note. The item lands in the admin inbox (/admin), and from there an
 * admin hands it to the AI agent.
 */
export function FeedbackButton() {
  const location = useLocation();
  const submit = useSubmitFeedback();
  const [phase, setPhase] = useState<Phase>('idle');
  // The object URL lives next to the blob so the preview needs no effect.
  const [shot, setShot] = useState<{ blob: Blob; url: string } | null>(null);
  const [includeShot, setIncludeShot] = useState(true);
  const [text, setText] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  function replaceShot(blob: Blob | null) {
    if (shot) URL.revokeObjectURL(shot.url);
    setShot(blob ? { blob, url: URL.createObjectURL(blob) } : null);
  }

  function open() {
    setText('');
    setStatus(null);
    replaceShot(null);
    setIncludeShot(true);
    submit.reset();
    setPhase('selecting');
  }

  async function capture(rect: Rect | null) {
    setPhase('capturing');
    // Two frames: one for React to drop the selection overlay, one for the
    // browser to paint without it.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    try {
      replaceShot(await captureArea(rect));
      setStatus(null);
    } catch {
      replaceShot(null);
      setStatus('Screenshot unavailable; you can still send a note.');
    }
    setPhase('editing');
  }

  async function send() {
    const body = text.trim();
    if (!body) {
      setStatus('Write something first.');
      return;
    }
    setStatus('Sending...');
    try {
      await submit.mutateAsync({
        text: body,
        screenshot: includeShot && shot ? shot.blob : null,
        page: location.pathname,
      });
      setStatus('Thanks! Feedback sent.');
      setTimeout(() => setPhase('idle'), 900);
    } catch (e) {
      setStatus(`Failed to send: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return (
    <>
      <button className="feedback-btn" onClick={open} title="Send feedback with a screenshot" {...uiAttr}>
        Feedback
      </button>
      {phase === 'selecting' &&
        createPortal(
          <SelectionOverlay onDone={capture} onCancel={() => setPhase('idle')} />,
          document.body,
        )}
      {phase === 'capturing' &&
        createPortal(
          <div className="fb-toast" {...uiAttr}>
            Capturing...
          </div>,
          document.body,
        )}
      {phase === 'editing' &&
        createPortal(
          <div className="picker-backdrop" {...uiAttr} onClick={() => setPhase('idle')}>
            <div className="fb-box" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Send feedback">
              <h3>Send feedback</h3>
              {shot && (
                <div className="fb-shot-wrap">
                  <img src={shot.url} alt="Selected area of the screen" />
                </div>
              )}
              <div className="fb-row">
                <button className="toggle" onClick={() => setPhase('selecting')}>
                  {shot ? 'Retake area' : 'Select area'}
                </button>
                {shot && (
                  <label className="fb-chk">
                    <input
                      type="checkbox"
                      checked={includeShot}
                      onChange={(e) => setIncludeShot(e.target.checked)}
                    />
                    Include screenshot
                  </label>
                )}
              </div>
              <textarea
                rows={5}
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={5000}
                placeholder="What's on your mind? A bug, an idea, anything."
                autoFocus
              />
              <p className="muted fb-privacy">
                Your note{includeShot && shot ? ' and screenshot' : ''} go to the app&apos;s admin and
                may be passed to an AI assistant that proposes a fix. The screenshot can show
                contact names; untick it if that matters.
              </p>
              <div className="fb-actions">
                <button className="toggle" onClick={() => setPhase('idle')}>
                  Cancel
                </button>
                <button onClick={send} disabled={submit.isPending}>
                  Send
                </button>
              </div>
              {status && <div className="muted">{status}</div>}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function SelectionOverlay({
  onDone,
  onCancel,
}: {
  onDone: (rect: Rect | null) => void;
  onCancel: () => void;
}) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  function toRect(e: React.PointerEvent): Rect {
    const s = start.current!;
    return {
      x: Math.min(s.x, e.clientX),
      y: Math.min(s.y, e.clientY),
      w: Math.abs(e.clientX - s.x),
      h: Math.abs(e.clientY - s.y),
    };
  }

  return (
    <div
      className="fb-select-overlay"
      {...uiAttr}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = { x: e.clientX, y: e.clientY };
        setRect(null);
      }}
      onPointerMove={(e) => {
        if (start.current) setRect(toRect(e));
      }}
      onPointerUp={(e) => {
        const r = start.current ? toRect(e) : null;
        start.current = null;
        onDone(r);
      }}
    >
      <div className="fb-sel-hint">
        Drag over the part your feedback is about &middot; tap for the whole screen &middot; Esc
        to cancel
      </div>
      {rect && (
        <div
          className="fb-sel-rect"
          style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
        />
      )}
    </div>
  );
}
