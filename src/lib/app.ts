// This app's key in public.apps and public.feedback, which every app in the
// same Supabase project shares.
export const APP_SLUG = 'world-network';

// origin alone drops the subpath when the app is served from one (GitHub Pages:
// /World-network/), sending auth redirects and invite links to the bare host.
// BASE_URL is that subpath in such a build and '/' everywhere else.
export const APP_URL = window.location.origin + import.meta.env.BASE_URL;
