import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { APP_SLUG } from '../../lib/app';
import { safeHttpUrl } from '../../lib/socials';
import type { CommunityApp } from '../../lib/database.types';

// The other apps in this Supabase project: same account, same profile. Rows
// live in public.apps, so a new app shows up here without a deploy of this one.
function useApps() {
  return useQuery({
    queryKey: ['apps'],
    staleTime: 60 * 60_000,
    queryFn: async (): Promise<CommunityApp[]> => {
      const { data, error } = await supabase
        .from('apps')
        .select('slug,name,tagline,url')
        .neq('slug', APP_SLUG)
        .order('sort_order');
      if (error) throw error;
      return (data as CommunityApp[]).filter((a) => safeHttpUrl(a.url));
    },
  });
}

export function MoreApps() {
  const { data: apps = [] } = useApps();
  if (apps.length === 0) return null;
  return (
    <div className="more-apps">
      <div className="more-apps-title">More apps, same account</div>
      {apps.map((a) => (
        <a key={a.slug} href={a.url} target="_blank" rel="noreferrer" title={a.tagline ?? undefined}>
          {a.name}
        </a>
      ))}
    </div>
  );
}
