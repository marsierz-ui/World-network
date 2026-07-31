import { autoMap, rowsToContacts, type ImportItem } from './parseCsv';

// LinkedIn Member Data Portability - Member Snapshot API.
// Called through the Vite dev proxy (/linkedin-api -> https://api.linkedin.com) to avoid CORS.
// Docs: https://learn.microsoft.com/en-us/linkedin/dma/member-data-portability/shared/member-snapshot-api

const BASE = '/linkedin-api/rest/memberSnapshotData';

// LinkedIn only accepts "active" monthly versions; the set rotates. Probe newest-first.
const VERSION_CANDIDATES = [
  '202606', '202605', '202604', '202603', '202602', '202601',
  '202512', '202511', '202510', '202509', '202508', '202507',
  '202506', '202505', '202504', '202503', '202502', '202501',
  '202411', '202408', '202405',
];

// Returns a version the API accepts (first non-426 response). Throws on auth errors.
export async function resolveActiveVersion(token: string, preferred?: string): Promise<string> {
  const tried = new Set<string>();
  const list = [preferred, ...VERSION_CANDIDATES].filter((v): v is string => !!v);
  for (const version of list) {
    if (tried.has(version)) continue;
    tried.add(version);
    const res = await fetch(`${BASE}?q=criteria&domain=PROFILE&start=0`, {
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        'Linkedin-Version': version,
        'Content-Type': 'application/json',
      },
    });
    if (res.status === 401 || res.status === 403) {
      throw new Error(`LinkedIn auth failed (${res.status}). The token is invalid or lacks the r_dma_portability scope.`);
    }
    if (res.status === 426) continue; // version not active - try the next
    return version; // 200 / 400 (no data) / 429 etc. => version is valid
  }
  // The token authenticated but no version of memberSnapshotData is active for it - this
  // means the app behind the token is not provisioned for the Member Data Portability product.
  throw new Error(
    'LinkedIn rejected every API version (426). The token is valid, but its app is not provisioned ' +
      'for the Member Data Portability product. In the LinkedIn developer portal, confirm the product ' +
      'shows "granted" on the app\'s Products tab, then regenerate the token from that app with the ' +
      'r_dma_portability_self_serve scope (EEA/Switzerland members only).',
  );
}

interface SnapshotPage {
  paging?: { start?: number; count?: number; links?: { rel: string; href: string }[] };
  elements?: { snapshotDomain?: string; snapshotData?: Record<string, string>[] }[];
}

// Fetch all snapshotData rows for one domain, following pagination.
export async function fetchSnapshotDomain(
  token: string,
  version: string,
  domain: string,
): Promise<Record<string, string>[]> {
  const rows: Record<string, string>[] = [];
  let start = 0;

  for (let i = 0; i < 200; i++) {
    const url = `${BASE}?q=criteria&domain=${domain}&start=${start}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        'Linkedin-Version': version.trim(),
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      if (start > 0 && res.status === 400) break; // end-of-data signal
      throw new Error(`LinkedIn API ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }

    const data: SnapshotPage = await res.json();
    const snapshot = data.elements?.[0]?.snapshotData ?? [];
    rows.push(...snapshot);

    const next = data.paging?.links?.find((l) => l.rel === 'next');
    if (!next || snapshot.length === 0) break;
    start = (data.paging?.start ?? start) + (data.paging?.count ?? snapshot.length);
  }

  return rows;
}

export const fetchLinkedInConnections = (token: string, version: string) =>
  fetchSnapshotDomain(token, version, 'CONNECTIONS');

// Reuse the CSV mapping/inference pipeline; LinkedIn connection keys mirror the CSV export.
export function linkedinRowsToItems(rows: Record<string, string>[]): ImportItem[] {
  const fields = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  return rowsToContacts(rows, autoMap(fields), 'linkedin_csv');
}

// ---- helpers for the POSITIONS / PROFILE domains (own trajectory) ----

// Tolerant key lookup since exact snapshot key casing can vary.
export function pick(row: Record<string, string>, ...needles: string[]): string {
  for (const [k, v] of Object.entries(row)) {
    const lk = k.toLowerCase();
    if (needles.some((n) => lk.includes(n)) && v?.trim()) return v.trim();
  }
  return '';
}

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

// "Jan 2020" / "2020-01" / "2020" -> "YYYY-MM-01"; empty/"Present" -> null.
export function parseMonthYear(s?: string): string | null {
  if (!s) return null;
  const t = s.trim();
  if (!t || /present|current/i.test(t)) return null;
  let m = t.match(/([A-Za-z]{3})[a-z]*\s+(\d{4})/);
  if (m) return `${m[2]}-${MONTHS[m[1].toLowerCase()] ?? '01'}-01`;
  m = t.match(/(\d{4})[-/](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-01`;
  m = t.match(/(\d{4})/);
  if (m) return `${m[1]}-01-01`;
  return null;
}
