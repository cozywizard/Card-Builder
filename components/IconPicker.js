import { h } from 'https://esm.sh/preact@10.19.6';
import { useState, useEffect, useRef } from 'https://esm.sh/preact@10.19.6/hooks';
import htm from 'https://esm.sh/htm@3.1.1';

const html = htm.bind(h);

// Curated icon sets best suited for card/game art illustration
const ICON_SETS = [
  { id: '',            label: 'All Sets' },
  { id: 'game-icons', label: '🎮 Game Icons' },
  { id: 'fa6-solid',  label: '✦ Font Awesome' },
  { id: 'ph',         label: '◈ Phosphor' },
  { id: 'mdi',        label: '⬡ Material Design' },
  { id: 'lucide',     label: '○ Lucide' },
  { id: 'tabler',     label: '▷ Tabler' },
];

// Default search terms to seed a nice initial result
const DEFAULT_QUERIES = ['sword', 'flame', 'dragon', 'shield', 'skull', 'crown',
                         'potion', 'lightning', 'gem', 'moon', 'star', 'axe'];

// Fetch icon list from Iconify search API
async function searchIconify(query, prefix, limit = 60) {
  let url = `https://api.iconify.design/search?query=${encodeURIComponent(query)}&limit=${limit}`;
  if (prefix) url += `&prefixes=${prefix}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Iconify search failed');
  const data = await res.json();
  return data.icons || []; // array of "prefix:name" strings
}

// Fetch a single SVG from Iconify and return a data-URL string
async function fetchIconSvg(iconId) {
  const [prefix, name] = iconId.split(':');
  const res = await fetch(`https://api.iconify.design/${prefix}/${name}.svg?width=512&height=512`);
  if (!res.ok) throw new Error(`Could not load SVG for ${iconId}`);
  const svgText = await res.text();
  return svgText;
}

export default function IconPicker({ selectedId, onSelectIcon }) {
  const [searchTerm, setSearchTerm]   = useState('flame');
  const [activeSet, setActiveSet]     = useState('');
  const [icons, setIcons]             = useState([]);
  const [loading, setLoading]         = useState(false);
  const [loadingId, setLoadingId]     = useState(null);
  const [error, setError]             = useState(null);
  const debounceRef = useRef(null);

  // Run search whenever term or set changes, with debounce
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (!searchTerm.trim()) return;
      setLoading(true);
      setError(null);
      try {
        const results = await searchIconify(searchTerm.trim(), activeSet, 72);
        setIcons(results);
      } catch (err) {
        setError('Search failed. Check your connection.');
        setIcons([]);
      } finally {
        setLoading(false);
      }
    }, 350);
  }, [searchTerm, activeSet]);

  const handleSelectIcon = async (iconId) => {
    setLoadingId(iconId);
    try {
      const svgText = await fetchIconSvg(iconId);
      onSelectIcon(iconId, svgText);
    } catch {
      alert('Could not load this icon. Please try another.');
    } finally {
      setLoadingId(null);
    }
  };

  return html`
    <div class="icon-picker-container">
      <!-- Search bar -->
      <div class="icon-picker-header">
        <div class="icon-search-wrapper">
          <svg class="icon-search-mag" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text"
            id="iconify-search-input"
            placeholder="Search 275,000+ icons (e.g. dragon, sword, flame)..."
            value=${searchTerm}
            onInput=${(e) => setSearchTerm(e.target.value)}
            class="icon-search-input"
            autofocus
          />
          ${loading && html`<span class="icon-search-spinner"></span>`}
        </div>
        <p class="icon-picker-hint">Powered by <a href="https://iconify.design" target="_blank" rel="noopener" style="color: var(--accent-primary)">Iconify</a> · 275k+ icons from 200+ sets</p>
      </div>

      <!-- Icon set filter chips -->
      <div class="icon-set-chips">
        ${ICON_SETS.map(set => html`
          <button
            type="button"
            class="icon-set-chip ${activeSet === set.id ? 'active' : ''}"
            onClick=${() => setActiveSet(set.id)}
          >
            ${set.label}
          </button>
        `)}
      </div>

      <!-- Results grid -->
      <div class="icon-grid ${loading ? 'icon-grid-loading' : ''}">
        ${error && html`
          <div class="icon-picker-error">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="0.5" fill="currentColor"/>
            </svg>
            <span>${error}</span>
          </div>
        `}

        ${!error && icons.length === 0 && !loading && html`
          <div class="icon-picker-empty">
            <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <span>No icons found. Try a different search term.</span>
          </div>
        `}

        ${icons.map(iconId => {
          const [prefix, name] = iconId.split(':');
          const isSelected = selectedId === iconId;
          const isLoading  = loadingId === iconId;
          return html`
            <button
              type="button"
              class="icon-grid-item ${isSelected ? 'selected' : ''} ${isLoading ? 'loading' : ''}"
              title="${iconId}"
              onClick=${() => handleSelectIcon(iconId)}
              disabled=${!!loadingId}
            >
              <img
                src="https://api.iconify.design/${prefix}/${name}.svg?width=48&height=48&color=%23a5b4fc"
                alt=${name}
                class="icon-grid-img"
                loading="lazy"
                width="40"
                height="40"
              />
              ${isLoading && html`
                <span class="icon-item-spinner"></span>
              `}
              <span class="icon-label">${name.replace(/-/g, ' ')}</span>
            </button>
          `;
        })}
      </div>

      ${icons.length > 0 && html`
        <p class="icon-result-count">${icons.length} results · click an icon to use it as full-frame illustration</p>
      `}
    </div>
  `;
}
