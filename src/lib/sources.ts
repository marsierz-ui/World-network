import type { ContactSource } from './database.types';

export const SOURCE_LABEL: Record<ContactSource, string> = {
  manual: 'Manual',
  google: 'Google',
  csv: 'CSV',
  linkedin_csv: 'LinkedIn',
};
