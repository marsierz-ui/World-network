import { useMemo, useState } from 'react';
import { Map as MapGL, Marker, Popup } from 'react-map-gl/maplibre';
import { useContacts } from '../features/contacts/useContacts';
import { useSocialFeed } from '../features/social/useSocialFeed';
import type { SocialPost } from '../features/social/socialFeed';
import 'maplibre-gl/dist/maplibre-gl.css';

const BASEMAP = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

// Social posts surfaced as pop-ups on the map, anchored to each contact's location.
export function FeedPage() {
  const { data: contacts = [] } = useContacts();
  const { data: posts = [], isLoading, connectedCount } = useSocialFeed(contacts);
  const [openId, setOpenId] = useState<string | null>(null);

  const byContact = useMemo(() => {
    const m = new Map<string, SocialPost[]>();
    for (const p of posts) {
      const list = m.get(p.contactId);
      if (list) list.push(p);
      else m.set(p.contactId, [p]);
    }
    return m;
  }, [posts]);

  const pins = useMemo(
    () =>
      contacts.filter(
        (c) => (c.socials?.bluesky || c.socials?.mastodon) && c.current_lng != null && c.current_lat != null,
      ),
    [contacts],
  );
  const unplaced = contacts.filter(
    (c) => (c.socials?.bluesky || c.socials?.mastodon) && c.current_lng == null,
  ).length;

  const openContact = pins.find((c) => c.id === openId);

  return (
    <div className="map-page">
      <MapGL
        initialViewState={{ longitude: 10, latitude: 30, zoom: 1.4 }}
        mapStyle={BASEMAP}
        style={{ position: 'absolute', inset: 0 }}
      >
        {pins.map((c) => {
          const latest = byContact.get(c.id)?.[0];
          return (
            <Marker
              key={c.id}
              longitude={c.current_lng!}
              latitude={c.current_lat!}
              anchor="bottom"
              onClick={(e) => { e.originalEvent.stopPropagation(); setOpenId(c.id); }}
            >
              <div className="feed-bubble">
                <div className="fb-name">{c.full_name}</div>
                <div className={latest ? 'fb-snippet' : 'fb-snippet muted'}>
                  {latest ? latest.text.slice(0, 70) : 'no recent posts'}
                </div>
              </div>
            </Marker>
          );
        })}

        {openContact && (
          <Popup
            longitude={openContact.current_lng!}
            latitude={openContact.current_lat!}
            anchor="top"
            onClose={() => setOpenId(null)}
            closeOnClick={false}
            maxWidth="320px"
          >
            <div className="feed-popup">
              <strong>{openContact.full_name}</strong>
              {(byContact.get(openContact.id) ?? []).length === 0 && (
                <div className="muted">No recent posts.</div>
              )}
              {(byContact.get(openContact.id) ?? []).map((p) => (
                <a key={`${p.platform}:${p.id}`} className="feed-popup-post" href={p.url} target="_blank" rel="noreferrer">
                  <span className={`post-badge ${p.platform}`}>{p.platform === 'bluesky' ? 'BS' : 'MA'}</span>
                  <span className="fpp-text">{p.text}</span>
                </a>
              ))}
            </div>
          </Popup>
        )}
      </MapGL>

      <div className="map-overlay-left">
        <strong>Feed</strong>
        <div className="muted feed-stat">
          {connectedCount} connected · {pins.length} on map{unplaced > 0 && ` · ${unplaced} without location`}
        </div>
        {isLoading && connectedCount > 0 && <div className="muted">Loading posts...</div>}
        {connectedCount === 0 && (
          <div className="muted">
            Add a Bluesky or Mastodon handle to contacts (with a location) to see their posts pop up here.
          </div>
        )}
      </div>
    </div>
  );
}
