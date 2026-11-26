import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useProfile } from '../profile/useProfile';
import { parseLook, type BallLook } from './look';
import { matchLocal, type LocalMatch } from '../../lib/localFlags';

// Until the countryball migration is applied the profiles table has no avatar
// column: the look then lives in this browser only, and saving never fails.
const KEY = 'ct.ball.look';
const SEEN_KEY = 'ct.ball.setup-seen';

function readLocal(): BallLook | null {
  try {
    return parseLook(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
  } catch {
    return null;
  }
}

function writeLocal(look: BallLook) {
  try {
    localStorage.setItem(KEY, JSON.stringify(look));
  } catch {
    // private mode: the database copy (if any) still holds it
  }
}

export function setupSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return true;
  }
}

export function markSetupSeen() {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // ignore
  }
}

/** The signed-in member's own look: database first, then this browser, else null (not customised). */
export function useMyBallLook() {
  const { data: profile } = useProfile();
  const remote = parseLook((profile as { avatar?: unknown } | null | undefined)?.avatar);
  const look = remote ?? readLocal();
  // The flag on the ball: the member's choice, else their home or current country.
  const country = look?.country ?? profile?.home_country ?? profile?.current_country ?? null;
  // Region and city flags of the member's home, for the "Local flag" choice.
  const home: LocalMatch = profile
    ? matchLocal({ country: profile.home_country, city: profile.home_city, lng: profile.home_lng, lat: profile.home_lat })
    : { region: null, city: null };
  return { look, country, profile, home };
}

export function useSaveBallLook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (look: BallLook) => {
      writeLocal(look);
      markSetupSeen();
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return { remote: false };
      const { error } = await supabase
        .from('profiles')
        .update({ avatar: look } as never)
        .eq('user_id', u.user.id);
      // 42703 / PGRST204: the avatar column does not exist yet. Keep the local copy.
      return { remote: !error };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  });
}

/**
 * Looks of linked members, keyed by the caller's contact id for them. Members
 * who never customised are absent, and so is everyone before the migration:
 * they all stay plain countryballs.
 */
export function useLinkedLooks() {
  return useQuery({
    queryKey: ['linked_avatars'],
    retry: false,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Map<string, BallLook>> => {
      const { data, error } = await supabase.rpc('linked_avatars' as never);
      if (error || !Array.isArray(data)) return new Map();
      const out = new Map<string, BallLook>();
      for (const row of data as { contact_id: string; avatar: unknown }[]) {
        const look = parseLook(row.avatar);
        if (look) out.set(row.contact_id, look);
      }
      return out;
    },
  });
}
