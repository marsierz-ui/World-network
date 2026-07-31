import { useMemo, useRef, useState } from 'react';

interface Props {
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  allowCustom?: boolean; // allow adding a typed value not in options
}

// Searchable multi-select with chips. Dependency-free.
export function SearchSelect({ options, value, onChange, placeholder, allowCustom }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return options
      .filter((o) => !value.includes(o) && (!q || o.toLowerCase().includes(q)))
      .slice(0, 50);
  }, [options, value, query]);

  function add(item: string) {
    if (!item) return;
    if (!value.includes(item)) onChange([...value, item]);
    setQuery('');
  }
  function remove(item: string) {
    onChange(value.filter((v) => v !== item));
  }

  const canCustom = allowCustom && query.trim() && !options.some((o) => o.toLowerCase() === query.toLowerCase().trim());

  return (
    <div className="search-select" ref={boxRef}>
      <div className="ss-chips">
        {value.map((v) => (
          <span key={v} className="chip">
            {v}
            <button type="button" className="x" onClick={() => remove(v)}>x</button>
          </span>
        ))}
        <input
          value={query}
          placeholder={value.length ? '' : (placeholder ?? 'Search...')}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (filtered[0]) add(filtered[0]);
              else if (canCustom) add(query.trim());
            }
          }}
        />
      </div>
      {open && (filtered.length > 0 || canCustom) && (
        <div className="ss-menu">
          {canCustom && (
            <button type="button" className="ss-opt custom" onMouseDown={() => add(query.trim())}>
              Add "{query.trim()}"
            </button>
          )}
          {filtered.map((o) => (
            <button key={o} type="button" className="ss-opt" onMouseDown={() => add(o)}>
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
