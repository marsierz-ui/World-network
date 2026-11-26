import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useContacts } from '../features/contacts/useContacts';
import { useProfile } from '../features/profile/useProfile';
import { useContactTagMap, useTags } from '../features/tags/useTags';
import { useMapData, type MapPoint } from '../features/map/useMapData';
import { useMapStore } from '../features/map/mapStore';
import { NetworkMap } from '../features/map/NetworkMap';
import { GlobeMap } from '../features/map/GlobeMap';
import { ChoroplethMap } from '../features/map/ChoroplethMap';
import { MapFilters } from '../features/map/MapFilters';
import { MapSearch } from '../features/map/MapSearch';
import { COUNTRY_BY_CODE } from '../lib/countries';
import { SocialLinks } from '../features/contacts/SocialLinks';
import type { Contact, Tag } from '../lib/database.types';
import { BallSetup } from '../features/countryball/BallSetup';
import { useLinkedLooks, useMyBallLook } from '../features/countryball/useBallLook';
import { CountryBall } from '../features/countryball/CountryBall';
import { ballCountry } from '../features/countryball/faces';

type MapKind = 'flat' | 'globe' | 'countries';

const KINDS: [MapKind, string, string][] = [
  ['flat', 'Flat', 'Dots per city or country'],
  ['globe', 'Globe', 'The same dots on a globe'],
  ['countries', 'Countries', 'Countries shaded by how many contacts they hold'],
];

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
  const [mapKind, setMapKind] = useState<MapKind>('flat');
  // The panel is tall enough to bury a phone screen, so start it collapsed there.
  const [panelOpen, setPanelOpen] = useState(() => window.innerWidth > 768);
  const [focus, setFocus] = useState<{ lng: number; lat: number; zoom: number } | null>(null);

  const activeFilters =
    (categories.size > 0 ? 1 : 0) + (countries.size > 0 ? 1 : 0) + (tagId ? 1 : 0);

  const homeCountry = profile?.home_country ?? null;
  const { data: looks } = useLinkedLooks();
  const { look: myLook, country: myCountry } = useMyBallLook();
  // The member's own ball: where they are now if they share it, else home.
  const me = useMemo(() => {
    if (!profile) return null;
    const lng = profile.location_enabled && profile.current_lng != null ? profile.current_lng : profile.home_lng;
    const lat = profile.location_enabled && profile.current_lat != null ? profile.current_lat : profile.home_lat;
    return lng != null && lat != null ? { lng, lat, country: myCountry, look: myLook } : null;
  }, [profile, myCountry, myLook]);

  const homeArea = useMemo(
    () => (homeCountry ? { country: homeCountry, lng: profile?.home_lng ?? null, lat: profile?.home_lat ?? null } : null),
    [homeCountry, profile?.home_lng, profile?.home_lat],
  );

  const contactsWithTags = useMemo(
    () => contacts.map((c) => ({ ...c, tag_ids: tagMap[c.id] ?? [] })),
    [contacts, tagMap],
  );

  const { points, countryPoints, byCountry, filtered, legend } = useMapData(
    contactsWithTags,
    homeCountry,
    tags,
  );

  // The choropleth is per country regardless of zoom, so the card and the
  // selection ring have to read from its own points, not the zoom-driven ones.
  const activePoints = mapKind === 'countries' ? countryPoints : points;

  const selected = useMemo(
    () =>
      selectedId
        ? activePoints.find((p) => p.contacts.some((c) => c.id === selectedId)) ?? null
        : null,
    [activePoints, selectedId],
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

  const placed = activePoints.reduce((n, p) => n + p.count, 0);
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
      {mapKind === 'flat' && (
        <NetworkMap
          key={`flat-${viewMode}-${homeCountry}`}
          points={points}
          initialView={initialView}
          focus={focus}
          selected={selected}
          onSelect={select}
          looks={looks}
          me={me}
          home={homeArea}
        />
      )}
      {mapKind === 'globe' && (
        <GlobeMap
          key={`globe-${viewMode}-${homeCountry}`}
          points={points}
          initialView={initialView}
          focus={focus}
          selected={selected}
          onSelect={select}
        />
      )}
      {mapKind === 'countries' && (
        <ChoroplethMap
          key={`countries-${viewMode}-${homeCountry}`}
          byCountry={byCountry}
          initialView={initialView}
          focus={focus}
          selected={selected}
          onSelect={select}
        />
      )}

      {panelOpen ? (
        <div className="map-overlay-left lg lg-thick">
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
            {KINDS.map(([kind, label, title]) => (
              <button
                key={kind}
                className={mapKind === kind ? 'seg active' : 'seg'}
                onClick={() => setMapKind(kind)}
                title={title}
              >
                {label}
              </button>
            ))}
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
          className="map-overlay-show lg lg-press"
          onClick={() => setPanelOpen(true)}
          aria-label="Show filters"
        >
          Search & filters
          {activeFilters > 0 && <span className="filter-count">{activeFilters}</span>}
        </button>
      )}

      {selected && (
        <PointCard point={selected} tags={tags} looks={looks} onClose={() => setSelectedId(null)} />
      )}
      <BallSetup />
    </div>
  );
}

function PointCard({
  point,
  tags,
  looks,
  onClose,
}: {
  point: MapPoint;
  tags: Tag[];
  looks?: Map<string, import('../features/countryball/look').BallLook>;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const tagName = (id: string) => tags.find((t) => t.id === id)?.name ?? id;
  const place = [point.city, COUNTRY_BY_CODE.get(point.country ?? '')?.name ?? point.country]
    .filter(Boolean)
    .join(', ');

  return (
    <aside className="point-card lg lg-thick">
      <div className="point-card-head">
        <strong>{place || 'Location'} · {point.count}</strong>
        <button className="x" onClick={onClose}>x</button>
      </div>
      <ul>
        {point.contacts.map((c) => (
          <li key={c.id}>
            <CountryBall country={ballCountry(c, point.country)} look={looks?.get(c.id)} size={26} />
            <span className={`dot ${c.category}`} title={c.category} />
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
