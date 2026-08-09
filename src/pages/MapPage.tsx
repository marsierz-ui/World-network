import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useContacts } from '../features/contacts/useContacts';
import { useProfile } from '../features/profile/useProfile';
import { useContactTagMap, useTags } from '../features/tags/useTags';
import { useMapData, type MapPoint } from '../features/map/useMapData';
import { useMapStore } from '../features/map/mapStore';
import { NetworkMap } from '../features/map/NetworkMap';
import { GlobeMap } from '../features/map/GlobeMap';
import { MapFilters } from '../features/map/MapFilters';
import { MapSearch } from '../features/map/MapSearch';
import { COUNTRY_BY_CODE } from '../lib/countries';
import { SocialLinks } from '../features/contacts/SocialLinks';
import type { Contact, Tag } from '../lib/database.types';

export function MapPage() {
  const { data: contacts = [] } = useContacts();
  const { data: profile } = useProfile();
  const { data: tags = [] } = useTags();
  const { data: tagMap = {} } = useContactTagMap();
  const viewMode = useMapStore((s) => s.viewMode);
  const locationBasis = useMapStore((s) => s.locationBasis);
  const categories = useMapStore((s) => s.categories);
  const countries = useMapStore((s) => s.countries);
  const tagId = useMapStore((s) => s.tagId);
  // A contact id rather than the point: zooming past the country/city threshold
  // rebuilds every point, and a held object would leave the card pointing at a
  // stack that no longer exists.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapKind, setMapKind] = useState<'flat' | 'globe'>('flat');
  // The panel is tall enough to bury a phone screen, so start it collapsed there.
  const [panelOpen, setPanelOpen] = useState(() => window.innerWidth > 768);
  const [focus, setFocus] = useState<{ lng: number; lat: number; zoom: number } | null>(null);

  const activeFilters =
    (categories.size > 0 ? 1 : 0) + (countries.size > 0 ? 1 : 0) + (tagId ? 1 : 0);

  const homeCountry = profile?.home_country ?? null;

  const contactsWithTags = useMemo(
    () => contacts.map((c) => ({ ...c, tag_ids: tagMap[c.id] ?? [] })),
    [contacts, tagMap],
  );

  const { points, filtered, legend } = useMapData(contactsWithTags, homeCountry, tags);

  const selected = useMemo(
    () =>
      selectedId ? points.find((p) => p.contacts.some((c) => c.id === selectedId)) ?? null : null,
    [points, selectedId],
  );

  // Stable: it is a dependency of the deck.gl layer list, which would otherwise
  // be rebuilt on every render of this page.
  const select = useCallback((p: MapPoint | null) => setSelectedId(p?.contacts[0].id ?? null), []);

  const countriesPresent = useMemo(
    () =>
      new Set(
        contacts
          .map((c) => (locationBasis === 'origin' ? c.origin_country : c.current_country))
          .filter(Boolean) as string[],
      ),
    [contacts, locationBasis],
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

  // Jump to whatever the user picked in search and open its card. The target is
  // the contact's own coordinate, not the dot's: while zoomed out that dot sits
  // on a country centroid, and zoom 8 there lands nowhere near the person.
  function goToContact(c: Contact) {
    const anchored = filtered.find((x) => x.id === c.id);
    if (!anchored) return;
    setSelectedId(c.id);
    setFocus({ lng: anchored.current_lng!, lat: anchored.current_lat!, zoom: 8 });
  }

  return (
    <div className="map-page">
      {mapKind === 'flat' ? (
        <NetworkMap
          key={`flat-${viewMode}-${homeCountry}`}
          points={points}
          initialView={initialView}
          focus={focus}
          selected={selected}
          onSelect={select}
        />
      ) : (
        <GlobeMap
          key={`globe-${viewMode}-${homeCountry}`}
          points={points}
          initialView={initialView}
          focus={focus}
          selected={selected}
          onSelect={select}
        />
      )}

      {panelOpen ? (
        <div className="map-overlay-left">
          <div className="overlay-head">
            <strong>Map</strong>
            <button
              className="overlay-collapse"
              onClick={() => setPanelOpen(false)}
              aria-label="Hide filters"
              title="Hide filters"
            >
              x
            </button>
          </div>
          <MapSearch contacts={contactsWithTags} tags={tags} onPick={goToContact} />
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
          {legend.length > 0 && (
            <div className="map-legend">
              <div className="section-label">Sublabels</div>
              {legend.map((t) => (
                <div key={t.id} className="legend-row">
                  <span className="legend-swatch" style={{ background: t.color }} />
                  {t.name}
                </div>
              ))}
            </div>
          )}
          <div className="map-stat">
            {placed} placed
            {unplaced > 0 && (
              <> · <Link to="/contacts?unplaced=1">{unplaced} without location</Link></>
            )}
          </div>
        </div>
      ) : (
        <button
          className="map-overlay-show"
          onClick={() => setPanelOpen(true)}
          aria-label="Show filters"
        >
          Search & filters
          {activeFilters > 0 && <span className="filter-count">{activeFilters}</span>}
        </button>
      )}

      {selected && (
        <PointCard point={selected} tags={tags} onClose={() => setSelectedId(null)} />
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
  tags: Tag[];
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const tagName = (id: string) => tags.find((t) => t.id === id)?.name ?? id;
  const place = [point.city, COUNTRY_BY_CODE.get(point.country ?? '')?.name ?? point.country]
    .filter(Boolean)
    .join(', ');

  return (
    <aside className="point-card">
      <div className="point-card-head">
        <strong>{place || 'Location'} · {point.count}</strong>
        <button className="x" onClick={onClose}>x</button>
      </div>
      <ul>
        {point.contacts.map((c) => (
          <li key={c.id}>
            <span className={`dot ${c.category}`} />
            <span className="pc-name">{c.full_name}</span>
            {(c as Contact & { tag_ids?: string[] }).tag_ids?.map((id) => (
              <span key={id} className="mini-tag">{tagName(id)}</span>
            ))}
            <SocialLinks socials={c.socials} />
            <button
              className="link pc-open"
              onClick={() => navigate(`/contacts?id=${c.id}`)}
              title="Open this contact"
            >
              view
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
