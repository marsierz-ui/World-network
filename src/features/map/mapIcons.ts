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

/**
 * Radius of the solid disc for the `index`-th concentric flag band (0 = the
 * base layer, drawn at the dot's full radius) so that all `total` bands cover
 * equal shares of the dot's area - a smaller disc painted on top of a larger
 * one only shows as the ring between the two radii. FLAG_COLORS keeps rank
 * order (most of the flag first) but not the actual pixel share, so an equal
 * split is the honest reading rather than inventing one.
 */
export function flagBandRadius(outerRadius: number, index: number, total: number): number {
  return outerRadius * Math.sqrt((total - index) / total);
}
