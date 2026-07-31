import { useQuery } from '@tanstack/react-query';
import type { Contact } from '../../lib/database.types';
import { aggregateSocialFeed } from './socialFeed';

export function useSocialFeed(contacts: Contact[]) {
  const connected = contacts.filter((c) => c.socials?.bluesky || c.socials?.mastodon);
  // Key on the connected handles so the feed refetches when links change.
  const key = connected
    .map((c) => `${c.id}:${c.socials.bluesky ?? ''}:${c.socials.mastodon ?? ''}`)
    .sort()
    .join('|');

  const query = useQuery({
    queryKey: ['social_feed', key],
    enabled: connected.length > 0,
    staleTime: 5 * 60_000,
    queryFn: () => aggregateSocialFeed(connected),
  });

  return { ...query, connectedCount: connected.length };
}
