import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { geocode } from '../../lib/geocode';
import { findCountry } from '../../lib/countries';
import { fetchSnapshotDomain, parseMonthYear, pick } from '../import/linkedinPortability';

export interface SelfImportSummary {
  positions: number;
  placed: number;
}

function parsePlace(text: string): {
  city: string | null;
  country: string | null;
  lng: number | null;
  lat: number | null;
} {
  const parts = text.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return { city: null, country: null, lng: null, lat: null };
  const last = parts[parts.length - 1];
  const countryHit = findCountry(last);
  const cityIsCountry = parts.length === 1 && countryHit;
  const city = cityIsCountry ? null : parts[0];
  const g = geocode(city, last);
  return { city, country: countryHit?.code ?? null, lng: g?.lng ?? null, lat: g?.lat ?? null };
}

export function useImportLinkedInSelf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      token,
      version,
    }: {
      token: string;
      version: string;
    }): Promise<SelfImportSummary> => {
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user!.id;

      const profile = (await fetchSnapshotDomain(token, version, 'PROFILE'))[0] ?? {};
      const fullName =
        [pick(profile, 'first name'), pick(profile, 'last name')].filter(Boolean).join(' ').trim() ||
        'Me (LinkedIn)';
      const geo = pick(profile, 'geo location', 'location');
      const headline = pick(profile, 'headline');
      const current = geo ? parsePlace(geo) : { city: null, country: null, lng: null, lat: null };

      // Find or create the self contact (custom.self = true).
      const { data: existing } = await supabase
        .from('contacts')
        .select('id')
        .filter('custom->>self', 'eq', 'true')
        .limit(1);
      const selfRow = {
        user_id: userId,
        full_name: fullName,
        category: 'other' as const,
        source: 'linkedin_csv' as const,
        custom: { self: true, headline },
        current_city: current.city,
        current_country: current.country,
        current_lng: current.lng,
        current_lat: current.lat,
      };

      let selfId: string;
      if (existing && existing.length) {
        selfId = (existing[0] as { id: string }).id;
        const { error } = await supabase.from('contacts').update(selfRow).eq('id', selfId);
        if (error) throw error;
      } else {
        const { data: ins, error } = await supabase
          .from('contacts')
          .insert(selfRow)
          .select('id')
          .single();
        if (error) throw error;
        selfId = (ins as { id: string }).id;
      }

      // Rebuild the LinkedIn-sourced trajectory for self.
      await supabase
        .from('location_history')
        .delete()
        .eq('contact_id', selfId)
        .eq('source', 'linkedin_csv');

      const positions = await fetchSnapshotDomain(token, version, 'POSITIONS');
      const rows: Record<string, unknown>[] = [];
      let placed = 0;
      for (const p of positions) {
        const company = pick(p, 'company');
        const title = pick(p, 'title');
        const locText = pick(p, 'location');
        const place = locText ? parsePlace(locText) : { city: null, country: null, lng: null, lat: null };
        if (place.lng != null) placed++;
        rows.push({
          contact_id: selfId,
          user_id: userId,
          city: place.city,
          country: place.country,
          lng: place.lng,
          lat: place.lat,
          date_from: parseMonthYear(pick(p, 'started')),
          date_to: parseMonthYear(pick(p, 'finished')),
          type: 'work',
          source: 'linkedin_csv',
          note: [title, company].filter(Boolean).join(' @ ') || null,
        });
      }
      if (rows.length) {
        const { error } = await supabase.from('location_history').insert(rows);
        if (error) throw error;
      }

      return { positions: positions.length, placed };
    },
    onSuccess: () =>
      qc.invalidateQueries({
        predicate: (q) => ['contacts', 'location_history'].includes(q.queryKey[0] as string),
      }),
  });
}
