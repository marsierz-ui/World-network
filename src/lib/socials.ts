// Social platforms a contact can be linked to. Values are stored as handles or URLs
// in contacts.socials; toUrl() builds a clickable link. Bluesky/Mastodon also expose
// public post feeds (see features/social); the rest are links only.
export interface Platform {
  key: string;
  label: string;
  icon: string;
  base: string; // prefix for a bare handle
  feed?: boolean; // public post feed available
}

export const PLATFORMS: Platform[] = [
  { key: 'bluesky', label: 'Bluesky', icon: 'BS', base: 'https://bsky.app/profile/', feed: true },
  { key: 'mastodon', label: 'Mastodon', icon: 'MA', base: '', feed: true },
  { key: 'instagram', label: 'Instagram', icon: 'IG', base: 'https://instagram.com/' },
  { key: 'facebook', label: 'Facebook', icon: 'FB', base: 'https://facebook.com/' },
  { key: 'x', label: 'X', icon: 'X', base: 'https://x.com/' },
  { key: 'linkedin', label: 'LinkedIn', icon: 'in', base: 'https://www.linkedin.com/in/' },
  { key: 'tiktok', label: 'TikTok', icon: 'TT', base: 'https://www.tiktok.com/@' },
  { key: 'website', label: 'Website', icon: 'WWW', base: 'https://' },
];

// Mastodon handles look like "user@instance.tld" -> https://instance.tld/@user
function mastodonUrl(v: string): string {
  const h = v.replace(/^@/, '');
  const [user, instance] = h.split('@');
  return instance ? `https://${instance}/@${user}` : v;
}

export function toUrl(platform: string, value: string): string {
  const v = value.trim();
  if (/^https?:\/\//i.test(v)) return v;
  if (platform === 'mastodon') return mastodonUrl(v);
  const p = PLATFORMS.find((x) => x.key === platform);
  if (!p) return v;
  return p.base + v.replace(/^@/, '');
}

// Deep link to search a platform for a person's name (assisted-manual matching).
export function searchUrl(platform: string, name: string): string {
  const q = encodeURIComponent(name);
  switch (platform) {
    case 'x': return `https://x.com/search?q=${q}&f=user`;
    case 'bluesky': return `https://bsky.app/search?q=${q}`;
    case 'facebook': return `https://www.facebook.com/search/people/?q=${q}`;
    case 'linkedin': return `https://www.linkedin.com/search/results/people/?keywords=${q}`;
    case 'instagram': return `https://www.google.com/search?q=${q}+instagram`;
    case 'mastodon': return `https://www.google.com/search?q=${q}+mastodon`;
    case 'tiktok': return `https://www.tiktok.com/search/user?q=${q}`;
    default: return `https://www.google.com/search?q=${q}`;
  }
}
