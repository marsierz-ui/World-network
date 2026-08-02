import { useEffect, useMemo, useRef, useState } from 'react';

export interface ComboOption {
  value: string;
  label: string;
  hint?: string;
}

interface Props {
  options: ComboOption[];
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  emptyLabel?: string; // label for the "no selection" entry
}

function norm(s: string) {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

// Searchable single-select. A plain <select> with ~200 countries is unusable on
// a phone, where the native picker is a long unfiltered wheel.
export function ComboSelect({ options, value, onChange, placeholder, emptyLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = norm(query.trim());
    if (!q) return options.slice(0, 100);
    // Prefix matches first: typing "ge" should surface Germany before Algeria.
    const starts: ComboOption[] = [];
    const contains: ComboOption[] = [];
    for (const o of options) {
      const n = norm(o.label);
      if (n.startsWith(q)) starts.push(o);
      else if (n.includes(q) || norm(o.value).startsWith(q)) contains.push(o);
    }
    return [...starts, ...contains].slice(0, 100);
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    function onDocDown(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [open]);

  function pick(v: string) {
    onChange(v);
    setQuery('');
    setOpen(false);
  }

  return (
    <div className="combo-select" ref={boxRef}>
      {open ? (
        <input
          autoFocus
          className="combo-input"
          value={query}
          placeholder={placeholder ?? 'Type to search...'}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (filtered[0]) pick(filtered[0].value);
            } else if (e.key === 'Escape') {
              // Swallow it: Escape closes this dropdown, not the whole editor.
              e.preventDefault();
              setOpen(false);
              setQuery('');
            }
          }}
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
        />
      ) : (
        <button type="button" className="combo-trigger" onClick={() => setOpen(true)}>
          <span className={selected ? '' : 'muted'}>
            {selected?.label ?? emptyLabel ?? 'All'}
          </span>
          <span className="combo-caret" aria-hidden="true">
            v
          </span>
        </button>
      )}

      {open && (
        <div className="combo-menu">
          <button type="button" className="combo-opt" onMouseDown={() => pick('')}>
            {emptyLabel ?? 'All'}
          </button>
          {filtered.map((o) => (
            <button
              key={o.value}
              type="button"
              className={o.value === value ? 'combo-opt active' : 'combo-opt'}
              onMouseDown={() => pick(o.value)}
            >
              {o.label}
              {o.hint && <span className="combo-hint">{o.hint}</span>}
            </button>
          ))}
          {filtered.length === 0 && <div className="combo-empty muted">No match</div>}
        </div>
      )}
    </div>
  );
}
