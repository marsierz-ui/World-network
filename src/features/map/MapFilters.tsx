import type { ContactCategory } from '../../lib/database.types';
import { COUNTRIES } from '../../lib/countries';
import type { Tag } from '../../lib/database.types';
import { useMapStore } from './mapStore';

const CATEGORIES: ContactCategory[] = ['work', 'private', 'other'];

export function MapFilters({ tags, countriesPresent }: { tags: Tag[]; countriesPresent: Set<string> }) {
  const { viewMode, categories, country, tagId, setViewMode, toggleCategory, setCountry, setTagId } =
    useMapStore();

  const countryOptions = COUNTRIES.filter((c) => countriesPresent.has(c.code));

  return (
    <div className="map-filters">
      <div className="view-toggle">
        <button
          className={viewMode === 'cosmopolitan' ? 'seg active' : 'seg'}
          onClick={() => setViewMode('cosmopolitan')}
        >
          Cosmopolitan
        </button>
        <button
          className={viewMode === 'homelover' ? 'seg active' : 'seg'}
          onClick={() => setViewMode('homelover')}
        >
          Homelover
        </button>
      </div>

      <div className="filter-group">
        <div className="section-label">Category</div>
        {CATEGORIES.map((c) => (
          <label key={c} className="check">
            <input
              type="checkbox"
              checked={categories.size === 0 || categories.has(c)}
              onChange={() => toggleCategory(c)}
            />
            <span className={`pill ${c}`}>{c}</span>
          </label>
        ))}
      </div>

      <div className="filter-group">
        <div className="section-label">Country</div>
        <select value={country} onChange={(e) => setCountry(e.target.value)}>
          <option value="">All countries</option>
          {countryOptions.map((c) => (
            <option key={c.code} value={c.code}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <div className="section-label">Tag / community</div>
        <select value={tagId} onChange={(e) => setTagId(e.target.value)}>
          <option value="">All</option>
          {tags.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
