import type { Contact } from '../../lib/database.types';

export interface SocialPost {
  id: string;
  platform: 'bluesky' | 'mastodon';
  contactId: string;
  contactName: string;
  text: string;
  createdAt: string;
  url: string;
}

// --- Bluesky (AT Protocol public AppView - no auth) ---
function blueskyActor(value: string): string {
  const v = value.trim();
  const m = v.match(/profile\/([^/?#]+)/);
  return (m ? m[1] : v).replace(/^@/, '');
}

async function fetchBluesky(value: string, contact: Contact): Promise<SocialPost[]> {
  const actor = blueskyActor(value);
  const url = `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(actor)}&limit=15`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`bluesky ${res.status}`);
  const data = await res.json();
  const items: SocialPost[] = [];
  for (const it of data.feed ?? []) {
    const post = it.post;
    const rec = post?.record;
    if (!rec?.text) continue;
    const rkey = String(post.uri).split('/').pop();
    const handle = post.author?.handle ?? actor;
    items.push({
      id: post.uri,
      platform: 'bluesky',
      contactId: contact.id,
      contactName: contact.full_name,
      text: rec.text,
      createdAt: rec.createdAt,
      url: `https://bsky.app/profile/${handle}/post/${rkey}`,
    });
  }
  return items;
}

// --- Mastodon (public REST - no auth) ---
function mastodonParts(value: string): { instance: string; user: string } | null {
  const v = value.trim().replace(/^@/, '');
  const urlMatch = v.match(/^https?:\/\/([^/]+)\/@([^/?#]+)/);
  if (urlMatch) return { instance: urlMatch[1], user: urlMatch[2] };
  const [user, instance] = v.split('@');
  return instance ? { instance, user } : null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .trim();
}

async function fetchMastodon(value: string, contact: Contact): Promise<SocialPost[]> {
  const parts = mastodonParts(value);
  if (!parts) return [];
  const { instance, user } = parts;
  const look = await fetch(`https://${instance}/api/v1/accounts/lookup?acct=${encodeURIComponent(user)}`);
  if (!look.ok) throw new Error(`mastodon lookup ${look.status}`);
  const acct = await look.json();
  const st = await fetch(`https://${instance}/api/v1/accounts/${acct.id}/statuses?limit=15&exclude_replies=true`);
  if (!st.ok) throw new Error(`mastodon statuses ${st.status}`);
  const statuses = await st.json();
  return (statuses as { id: string; created_at: string; content: string; url: string }[])
    .filter((s) => s.content)
    .map((s) => ({
      id: s.id,
      platform: 'mastodon' as const,
      contactId: contact.id,
      contactName: contact.full_name,
      text: stripHtml(s.content),
      createdAt: s.created_at,
      url: s.url,
    }));
}

// Aggregate recent posts across all contacts that have a connected feed handle.
export async function aggregateSocialFeed(contacts: Contact[]): Promise<SocialPost[]> {
  const jobs: Promise<SocialPost[]>[] = [];
  for (const c of contacts) {
    const bsky = c.socials?.bluesky;
    const mast = c.socials?.mastodon;
    if (bsky) jobs.push(fetchBluesky(bsky, c).catch(() => []));
    if (mast) jobs.push(fetchMastodon(mast, c).catch(() => []));
  }
  const results = await Promise.all(jobs);
  return results
    .flat()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
