// ISO alpha-2 -> continent, for the countries in countries.ts. Powers the mobility panel chart.
const GROUPS: Record<string, string[]> = {
  Europe: ['AD','AL','AT','BA','BE','BG','BY','CH','CY','CZ','DE','DK','EE','ES','FI','FR','GB','GR','HR','HU','IE','IS','IT','LT','LU','LV','MD','ME','MK','MT','NL','NO','PL','PT','RO','RS','RU','SE','SI','SK','UA'],
  Asia: ['AE','AF','AM','AZ','BD','BH','BN','CN','GE','HK','ID','IL','IN','IQ','IR','JO','JP','KG','KH','KR','KW','KZ','LA','LB','LK','MM','MN','MY','NP','OM','PH','PK','QA','SA','SG','SY','TH','TJ','TM','TR','TW','UZ','VN','YE'],
  Africa: ['AO','BF','BI','BJ','BW','CD','CF','CG','CI','CM','DZ','EG','ER','ET','GA','GH','GN','KE','LR','LY','MA','MG','ML','MZ','NA','NG','RW','SD','SN','SO','TD','TG','TN','TZ','UG','ZA','ZM','ZW'],
  'N. America': ['BZ','CA','CR','CU','DO','GT','HN','HT','JM','MX','NI','PA','SV','TT','US'],
  'S. America': ['AR','BO','BR','CL','CO','EC','GY','PE','PY','SR','UY','VE'],
  Oceania: ['AU','FJ','NZ'],
};

const CODE_TO_CONTINENT = new Map<string, string>();
for (const [continent, codes] of Object.entries(GROUPS)) {
  for (const c of codes) CODE_TO_CONTINENT.set(c, continent);
}

export const CONTINENTS = Object.keys(GROUPS);

export const CONTINENT_COLORS: Record<string, string> = {
  Europe: '#6366f1',
  Asia: '#f59e0b',
  Africa: '#22c55e',
  'N. America': '#22d3ee',
  'S. America': '#ec4899',
  Oceania: '#a3a3a3',
};

export function continentOf(code?: string | null): string | null {
  return code ? (CODE_TO_CONTINENT.get(code) ?? null) : null;
}
