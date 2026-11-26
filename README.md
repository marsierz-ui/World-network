# World Network

Visualize your personal contact network on a world map. Maintain contacts with custom fields,
import from Google and CSV (incl. LinkedIn exports), tag communities, and switch between a
**cosmopolitan** (world) and **homelover** (home-country) view.

**Live: https://marsierz-ui.github.io/World-network/** - always on, installable on a phone
(Share -> Add to Home Screen on iOS, Install app on Android).

Members can also connect with each other: share a card by QR code or invite link, see who they
know in the city they are visiting, and let those people know (see
[Cards, visits and location](#cards-visits-and-location)).

Stats/gamification and the social mode are planned for later phases.

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

1. **Enable the People API** in the Google Cloud project that owns your OAuth client:
   https://console.cloud.google.com/apis/library/people.googleapis.com. Without it every sync fails
   with `403 SERVICE_DISABLED` - the app now shows that in words and links straight to the page
   that turns it on. A newly enabled API takes a minute or two to start answering.
2. Create an OAuth client in Google Cloud Console (Web), scope
   `https://www.googleapis.com/auth/contacts` (read/write - `contacts.readonly` imports fine but
   cannot push edits back).
3. Authorized redirect URI: `http://localhost:54321/auth/v1/callback` locally, or
   `https://<project-ref>.supabase.co/auth/v1/callback` against the hosted project.
4. Export before `supabase start`:
   ```bash
   export GOOGLE_CLIENT_ID=...
   export GOOGLE_SECRET=...
   ```

Without this, email/password auth and CSV import still work.

#### Staying connected (Edge Function)

Supabase hands the browser a Google **access token** exactly once, on the OAuth redirect, and it
expires after about an hour. Exchanging the **refresh token** that arrives with it needs the OAuth
client secret, which cannot live in a static site - so that happens in an Edge Function:

```bash
supabase functions deploy google-token
supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=...
```

Same client id/secret as the Google provider in Supabase Auth. Apply
`supabase/migrations/20260901120000_google_credentials.sql` first: it creates the table the function
keeps refresh tokens in, with RLS on and **no policies at all**, so only the service role the
function runs as can read them - not the browser, and not a stolen anon key. (It is already applied
on the hosted project.)

The function answers a fixed list of origins - the deployed site and the two local dev hosts - so a
page on another origin cannot call it and read the Google access token out of the response. Deployed
somewhere else, set the list:

```bash
supabase secrets set ALLOWED_ORIGINS=https://your-site.example,https://www.your-site.example
```

One Google-side catch: while the OAuth consent screen is in **Testing**, Google expires refresh
tokens after 7 days, so the connection drops weekly however this is deployed. Publishing the app
(or making it Internal in a Workspace) is what makes "permanently" literal.

The Settings card says which of the two you have: *"Connected permanently"* once the function
answers, *"Connected for this browser tab only"* when it is not deployed. Syncing still works in the
second case, for as long as the tab and the hour last.

With the function deployed, sync runs on load and every 15 minutes the app is open and visible
(`useGoogleAutoSync.ts`). A background run skips contacts that were deleted here instead of asking
whether to bring them back: nobody is there to answer, and resurrecting a deliberately deleted
contact is the one outcome worth avoiding. The next manual sync raises the prompt.

#### Updating without the app open (Edge Function + GitHub Action)

The sync above only runs while a tab has the app open. `google-sync-cron` is the same pull, run
server-side on a schedule instead, so Google-side changes (a contact added or edited from your
phone's Google Contacts app, say) show up here without opening the app at all:

```bash
supabase functions deploy google-sync-cron --no-verify-jwt
supabase secrets set CRON_SECRET=$(openssl rand -hex 32)
```

`--no-verify-jwt` because this is invoked on a timer with a shared secret, not a signed-in user - the
function checks the `x-cron-secret` header against `CRON_SECRET` itself. Apply
`supabase/migrations/20260927120000_google_sync_lock.sql` first (adds the column the function uses
to avoid two overlapping runs for the same user). Then, as a repository secret alongside the
existing `VITE_SUPABASE_URL`:

```bash
gh secret set SYNC_CRON_SECRET   # same value as CRON_SECRET above
```

`.github/workflows/sync-contacts.yml` then calls it every 15 minutes - it is a plain HTTP POST with
that header, the same shape as `keepalive.yml`'s ping. Without the two secrets set, the workflow
fails loudly (the function answers 401/500) rather than silently doing nothing.

The function runs in two modes. Called with no body it is a dispatcher: it asks the database who is
due (`due_google_syncs`, from `20261025130000_account_deletion.sql` - apply that before deploying),
oldest-synced first and at most 40 users, then calls itself once per user in parallel. Each user is
synced in their own invocation, so one slow or failing account cannot use up the time of the others,
and a user that keeps failing goes to the back of the queue instead of blocking it. The response
reports counts only, never user ids, because workflow logs may be public.

This is deliberately **pull only** - it imports Google's contacts here, the same way opening the
Import page or a background tab-sync does, but never pushes local edits to Google unattended.
Local edits already push to Google the moment they are saved (`googleQueue.ts`), live, in the
browser, with the user there to notice if something goes wrong; writing to a real Google address
book on an unwatched timer for every connected account is a bigger risk than reading from it, so
that direction stays interactive (`useGoogleSync`'s "Sync now", or the per-tab background sync
above).

#### Two-way sync

Import stores each Google contact's `resourceName` in `contacts.external_ids.google`. While the
sync switch on the Settings page is on:

- adding a contact creates it in Google (`people.createContact`) and stores the returned link
- editing a linked contact PATCHes it (`people.updateContact`)
- deleting a linked contact deletes it in Google (`people.deleteContact`); Google keeps it in its
  own trash for 30 days, so contacts.google.com can undo it

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
- **"Clear all" on the Contacts page never touches Google.** One click emptying an entire address
  book is a blast radius no undo covers; the next sync pulls those contacts back instead.
- Contacts deleted here *before* delete propagation existed, or while Google was disconnected, are
  still in Google and would come back on the next pull. Every such contact is listed in a prompt for
  an explicit yes or no first. Nothing is remembered - you are asked again next sync, because the
  answer lives in Google and can change there.
- Contacts imported before the link existed get adopted on the next sync.
- Writes are serialised through one queue (`googleQueue.ts`) rather than awaited inside the save, so
  the form closes on the local write and Google catches up behind it.

"Sync now" on the Settings page runs both directions: it pulls from Google, then pushes every
contact edited here since the last sync (`pushChangedContacts` in `googlePush.ts`) and lists by
name what it created or updated in Google. Contacts from a CSV or LinkedIn export are only ever
updated, never created there - one import would otherwise push hundreds of rows into the address
book. The very first sync pushes nothing, because with no previous timestamp every contact looks
changed. The Google card on the Import page stays a one-way pull.

### Country outlines (choropleth view)

`public/countries.min.json` (~1.1MB, ~400KB gzipped, committed) holds Natural Earth 1:10m country
outlines keyed by ISO alpha-2, which is what the **Countries** map view shades. They are simplified
with mapshaper so shared borders stay identical for both neighbours (no gaps or overlaps), keeping
12% of the vertices at ~100m precision. Regenerate with (needs network, fetches mapshaper via npx):

```bash
node scripts/build-countries.mjs
```

Microstates (Singapore, Hong Kong, Malta, Bahrain, Andorra, ...) have a polygon but are invisible
at world zoom, so the build flags them `tiny` and the map also draws a marker on the country
centroid in the same colour, because a map of where people are cannot silently drop Singapore. The file is fetched only when that view is first opened.

### Flag colours

`src/lib/flagColors.ts` is generated, holding the dominant colours of every country's flag for the
"Colour dots by: Flag" option. Regenerate with:

```bash
node scripts/build-flag-colors.mjs
```

It counts the actual pixels of a 40px flag PNG from flagcdn.com rather than reading an SVG's `fill`
attributes: a fill says a colour is present, not how much of the flag it covers, and coverage is
what decides which colour a bubble should be. Edge pixels blend two neighbouring stripes into
colours the design contains nowhere (Sweden's blue and yellow average to olive), so any candidate
sitting on the line between two colours already picked is dropped.

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
- World map: contact pins that stack per country while zoomed out and split into cities from
  zoom 4 (`CITY_ZOOM` in `src/features/map/mapStore.ts`), click for details, hover readout
- Three map views: flat dots, the same dots on a globe, and **Countries** - a choropleth shading
  each country by how many contacts it holds, with a legend, per-country counts and the same
  click-through to the contact card
- "Colour dots by" switch: category (or sublabel under a filtered label) or **flag** - each dot
  takes the two main colours of its country's flag, fill and ring
- Cosmopolitan vs homelover view toggle (recenters on home country)
- Filters: category, country, tag/community
- Tags/communities with assignment per contact
- Import: Google Contacts (People API), generic CSV, LinkedIn Connections.csv (auto-detected)
- Two-way Google sync: contacts added, edited or deleted here are created/updated/deleted in
  Google; the contact editor carries Google's full field set (see below)
- Background Google sync every 15 minutes while a tab is open, with the connection kept alive
  server-side by the `google-token` Edge Function, **plus** a server-side pull on the same interval
  (`google-sync-cron` + `sync-contacts.yml`) that keeps contacts current with no tab open at all
- Per-contact location picker (search or click the map) for precise / missing locations
- "Unplaced" filter on the contacts page to quickly find and fix contacts without coordinates
- History: durable log of every contact added or removed, grouped by day, filterable by
  action and searchable by name / email / place

## Cards, visits and location

Apply `20261114115900_invite_source.sql` and `20261114120000_cards_visits_community.sql`.

- **My card** (`/card`). Every profile has a `share_token`; the QR code and the invite link
  (`<site>?invite=<token>`) carry it. Opening the link signed out parks the token in
  localStorage across the sign-in, then asks. Accepting calls `accept_invite()`, which swaps
  cards: each side gets the other as a contact (an existing contact with the same email or phone
  is adopted, and only its empty fields are filled) and a `contact_links` row. The card holds the
  name plus whichever of phone / emails / socials / home city are ticked in `share_fields`.
  "Replace link" writes a new token, which retires the old link and QR code.
- **`contact_links` is not client-writable.** Only the security-definer functions insert into
  it. A client that could write it could claim a link to any member, then read their city and
  send them notices. Deleting a row (Disconnect, or deleting the contact) removes the other
  member's row too.
- **City location** (Settings, off by default). The browser's position is read at low accuracy
  and matched to a city in the browser (`nearestCity()` in `src/lib/geocode.ts`: the biggest city
  within 20 km, else the closest within 100 km). Only that city and the city's own coordinates
  are written to `profiles.current_*`. The position itself never leaves the device, and there is
  no history: one row, overwritten. Switching it off nulls the columns. Linked members read it
  through `linked_locations()`.
- **Visits** (`/visits`). Away from home (more than 75 km from the stored home coordinates) the
  app shows a banner with how many contacts live in that city and country. The page lists them,
  for the detected city or any city picked by hand, and one button notifies the ticked ones:
  linked members get a row in `visit_notices` through `send_visit_notice()` (which reaches linked
  members only, 200 a day at most) and see it on their own Visits page; everyone else is
  messaged by the user, through one Bcc email from their mail app or the WhatsApp / SMS link on
  each row. The app sends no email or SMS itself, so there is no provider to pay and nobody can
  use it to spam.
- **Not covered:** an alert while the app is closed. A web app cannot read location in the
  background, so the check runs when the app is opened.

## One account for several apps

The Supabase project is the shared part. Any other app (photomap, consumption, language
assistant, ...) that is built against the same project gets the same sign-in and the same
`profiles` row, with nothing to migrate. To keep that working:

- Keep app-neutral things in the tables every app reads: `profiles` (identity, home, card,
  location), `contact_links`, `apps`, `feedback`. Prefix a new app's own tables with its name.
- `public.apps` is the directory. Each app shows the other rows under "More apps, same account"
  (`src/features/apps/MoreApps.tsx`), so launching an app advertises it in all the others with
  one SQL insert and no deploy.
- `public.feedback` has an `app` column. The Feedback button in every app writes to the same
  table, and the inbox on the Settings page (admins only) shows all of it.
- Add each app's URL to Authentication -> URL Configuration -> Redirect URLs, and to the
  `ALLOWED_ORIGINS` secret.
- Sessions are stored per origin, so a second app on another domain asks to sign in once
  ("Continue with Google" is one click). Hosting the apps as subdomains of one domain keeps the
  option of a shared session cookie open later.

## Deployment

### Railway

`Dockerfile` builds the site and serves `dist` with Caddy (`Caddyfile`: SPA fallback, long cache
for `/assets`, no cache for the shell and the service worker). `railway.json` points Railway at it.

1. New project -> Deploy from GitHub repo -> this repository.
2. Service -> Variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (same values as
   `.env.local`). They are build-time values; redeploy after changing them.
3. Service -> Settings -> Networking -> Generate Domain.
4. In Supabase: Authentication -> URL Configuration, add the Railway URL to Redirect URLs (and
   make it the Site URL once it is the main address). Without this, sign-in lands on the old site.
5. `supabase secrets set ALLOWED_ORIGINS=https://<railway-domain>,https://marsierz-ui.github.io`
   so the Edge Functions answer the new origin.

To try the image locally:

```bash
docker build -t world-network --build-arg VITE_SUPABASE_URL=... --build-arg VITE_SUPABASE_ANON_KEY=... .
docker run --rm -p 8080:8080 world-network
```

### GitHub Pages

Pushing to `main` builds and publishes to GitHub Pages via `.github/workflows/deploy.yml`.
The site is served from `/World-network/` there, so the workflow sets `VITE_BASE_PATH` to that;
every other build, and dev, is served from `/`. Runtime paths use `import.meta.env.BASE_URL`.

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

## Data security

Every table in `public` is owner-scoped: RLS on, policies keyed on `auth.uid() = user_id`, so one
signed-in user can only ever reach their own rows. Under that, `anon` holds **no table grants at
all** - nothing in the app runs signed out, so a dropped or mis-edited policy fails closed instead
of exposing 676 contacts to anyone with the (public by design) anon key. Supabase's default
privileges, which hand `anon` full rights on every new table in `public`, are switched off for that
role as well, so an ad-hoc table created in the SQL editor is not world-readable the moment it
exists.

Three tables have RLS on with **no policies at all** - `google_credentials` (Google refresh
tokens), `keepalive`, and `contacts_geo_backup` (an old snapshot of contact PII). That is the
deny-everything setting: only the service role gets in. The Supabase linter reports them as
"RLS enabled, no policy"; for these three that is the intended end state, not a finding.

**PostGIS lives in the `extensions` schema, not `public`.** PostgREST exposes `public`, so an
extension installed there puts its own objects on the API: `public.spatial_ref_sys` shipped with RLS
off and write grants to `anon`, and `st_estimatedextent` was an anonymous `SECURITY DEFINER` RPC.
Neither could be fixed in place - they are owned by `supabase_admin`, and a REVOKE from anyone but
the grantor silently does nothing - so `20260916202549_move_postgis_out_of_public.sql` drops and
recreates the extension in `extensions`, recreating the two generated `geography` columns (which
derive from the lng/lat columns and recompute to identical values). Keep PostGIS out of `public` if
you ever rebuild the project.

`public.ping()` is deliberately `SECURITY DEFINER` and anon-executable: the keepalive workflow is
the only caller and it has nothing but the anon key. It writes at most once a minute and returns a
timestamp, so an unmetered caller gains nothing.

**Admin.** The Mobility, Social and Feed pages (plus per-contact location history and the LinkedIn
self-import) are shown only to admins. Admins are rows in `public.admins`, which has RLS on, no
policies and no client grants, so a user cannot promote themselves; the app asks `is_admin()`, which
answers for the caller only. Promote someone in the SQL editor:

```sql
insert into public.admins (user_id) select id from auth.users where email = 'you@example.com';
```

This gates the UI, not data: those pages read the same owner-scoped tables every other page does,
and the Bluesky/Mastodon calls go from the browser to public APIs.

**Account deletion is a request, not an instant delete.** Settings -> Delete account calls the
`delete-account` Edge Function, which records a row in `account_deletions`, revokes and drops the
Google grant, switches sync off and signs the user out. Nothing is removed for 30 days; signing back
in shows a restore screen. Only `account-purge` (daily, `purge-deleted-accounts.yml`, same
`SYNC_CRON_SECRET`) permanently deletes the auth user once the 30 days are up, and every table
cascades from it. Admin accounts are refused at request time and skipped by the purge, so a stolen
admin session cannot take the owner's data. Disable that workflow to stop all permanent deletion.
Deploy order: apply `20261025130000_account_deletion.sql`, then

```bash
supabase functions deploy delete-account
supabase functions deploy account-purge --no-verify-jwt
supabase functions deploy google-token
supabase functions deploy google-sync-cron --no-verify-jwt
```

Two things are **not** settled in code, and need a decision in the Supabase dashboard:

- **Leaked-password protection is off** (Authentication -> Providers -> Email). Turning it on
  checks new passwords against HaveIBeenPwned. It is one toggle and there is no reason not to.
- **`contacts_geo_backup` still holds 630 rows of contact PII** from an old geocoding pass. It is
  unreachable from the API and referenced by nothing. If it has served its purpose, drop it: a
  second copy of the address book is a second thing to lose.

## Known limits (by design)

- **LinkedIn** has no API for connections/location — only the CSV export, which carries company and
  position but **no location**. Those contacts appear on the map once you add a city.
- **Social posts / "social mode"** depend on locked-down APIs and are deferred to a later phase.

## Project layout

```
.github/workflows/                  Pages deploy, Supabase keepalive, background contacts sync
supabase/migrations/                schema + PostGIS + RLS + grants, applied in order
supabase/functions/google-token/    refresh-token exchange, keeps Google connected
supabase/functions/google-sync-cron/  server-side pull, runs with nobody signed in
src/lib/                            supabase client, geocode, countries, cities, types
src/features/auth/                  AuthProvider, LoginPage
src/features/profile/               profile query/mutation
src/features/contacts/              hooks, ContactForm, CustomFieldsManager
src/features/tags/                  tag hooks, TagAssigner
src/features/map/                   NetworkMap (deck.gl), GlobeMap, ChoroplethMap, filters, store
src/features/contacts/useContactHistory.ts  reads contact_events
src/features/import/                CSV parse, Google People API, bulk import
src/pages/                          Map, Contacts, Import, Settings
scripts/build-cities.mjs            generate full geocoding dataset
scripts/build-countries.mjs         generate country outlines for the choropleth
scripts/build-flag-colors.mjs       generate flag colours for the flag dot option
```
