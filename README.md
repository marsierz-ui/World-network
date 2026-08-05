# World Network

Visualize your personal contact network on a world map. Maintain contacts with custom fields,
import from Google and CSV (incl. LinkedIn exports), tag communities, and switch between a
**cosmopolitan** (world) and **homelover** (home-country) view.

**Live: https://marsierz-ui.github.io/World-network/** - always on, installable on a phone
(Share -> Add to Home Screen on iOS, Install app on Android).

This is Phase 1 (map + contacts foundation). Mobility-over-time, stats/gamification, and the
social mode are planned for later phases.

## Stack

- React 19 + TypeScript + Vite
- MapLibre GL + deck.gl (free CARTO basemap, no token)
- Supabase (Postgres + PostGIS + Auth + Storage), RLS for per-user isolation
- TanStack Query + Zustand

## Prerequisites

- Node 20+ (built on 24)

## Setup

The app runs against a hosted Supabase project (`dioviawozcypzzowgoyk`, eu-west-3); no Docker
or local stack is needed.

```bash
npm install
```

`.env.local` already holds the project URL and anon key. The anon key is public by design -
every table is protected by row-level security keyed on `auth.uid()`, so a signed-out key can
read nothing.

If you ever point at a different project, copy `.env.example` to `.env.local`, fill in the two
`VITE_` values from Project Settings -> API, and apply `supabase/migrations/*.sql` in order.

### Google sign-in + Contacts sync (optional)

1. Create an OAuth client in Google Cloud Console (Web), scope
   `https://www.googleapis.com/auth/contacts` (read/write - `contacts.readonly` imports fine but
   cannot push edits back).
2. Authorized redirect URI: `http://localhost:54321/auth/v1/callback`.
3. Export before `supabase start`:
   ```bash
   export GOOGLE_CLIENT_ID=...
   export GOOGLE_SECRET=...
   ```

Without this, email/password auth and CSV import still work.

#### Two-way sync

Import stores each Google contact's `resourceName` in `contacts.external_ids.google`. While the
sync switch on the Settings page is on:

- adding a contact creates it in Google (`people.createContact`) and stores the returned link
- editing a linked contact PATCHes it (`people.updateContact`)
- deleting a contact here never touches Google

`contacts.details` (migration 0008) holds everything the Google Contacts editor can hold that has
no column of its own: structured name parts, nickname, file-as, birthday, organizations, and the
repeatable labelled lists (emails, phones, postal addresses, websites, chats, related people,
significant dates, custom fields). `src/features/import/googlePerson.ts` is the single place that
maps it to and from a People API `Person`. `primary_email` and `phone` stay as columns because
dedupe, search and the map read them; they are derived from the first list entry on every save.

Guardrails:

- Only fields holding a value are pushed. Clearing a field here does not clear it in Google, and
  contacts that predate `details` (almost every key missing) cannot wipe the Google copy.
- The person is re-read before each write, both for the etag `updateContact` requires and to skip
  fields that already match, so a save that changed nothing sends no request.
- Deleting here does not delete in Google, so the contact comes back on the next pull. Every such
  contact is listed in a prompt for an explicit yes or no first. Nothing is remembered - you are
  asked again next sync, because the answer lives in Google and can change there.
- Contacts imported before the link existed get adopted on the next sync.

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
- Two-way Google sync: contacts added or edited here are created/updated in Google; the contact
  editor carries Google's full field set (see below)
- Per-contact location picker (search or click the map) for precise / missing locations
- "Unplaced" filter on the contacts page to quickly find and fix contacts without coordinates
- History: durable log of every contact added or removed, grouped by day, filterable by
  action and searchable by name / email / place

## Deployment

Pushing to `main` builds and publishes to GitHub Pages via `.github/workflows/deploy.yml`.
The site is served from `/World-network/`, so `vite.config.ts` sets that as the production
`base` while dev stays on `/`; runtime paths use `import.meta.env.BASE_URL`.

Two details worth knowing before changing the pipeline:

- **`npm install`, not `npm ci`.** The committed lockfile is generated on Windows and pins
  `@emnapi` at versions that do not satisfy the Linux wasm fallback rolldown resolves to, which
  makes `npm ci` refuse to install. Regenerating the lockfile on Linux would let `npm ci` return.
- **Deep links 404 by status.** GitHub Pages has no SPA rewrite, so the workflow copies
  `index.html` to `404.html`. Refreshing `/history` serves the app shell and React Router
  renders the right page; the HTTP status is still 404. Harmless, but it shows in logs.

`.github/workflows/keepalive.yml` pings the database every 3 days, because free-tier Supabase
projects pause after ~7 days of inactivity and a paused project takes the app down. Note that
GitHub disables scheduled workflows in a repo with no activity for 60 days.

## Known limits (by design)

- **LinkedIn** has no API for connections/location — only the CSV export, which carries company and
  position but **no location**. Those contacts appear on the map once you add a city.
- **Social posts / "social mode"** depend on locked-down APIs and are deferred to a later phase.

## Project layout

```
.github/workflows/                  Pages deploy + Supabase keepalive
supabase/migrations/                schema + PostGIS + RLS, applied in order
src/lib/                            supabase client, geocode, countries, cities, types
src/features/auth/                  AuthProvider, LoginPage
src/features/profile/               profile query/mutation
src/features/contacts/              hooks, ContactForm, CustomFieldsManager
src/features/tags/                  tag hooks, TagAssigner
src/features/map/                   NetworkMap (deck.gl), filters, store, data shaping
src/features/contacts/useContactHistory.ts  reads contact_events
src/features/import/                CSV parse, Google People API, bulk import
src/pages/                          Map, Contacts, Import, Settings
scripts/build-cities.mjs            generate full geocoding dataset
```
