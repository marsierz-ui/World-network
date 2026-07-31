import { useContacts } from '../features/contacts/useContacts';
import { useSocialFeed } from '../features/social/useSocialFeed';
import type { SocialPost } from '../features/social/socialFeed';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function SocialPage() {
  const { data: contacts = [] } = useContacts();
  const { data: posts = [], isLoading, isError, connectedCount, refetch, isFetching } =
    useSocialFeed(contacts);

  return (
    <div className="page-pad social-page">
      <div className="social-head">
        <h2>Social feed</h2>
        <div className="muted">
          {connectedCount} contact{connectedCount === 1 ? '' : 's'} with Bluesky/Mastodon linked
          <button className="link" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? 'refreshing...' : 'refresh'}
          </button>
        </div>
      </div>

      {connectedCount === 0 && (
        <div className="social-empty">
          No connected feeds yet. Open a contact and add a <strong>Bluesky</strong> handle
          (e.g. <code>name.bsky.social</code>) or <strong>Mastodon</strong> handle
          (e.g. <code>name@mastodon.social</code>). Those are the open networks with public posts.
        </div>
      )}

      {isLoading && connectedCount > 0 && <div className="muted">Loading posts...</div>}
      {isError && <div className="error">Could not load some feeds.</div>}

      <div className="feed">
        {posts.map((p) => <PostCard key={`${p.platform}:${p.id}`} post={p} />)}
        {!isLoading && connectedCount > 0 && posts.length === 0 && (
          <div className="muted">No recent posts from connected contacts.</div>
        )}
      </div>
    </div>
  );
}

function PostCard({ post }: { post: SocialPost }) {
  return (
    <a className="post-card" href={post.url} target="_blank" rel="noreferrer">
      <div className="post-head">
        <span className="post-author">{post.contactName}</span>
        <span className={`post-badge ${post.platform}`}>{post.platform === 'bluesky' ? 'Bluesky' : 'Mastodon'}</span>
        <span className="muted post-time">{timeAgo(post.createdAt)}</span>
      </div>
      <div className="post-text">{post.text}</div>
    </a>
  );
}
