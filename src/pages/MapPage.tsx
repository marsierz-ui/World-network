import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useContacts } from '../features/contacts/useContacts';
import { useProfile } from '../features/profile/useProfile';
import { useContactTagMap, useTags } from '../features/tags/useTags';
import { useMapData, type MapPoint } from '../features/map/useMapData';
import { useMapStore } from '../features/map/mapStore';
import { NetworkMap } from '../features/map/NetworkMap';
import { GlobeMap } from '../features/map/GlobeMap';
import { MapFilters } from '../features/map/MapFilters';
import { COUNTRY_BY_CODE } from '../lib/countries';
import { SocialLinks } from '../features/contacts/SocialLinks';
import type { Contact } from '../lib/database.types';

export function MapPage() {
  const { data: contacts = [] } = useContacts();
  const { data: profile } = useProfile();
  const { data: tags = [] } = useTags();
  const { data: tagMap = {} } = useContactTagMap();
  const viewMode = useMapStore((s) => s.viewMode);
  const [selected, setSelected] = useState<MapPoint | null>(null);
  const [mapKind, setMapKind] = useState<'flat' | 'globe'>('flat');

  const homeCountry = profile?.home_country ?? null;

  const contactsWithTags = useMemo(
    () => contacts.map((c) => ({ ...c, tag_ids: tagMap[c.id] ?? [] })),
    [contacts, tagMap],
  );

  const { points, filtered } = useMapData(contactsWithTags, homeCountry);

  const countriesPresent = useMemo(
    () => new Set(contacts.map((c) => c.current_country).filter(Boolean) as string[]),
    [contacts],
  );

  const initialView = useMemo(() => {
    if (viewMode === 'homelover' && homeCountry) {
      const c = COUNTRY_BY_CODE.get(homeCountry);
      if (c) return { longitude: c.lng, latitude: c.lat, zoom: 4 };
    }
    return { longitude: 10, latitude: 25, zoom: 1.4 };
  }, [viewMode, homeCountry]);

  const placed = points.reduce((n, p) => n + p.count, 0);
  const unplaced = contacts.length - placed;

  return (
    <div className="map-page">
      {mapKind === 'flat' ? (
        <NetworkMap
          key={`flat-${viewMode}-${homeCountry}`}
          points={points}
          initialView={initialView}
          onSelect={setSelected}
        />
      ) : (
        <GlobeMap
          key={`globe-${viewMode}-${homeCountry}`}
          contacts={filtered}
          initialView={initialView}
          onSelect={setSelected}
        />
      )}

      <div className="map-overlay-left">
        <div className="view-toggle kind-toggle">
          <button
            className={mapKind === 'flat' ? 'seg active' : 'seg'}
            onClick={() => setMapKind('flat')}
          >
            Flat
          </button>
          <button
            className={mapKind === 'globe' ? 'seg active' : 'seg'}
            onClick={() => setMapKind('globe')}
          >
            Globe
          </button>
        </div>
        <MapFilters tags={tags} countriesPresent={countriesPresent} />
        <div className="map-stat">
          {placed} placed
          {unplaced > 0 && (
            <> · <Link to="/contacts?unplaced=1">{unplaced} without location</Link></>
          )}
        </div>
      </div>

      {selected && (
        <PointCard point={selected} tags={tags} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function PointCard({
  point,
  tags,
  onClose,
}: {
  point: MapPoint;
  tags: { id: string; name: string }[];
  onClose: () => void;
}) {
  const tagName = (id: string) => tags.find((t) => t.id === id)?.name ?? id;
  return (
    <aside className="point-card">
      <div className="point-card-head">
        <strong>
          {point.contacts[0].current_city ?? 'Location'} · {point.count}
        </strong>
        <button className="x" onClick={onClose}>x</button>
      </div>
      <ul>
        {point.contacts.map((c) => (
          <li key={c.id}>
            <span className={`dot ${c.category}`} />
            {c.full_name}
            {(c as Contact & { tag_ids?: string[] }).tag_ids?.map((id) => (
              <span key={id} className="mini-tag">{tagName(id)}</span>
            ))}
            <SocialLinks socials={c.socials} />
          </li>
        ))}
      </ul>
    </aside>
  );
}
