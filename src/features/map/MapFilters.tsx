import type { ContactCategory, Tag } from '../../lib/database.types';
import { COUNTRIES, COUNTRY_BY_CODE } from '../../lib/countries';
import { ComboSelect } from '../../components/ComboSelect';
import { useMapStore } from './mapStore';

const CATEGORIES: ContactCategory[] = ['work', 'private', 'other'];

export function MapFilters({ tags, countriesPresent }: { tags: Tag[]; countriesPresent: Set<string> }) {
  const viewMode = useMapStore((s) => s.viewMode);
  const locationBasis = useMapStore((s) => s.locationBasis);
  const categories = useMapStore((s) => s.categories);
  const countries = useMapStore((s) => s.countries);
  const tagId = useMapStore((s) => s.tagId);
  const colorBy = useMapStore((s) => s.colorBy);
  const setColorBy = useMapStore((s) => s.setColorBy);
  const setViewMode = useMapStore((s) => s.setViewMode);
  const setLocationBasis = useMapStore((s) => s.setLocationBasis);
  const toggleCategory = useMapStore((s) => s.toggleCategory);
  const toggleCountry = useMapStore((s) => s.toggleCountry);
  const clearCountries = useMapStore((s) => s.clearCountries);
  const setTagId = useMapStore((s) => s.setTagId);

  // Only offer countries that actually have contacts on the current basis.
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
        <div className="section-label">Place by</div>
        <div className="view-toggle">
          <button
            className={locationBasis === 'current' ? 'seg active' : 'seg'}
            onClick={() => setLocationBasis('current')}
            title="Where each contact lives now"
          >
            Current
          </button>
          <button
            className={locationBasis === 'origin' ? 'seg active' : 'seg'}
            onClick={() => setLocationBasis('origin')}
            title="Where each contact is originally from"
          >
            Origin
          </button>
        </div>
        {locationBasis === 'origin' && (
          <div className="muted small">
            Origin is a country, not a city, so contacts sit on the country centre - one dot per
            country.
          </div>
        )}
      </div>

      <div className="filter-group">
        <div className="section-label">Colour dots by</div>
        <div className="view-toggle">
          <button
            className={colorBy === 'category' ? 'seg active' : 'seg'}
            onClick={() => setColorBy('category')}
            title="Work / private / other, or the sublabel under a filtered label"
          >
            Category
          </button>
          <button
            className={colorBy === 'flag' ? 'seg active' : 'seg'}
            onClick={() => setColorBy('flag')}
            title="The colours of the flag of the country the dot sits in"
          >
            Flag
          </button>
        </div>
        {colorBy === 'flag' && (
          <div className="muted small">
            Fill and ring are the two main colours of the flag. Dots with no country keep their
            category colour.
          </div>
        )}
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
        <div className="section-label">
          Countries
          {countries.size > 0 && (
            <button className="link filter-clear" onClick={clearCountries}>clear</button>
          )}
        </div>
        {countries.size > 0 && (
          <div className="chips">
            {[...countries].map((code) => (
              <span key={code} className="chip">
                {COUNTRY_BY_CODE.get(code)?.name ?? code}
                <button className="x" onClick={() => toggleCountry(code)} title="Remove">x</button>
              </span>
            ))}
          </div>
        )}
        <ComboSelect
          // Always renders as the placeholder: picking adds to the set above
          // rather than replacing a single selection.
          options={countryOptions.map((c) => ({
            value: c.code,
            label: c.name,
            hint: countries.has(c.code) ? 'added' : undefined,
          }))}
          value=""
          onChange={(code) => { if (code) toggleCountry(code); }}
          emptyLabel={countries.size ? 'Add another country...' : 'All countries'}
          placeholder="Search countries..."
        />
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
