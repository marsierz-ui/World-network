import { useEffect, useMemo, useRef, useState } from 'react';
import { useContacts } from '../features/contacts/useContacts';
import { useAllLocationHistory } from '../features/mobility/useLocationHistory';
import {
  buildTracks,
  computeFrame,
  panelSeries,
  yearRange,
} from '../features/mobility/mobilityData';
import { MobilityMap } from '../features/mobility/MobilityMap';
import { MobilityChart } from '../features/mobility/MobilityChart';
import { COUNTRY_BY_CODE } from '../lib/countries';
import type { Contact, ContactCategory } from '../lib/database.types';

const THIS_YEAR = new Date().getFullYear();

export function MobilityPage() {
  const { data: contacts = [] } = useContacts();
  const { data: history = [] } = useAllLocationHistory();

  const [personId, setPersonId] = useState('');
  const [category, setCategory] = useState<'' | ContactCategory>('');
  const [year, setYear] = useState(THIS_YEAR);
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState<Contact | null>(null);

  const [minY, maxY] = useMemo(() => yearRange(history, THIS_YEAR), [history]);

  const tracks = useMemo(() => {
    const filtered = contacts.filter(
      (c) => (!personId || c.id === personId) && (!category || c.category === category),
    );
    return buildTracks(filtered, history);
  }, [contacts, history, personId, category]);

  const safeYear = Math.min(Math.max(year, minY), maxY);
  const frame = useMemo(() => computeFrame(tracks, safeYear), [tracks, safeYear]);
  const panel = useMemo(() => panelSeries(tracks, [minY, maxY]), [tracks, minY, maxY]);

  // Playback.
  const timer = useRef<number | null>(null);
  useEffect(() => {
    if (!playing) return;
    timer.current = window.setInterval(() => {
      setYear((y) => {
        if (y >= maxY) { setPlaying(false); return y; }
        return y + 1;
      });
    }, 700);
    return () => { if (timer.current) window.clearInterval(timer.current); };
  }, [playing, maxY]);

  const located = contacts.filter((c) => c.current_lng != null).length;

  return (
    <div className="map-page">
      <MobilityMap
        frame={frame}
        showLabels={!!personId}
        initialView={{ longitude: 10, latitude: 30, zoom: 1.4 }}
        onSelect={setSelected}
      />

      <div className="mobility-panel">
        <div className="mob-row">
          <select value={personId} onChange={(e) => setPersonId(e.target.value)}>
            <option value="">Whole network</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value as ContactCategory | '')}>
            <option value="">All</option>
            <option value="work">work</option>
            <option value="private">private</option>
            <option value="other">other</option>
          </select>
        </div>

        <div className="mob-slider">
          <button className="play" onClick={() => setPlaying((p) => !p)}>
            {playing ? '❚❚' : '►'}
          </button>
          <input
            type="range"
            min={minY}
            max={maxY}
            value={safeYear}
            onChange={(e) => { setPlaying(false); setYear(Number(e.target.value)); }}
          />
          <span className="mob-year">{safeYear}</span>
        </div>

        <MobilityChart data={panel} year={safeYear} />

        <div className="muted mob-stat">
          {frame.points.length} located here in {year} · {frame.arcs.length} moves · {located} total placed
        </div>
      </div>

      {selected && (
        <aside className="point-card">
          <div className="point-card-head">
            <strong>{selected.full_name}</strong>
            <button className="x" onClick={() => setSelected(null)}>x</button>
          </div>
          <div className="muted">
            {selected.current_city ?? '-'},{' '}
            {COUNTRY_BY_CODE.get(selected.current_country ?? '')?.name ?? selected.current_country ?? '-'}
          </div>
        </aside>
      )}
    </div>
  );
}
