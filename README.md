# World Network

Visualize your personal contact network on a world map. Maintain contacts with custom fields,
import from Google and CSV (incl. LinkedIn exports), tag communities, and switch between a
**cosmopolitan** (world) and **homelover** (home-country) view.

This is Phase 1 (map + contacts foundation). Mobility-over-time, stats/gamification, and the
social mode are planned for later phases.

## Stack

- React 19 + TypeScript + Vite
- MapLibre GL + deck.gl (free CARTO basemap, no token)
- Supabase (Postgres + PostGIS + Auth + Storage), RLS for per-user isolation
- TanStack Query + Zustand

## Prerequisites

- Node 20+ (built on 24)
- Docker (for the local Supabase stack)
- Supabase CLI: `npm i -g supabase` or see https://supabase.com/docs/guides/cli

## Setup

```bash
npm install
cp .env.example .env.local

# Start the local Supabase stack (Postgres, Auth, Studio). Prints the anon key + URLs.
supabase start

# Apply the schema
supabase db reset            # runs supabase/migrations/0001_init.sql
```

Put the URL and anon key printed by `supabase start` into `.env.local`:

```
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=<anon key from `supabase start`>
```

### Google sign-in + Contacts import (optional)

1. Create an OAuth client in Google Cloud Console (Web), scope
   `https://www.googleapis.com/auth/contacts.readonly`.
2. Authorized redirect URI: `http://localhost:54321/auth/v1/callback`.
3. Export before `supabase start`:
   ```bash
   export GOOGLE_CLIENT_ID=...
   export GOOGLE_SECRET=...
   ```

Without this, email/password auth and CSV import still work.

### City geocoding

The repo ships with ~75 curated cities so geocoding works with no setup. For full coverage
(recommended before testing with real contacts):

```bash
node scripts/build-cities.mjs              # cities15000: ~34k cities (~1.2MB), default
node scripts/build-cities.mjs cities500    # ~200k places (every town >500 people)
```

This downloads from GeoNames into `public/cities.min.json` (gitignored), which the geocoder loads
at startup. Coordinates are stored permanently in Postgres, so the map is instant and offline.

Anything the dataset misses can be placed precisely with the in-app **location picker**
(search a city or click the map) on each contact.

#### Why not the Google Maps geocoding API

It's a poor fit here despite being precise: Google's terms cap caching of geocoded coordinates at
**30 days** (we store them permanently) and require results to be **displayed on Google Maps only**
(we use free MapLibre + deck.gl). Contact data is also city-level, so street precision is wasted -
the real need is town coverage, which free GeoNames solves with no cost, limits, or ToS issues.

## Run

```bash
npm run dev          # http://localhost:5173
npm run build        # production build
npx tsc -b --noEmit  # typecheck
```

## What works in Phase 1

- Email/password + Google OAuth sign-in
- Contacts CRUD with user-defined custom fields (e.g. "inside jokes")
- World map: contact pins, city clustering, click for details, hover readout
- Cosmopolitan vs homelover view toggle (recenters on home country)
- Filters: category, country, tag/community
- Tags/communities with assignment per contact
- Import: Google Contacts (People API), generic CSV, LinkedIn Connections.csv (auto-detected)
- Per-contact location picker (search or click the map) for precise / missing locations
- "Unplaced" filter on the contacts page to quickly find and fix contacts without coordinates

## Known limits (by design)

- **LinkedIn** has no API for connections/location — only the CSV export, which carries company and
  position but **no location**. Those contacts appear on the map once you add a city.
- **Social posts / "social mode"** depend on locked-down APIs and are deferred to a later phase.

## Project layout

```
supabase/migrations/0001_init.sql   schema + PostGIS + RLS
src/lib/                            supabase client, geocode, countries, cities, types
src/features/auth/                  AuthProvider, LoginPage
src/features/profile/               profile query/mutation
src/features/contacts/              hooks, ContactForm, CustomFieldsManager
src/features/tags/                  tag hooks, TagAssigner
src/features/map/                   NetworkMap (deck.gl), filters, store, data shaping
src/features/import/                CSV parse, Google People API, bulk import
src/pages/                          Map, Contacts, Import, Settings
scripts/build-cities.mjs            generate full geocoding dataset
```
