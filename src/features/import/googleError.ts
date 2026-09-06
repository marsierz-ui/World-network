// People API failures carry the fix in the response body, so the body is parsed
// once, here, instead of being pattern-matched from a message string later.
//
// The case this exists for: a Google Cloud project with the People API switched
// off answers every call with 403 SERVICE_DISABLED and an activationUrl that
// turns it on. Showing that link is the difference between "sync failed" and a
// problem the user can actually fix.

export interface GoogleErrorDetail {
  reason?: string;
  metadata?: { activationUrl?: string; service?: string; consumer?: string };
}

export class GoogleApiError extends Error {
  readonly status: number;
  /** Google's machine-readable reason, e.g. SERVICE_DISABLED, ACCESS_TOKEN_EXPIRED. */
  readonly reason: string | null;
  /** Console page that fixes the problem, when Google names one. */
  readonly helpUrl: string | null;

  constructor(status: number, reason: string | null, message: string, helpUrl: string | null) {
    // The prefix is what the rest of the app has always logged; keeping it means
    // an unhandled error still reads the same in the console.
    super(`People API ${status}: ${message}`);
    this.name = 'GoogleApiError';
    this.status = status;
    this.reason = reason;
    this.helpUrl = helpUrl;
  }
}

export function googleApiError(status: number, body: string): GoogleApiError {
  let reason: string | null = null;
  let helpUrl: string | null = null;
  let message = body.slice(0, 300);

  try {
    const parsed = JSON.parse(body) as {
      error?: { message?: string; status?: string; details?: GoogleErrorDetail[] };
    };
    const err = parsed.error;
    if (err) {
      message = err.message ?? message;
      for (const d of err.details ?? []) {
        reason ??= d.reason ?? null;
        helpUrl ??= d.metadata?.activationUrl ?? null;
      }
      reason ??= err.status ?? null;
    }
  } catch {
    // Not JSON (an HTML error page from a proxy, say): keep the raw text.
  }

  // Older People API responses put the activation link in the prose only.
  if (!helpUrl) {
    helpUrl = message.match(/https:\/\/console\.(?:developers|cloud)\.google\.com\/\S+/)?.[0] ?? null;
    if (helpUrl) helpUrl = helpUrl.replace(/[.,)]+$/, '');
  }

  return new GoogleApiError(status, reason, message, helpUrl);
}

/** Turn any thrown value into text plus, when there is one, a link that fixes it. */
export function describeGoogleError(e: unknown): { text: string; url: string | null } {
  if (e instanceof GoogleApiError) {
    if (e.status === 401) {
      return { text: 'Google session expired. Click "Connect Google" and sync again.', url: null };
    }
    if (e.reason === 'SERVICE_DISABLED' || /has not been used in project|is disabled/.test(e.message)) {
      return {
        text:
          'The Google People API is switched off in the Google Cloud project behind your OAuth ' +
          'client. Enable it, wait a minute for Google to propagate it, then sync again.',
        url: e.helpUrl ?? 'https://console.cloud.google.com/apis/library/people.googleapis.com',
      };
    }
    if (e.status === 403) {
      return {
        text:
          'Google refused the request. Re-connect Google and make sure the contacts permission ' +
          `is ticked. (${e.message})`,
        url: e.helpUrl,
      };
    }
    if (e.status === 429) {
      return { text: 'Google rate-limited the sync. Try again in a few minutes.', url: null };
    }
    return { text: `Sync failed: ${e.message}`, url: e.helpUrl };
  }
  return { text: `Sync failed: ${(e as Error).message}`, url: null };
}
