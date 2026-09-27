# World Network

Visualize your personal contact network on a world map. Maintain contacts with custom fields,
import from Google and CSV (incl. LinkedIn exports), tag communities, and switch between a
**cosmopolitan** (world) and **homelover** (home-country) view.

**Live: https://marsierz-ui.github.io/World-network/** - always on, installable on a phone
(Share -> Add to Home Screen on iOS, Install app on Android).

Going public (app stores, Google verification, feedback setup): see
[docs/DISTRIBUTION.md](docs/DISTRIBUTION.md).

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

### Feedback -> admin -> AI agent

The **Feedback** button in the menu works like attention-tracker's: drag over the part of the
screen the feedback is about (tap for the whole screen), write a note, send. The note and the
cropped screenshot land in the admin inbox (**Admin**, visible to `public.admins` only). From there
an admin triages and clicks **Send to AI agent**:

```
Feedback button -> public.feedback + Storage bucket `feedback` (private)   status: new
Admin page      -> triage, note for the agent, "Send to AI agent"
  -> Edge Function feedback-dispatch (admin-only)                         status: dispatched
     -> GitHub repository_dispatch -> .github/workflows/feedback-agent.yml
        (shipped as docs/feedback-agent.yml; move it there to enable it)
        -> stages the note + screenshot in .feedback/ (gitignored)
        -> Claude Code looks at the screenshot, implements, opens a PR
You review and merge -> deploy.yml ships it
```

- The screenshot reaches the agent as a signed Storage link that expires in an hour; the workflow
  downloads it only if it points at this project's `feedback` bucket.
- Everything from the payload reaches the workflow through `env`, never pasted into script text,
  and model/effort are closed sets - the text was typed by a member of the public.
- This repo is public, so the agent is told not to commit `.feedback/` or quote personal details in
  commits or the PR.
- The capture uses `modern-screenshot` (the browser renders the CSS; html2canvas throws on
  `color-mix()`), and every map is created with `preserveDrawingBuffer` (`MAP_CANVAS_CONTEXT` in
  `lib/basemap.ts`) so the WebGL canvas is not blank in the screenshot.

Setup (migration, admin, secrets) is in [docs/DISTRIBUTION.md](docs/DISTRIBUTION.md#feedback---admin---ai-agent).

### Country outlines (choropleth view)

`public/countries.min.json` (160KB, committed) holds Natural Earth 1:110m country outlines keyed by
ISO alpha-2, which is what the **Countries** map view shades. Regenerate with:

```bash
node scripts/build-countries.mjs
```

At 1:110m the microstates have no polygon at all (Singapore, Hong Kong, Malta, Bahrain, Andorra);
those are drawn as a marker on the country centroid in the same colour, because a map of where
people are cannot silently drop Singapore. The file is fetched only when that view is first opened.

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
- Background Google sync every 15 minutes, with the connection kept alive server-side by the
  `google-token` Edge Function
- Per-contact location picker (search or click the map) for precise / missing locations
- "Unplaced" filter on the contacts page to quickly find and fix contacts without coordinates
- History: durable log of every contact added or removed, grouped by day, filterable by
  action and searchable by name / email / place
- Signing up with Google connects Google Contacts in the same step: sync starts on and the first
  load imports them; a banner re-asks if the contacts box was unticked on Google's screen
- In-app feedback with an area screenshot, an admin inbox, and hand-off to an AI agent that opens
  a pull request

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

## Data security

Every table in `public` is owner-scoped: RLS on, policies keyed on `auth.uid() = user_id`, so one
signed-in user can only ever reach their own rows. Under that, `anon` holds **no table grants at
all** - nothing in the app runs signed out, so a dropped or mis-edited policy fails closed instead
of exposing 676 contacts to anyone with the (public by design) anon key. Supabase's default
privileges, which hand `anon` full rights on every new table in `public`, are switched off for that
role as well, so an ad-hoc table created in the SQL editor is not world-readable the moment it
exists.

`feedback` is the one table a user can write that someone else reads: senders insert and read
their own rows, admins read all of them, and column grants limit the sender to what they are telling
us and the admin to the triage columns, so not even an admin session can rewrite what a user said.
Admin rights live in `public.admins` rather than a flag on `profiles`, because the "own profile"
policy lets a user update every column of their own row.

Four tables have RLS on with **no policies at all** - `google_credentials` (Google refresh
tokens), `admins`, `keepalive`, and `contacts_geo_backup` (an old snapshot of contact PII). That is the
deny-everything setting: only the service role gets in. The Supabase linter reports them as
"RLS enabled, no policy"; for these four that is the intended end state, not a finding.

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
.github/workflows/                  Pages deploy, Supabase keepalive, feedback AI agent
supabase/migrations/                schema + PostGIS + RLS + grants, applied in order
supabase/functions/google-token/    refresh-token exchange, keeps Google connected
supabase/functions/feedback-dispatch/  admin-only hand-off of feedback to the AI agent workflow
src/lib/                            supabase client, geocode, countries, cities, types
src/features/auth/                  AuthProvider, LoginPage
src/features/profile/               profile query/mutation
src/features/contacts/              hooks, ContactForm, CustomFieldsManager
src/features/tags/                  tag hooks, TagAssigner
src/features/map/                   NetworkMap (deck.gl), GlobeMap, ChoroplethMap, filters, store
src/features/contacts/useContactHistory.ts  reads contact_events
src/features/import/                CSV parse, Google People API, bulk import
src/features/feedback/              Feedback button, area screenshot, admin hooks
src/pages/                          Map, Contacts, Import, Settings, Admin
scripts/build-cities.mjs            generate full geocoding dataset
scripts/build-countries.mjs         generate country outlines for the choropleth
scripts/build-flag-colors.mjs       generate flag colours for the flag dot option
```
