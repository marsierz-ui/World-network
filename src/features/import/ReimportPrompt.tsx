import { useState } from 'react';
import type { ImportItem } from './parseCsv';

/**
 * Deleting a contact here does not delete it in Google, so the next sync would
 * hand it straight back. Rather than guessing, every such contact is listed for
 * an explicit yes or no. Nothing is remembered: the same contact is asked about
 * again on the next sync, which is the only honest behaviour when the answer
 * lives in Google and can change there at any time.
 */
export function ReimportPrompt({
  deleted,
  onConfirm,
  onCancel,
}: {
  deleted: ImportItem[];
  onConfirm: (approved: ImportItem[]) => void;
  onCancel: () => void;
}) {
  const [approved, setApproved] = useState<Set<ImportItem>>(new Set());

  function toggle(item: ImportItem) {
    setApproved((s) => {
      const next = new Set(s);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  }

  return (
    <div className="picker-backdrop" onClick={onCancel}>
      <div className="picker reimport" onClick={(e) => e.stopPropagation()}>
        <div className="picker-head">
          <strong>Bring back deleted contacts?</strong>
          <span className="muted">
            {deleted.length} {deleted.length === 1 ? 'contact' : 'contacts'} in Google were deleted
            here before. Tick the ones to import again.
          </span>
        </div>

        <div className="reimport-list">
          {deleted.map((item, i) => (
            <label key={i} className="reimport-row">
              <input
                type="checkbox"
                checked={approved.has(item)}
                onChange={() => toggle(item)}
              />
              <span>
                <strong>{item.input.full_name}</strong>
                {item.input.primary_email && <em> {item.input.primary_email}</em>}
                {item.input.current_city && <em> {item.input.current_city}</em>}
              </span>
            </label>
          ))}
        </div>

        <div className="picker-foot">
          <button className="link" onClick={() => setApproved(new Set(deleted))}>
            Select all
          </button>
          <div className="actions-row">
            <button className="link" onClick={onCancel}>
              Cancel sync
            </button>
            <button onClick={() => onConfirm([...approved])}>
              {approved.size === 0
                ? 'Skip all and continue'
                : `Import ${approved.size} and continue`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
