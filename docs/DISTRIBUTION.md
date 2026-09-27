# Going public: distribution, Google access, feedback

## Recommendation: one web codebase, shipped three ways

World Network is already an installable PWA on GitHub Pages. Its core, the MapLibre + deck.gl map,
is WebGL code that has no React Native equivalent, so a native rewrite (attention-tracker's Expo
route) would mean building the product twice. Package the web app instead:

| Channel | How | Cost | Effort |
|---|---|---|---|
| **Web / PWA** (all platforms) | What runs today. Android: *Install app*. iOS: Share -> *Add to Home Screen*. | free | done |
| **Google Play** | A **Trusted Web Activity**: an Android shell that opens the PWA in Chrome, full screen, with no browser bar. Build it at [pwabuilder.com](https://www.pwabuilder.com) (or `@bubblewrap/cli`). | $25 once | ~1 day |
| **Apple App Store** | Later, if at all. See below. | $99 / year | weeks |

Why a TWA and not Capacitor/Cordova for Android: a TWA runs in real Chrome, so **Google sign-in
works unchanged**. Google blocks OAuth inside embedded WebViews (`403 disallowed_useragent`), which
a Capacitor app would have to work around with a system-browser sign-in and deep links. Updates
also ship the moment you merge to `main` - no store review per release.

Why not the App Store yet: Apple rejects apps that are a website in a wrapper (guideline 4.2) unless
they add native value, and the same WebView sign-in problem applies. The iOS PWA is a good product
already: installed to the home screen it runs full screen with its own icon (`apple-touch-icon.png`
is now a real PNG; iOS ignored the SVG and showed a page screenshot instead).

## Before anyone outside can sign in

These are blockers, in order. None of them is code in this repo.

1. **A custom domain** (e.g. `worldnetwork.app`, ~$10/year). Two things require one:
   - Google OAuth verification only accepts domains you prove you own in Search Console, and
     `github.io` cannot be yours.
   - A TWA proves it belongs to the site with `/.well-known/assetlinks.json` at the **domain root**.
     The app lives under `/World-network/`, which cannot serve the root.

   Point the domain at GitHub Pages (repo Settings -> Pages -> Custom domain), then:
   - `vite.config.ts`: production `base` becomes `'/'`
   - Supabase -> Authentication -> URL Configuration: Site URL and redirect URLs to the new domain
   - Google Cloud -> OAuth client: add the domain to Authorized JavaScript origins
   - `supabase secrets set ALLOWED_ORIGINS=https://your.domain` (google-token, feedback-dispatch)

2. **Google OAuth verification.** `auth/contacts` is a *sensitive* scope. Until the consent screen is
   verified, every new user sees "Google hasn't verified this app", sign-ups stop at **100 users**,
   and while the app is in *Testing* only listed test users can sign in at all and refresh tokens die
   after 7 days. In Google Cloud -> Google Auth Platform: set the app to *In production*, add the
   homepage and privacy policy on your domain, justify the contacts scope ("shows the user's own
   contacts on a map and keeps edits in sync"), and upload a short screen recording of the
   sign-in, the consent screen and the synced contacts. Expect a few days to a few weeks.

3. **A privacy policy page** on the domain. It must say what Google data is used for, include
   Google's [Limited Use](https://developers.google.com/terms/api-services-user-data-policy#additional_requirements_for_specific_api_scopes)
   statement, and mention that feedback screenshots, which can show contacts, are read by the admin
   and processed by an AI assistant when the user chooses to send one (the feedback dialog says so).

4. **Email that scales.** Supabase's built-in mailer is for development: it sends a handful of
   emails an hour and only delivers to members of your Supabase team. Add custom SMTP (Resend, Postmark, SES) under Authentication -> Emails
   before announcing, or email sign-ups will stall. Consider turning on email confirmations
   (`enable_confirmations`) and leaked-password protection at the same time.

5. **Account deletion.** Google Play requires both an in-app way to delete the account and a web
   page that explains how. The app has no delete-account action yet; it is a small Edge Function
   (`auth.admin.deleteUser`, the rows cascade) plus a Settings button.

6. **Capacity.** The Supabase free tier covers 50k monthly users and 500 MB of database, which is
   plenty to start; the keepalive workflow stops it pausing. Watch Storage (1 GB) once feedback
   screenshots accumulate.

## Google Play, step by step (after the domain)

1. Open [pwabuilder.com](https://www.pwabuilder.com), enter the site URL, choose *Android* ->
   *Google Play*, package id e.g. `app.worldnetwork`. Keep the signing key it generates somewhere safe:
   losing it means you can never update the app.
2. Copy the `assetlinks.json` it produces into `public/.well-known/assetlinks.json` (with base `/`
   it is served from the root) and deploy.
3. Play Console ($25): create the app, fill in the Data safety form (email, contacts, approximate
   location of contacts; encrypted in transit; deletable), upload the `.aab` to *Internal testing*,
   try it on a phone, then promote to production.

## Google contacts access on sign-up

Google never grants a permission without its consent screen - no app can skip that. What the app
does now:

- **Signing in with Google is also connecting contacts.** The sign-in asks for the contacts scope,
  and `20260927120100_google_signup_sync.sql` makes a Google sign-up start with two-way sync on,
  so the first page load imports the address book with no trip to Settings.
- **If the user unticks contacts** on Google's consent screen (each sensitive scope is its own
  checkbox), the app checks the granted scopes on the redirect and shows a banner with a *Grant
  contacts access* button that re-asks for just that.
- Email/password sign-ups have no Google account, so they connect from Import -> Google as before.
  The login page now says that Google is the way to get contacts in.

## Feedback -> admin -> AI agent

Same pipeline as attention-tracker, described in the README under *Feedback*. Setup:

1. Apply `supabase/migrations/20260927120000_feedback.sql`.
2. Make yourself admin in the SQL editor:
   `insert into public.admins (user_id) select id from auth.users where email = 'you@example.com';`
   An **Admin** item appears in the menu.
3. Repo secret `CLAUDE_CODE_OAUTH_TOKEN` (run `claude setup-token`; bills your Claude plan).
4. A fine-grained GitHub token with *Contents: read and write* on this repo, then:
   ```bash
   supabase secrets set GH_REPO=marsierz-ui/World-network GH_DISPATCH_TOKEN=<token>
   supabase functions deploy feedback-dispatch
   ```
5. Test end to end: send feedback from the app, open Admin, click *Send to AI agent*, and watch
   Actions -> *Feedback AI Agent*. A pull request appears; nothing ships until you merge it.
