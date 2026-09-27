import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/authContext';
import type { Feedback, FeedbackStatus } from '../../lib/database.types';

const BUCKET = 'feedback';
// Admin page links; long enough to read through a queue, short enough that a
// copied link stops working.
const SIGNED_URL_TTL_S = 60 * 60;

/** Whether the signed-in user may triage feedback (public.admins). */
export function useIsAdmin() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    // Keyed on the user: the answer is cached for good, and another account can
    // sign in on the same tab.
    queryKey: ['is-admin', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('is_admin');
      // Before the migration is applied the function does not exist; that is
      // "not an admin", not an error worth a retry.
      if (error) return false;
      return data === true;
    },
    staleTime: Infinity,
  });
}

export interface FeedbackDraft {
  text: string;
  screenshot: Blob | null;
  page: string;
}

export function useSubmitFeedback() {
  return useMutation({
    mutationFn: async ({ text, screenshot, page }: FeedbackDraft) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error('Sign in to send feedback.');

      // The bucket policy only accepts uploads under the sender's own folder.
      let screenshotPath: string | null = null;
      if (screenshot) {
        const path = `${u.user.id}/${crypto.randomUUID()}.jpg`;
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(path, screenshot, { contentType: 'image/jpeg', upsert: false });
        if (error) throw error;
        screenshotPath = path;
      }

      const { error } = await supabase.from('feedback').insert({
        text,
        screenshot_path: screenshotPath,
        page,
        user_agent: navigator.userAgent.slice(0, 400),
        viewport: `${window.innerWidth}x${window.innerHeight}@${window.devicePixelRatio}`,
      });
      if (error) throw error;
    },
  });
}

export interface AdminFeedback extends Feedback {
  screenshot_url: string | null;
}

export function useAdminFeedback() {
  return useQuery({
    queryKey: ['admin-feedback'],
    queryFn: async (): Promise<AdminFeedback[]> => {
      const { data, error } = await supabase
        .from('feedback')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300);
      if (error) throw error;
      const rows = (data ?? []) as Feedback[];

      const paths = rows.map((r) => r.screenshot_path).filter((p): p is string => !!p);
      const urls = new Map<string, string>();
      if (paths.length) {
        const { data: signed } = await supabase.storage
          .from(BUCKET)
          .createSignedUrls(paths, SIGNED_URL_TTL_S);
        for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
      }
      return rows.map((r) => ({
        ...r,
        screenshot_url: r.screenshot_path ? urls.get(r.screenshot_path) ?? null : null,
      }));
    },
  });
}

export interface FeedbackTriage {
  status: FeedbackStatus;
  category: string | null;
  admin_note: string | null;
}

export function useUpdateFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: FeedbackTriage }) => {
      const { error } = await supabase.from('feedback').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-feedback'] }),
  });
}

export const AGENT_MODELS = ['opus', 'sonnet', 'haiku'] as const;
export const AGENT_EFFORTS = ['low', 'medium', 'high', 'xhigh'] as const;

export interface DispatchOptions {
  id: number;
  model: (typeof AGENT_MODELS)[number];
  effort: (typeof AGENT_EFFORTS)[number];
  comment: string;
}

/** Hands one item to the AI agent (feedback-dispatch -> feedback-agent.yml). */
export function useDispatchFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, model, effort, comment }: DispatchOptions) => {
      const { data, error } = await supabase.functions.invoke<{ ok: boolean; error?: string }>(
        'feedback-dispatch',
        { body: { feedback_id: id, model, effort, comment } },
      );
      if (error) {
        // supabase-js hides the function's own message behind a generic one;
        // the body says what is actually wrong (missing secret, GitHub 404...).
        const body = await (error as { context?: Response }).context?.json?.().catch(() => null);
        throw new Error(body?.error ?? error.message);
      }
      if (!data?.ok) throw new Error(data?.error ?? 'Dispatch failed');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-feedback'] }),
  });
}
