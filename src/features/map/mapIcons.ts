import type { ContactCategory } from '../../lib/database.types';

export const CATEGORY_RGB: Record<ContactCategory, [number, number, number]> = {
  work: [245, 158, 11],
  private: [34, 197, 94],
  other: [100, 116, 139],
};

export const CATEGORY_HEX: Record<ContactCategory, string> = {
  work: '#f59e0b',
  private: '#22c55e',
  other: '#64748b',
};
