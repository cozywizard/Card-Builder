import { h } from 'https://esm.sh/preact@10.19.6';
import { useState } from 'https://esm.sh/preact@10.19.6/hooks';
import htm from 'https://esm.sh/htm@3.1.1';
import { CARD_SIZES, CARD_TYPES } from '../utils/binPacker.js';
import { fetchCsv, parseCsvToRows } from '../utils/googleSheets.js';

const html = htm.bind(h);

export default function CardLibrary({ cards, onEditCard, onDuplicateCard, onDeleteCard, onAddCardToSheet, onBulkImport, onGoToSheetBuilder, cardTypeDefaults, setCardTypeDefaults }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importTab, setImportTab] = useState('file'); // 'file' | 'url'
  const [importCsvUrl, setImportCsvUrl] = useState('');
  const [importAllRows, setImportAllRows] = useState([]);
  const [importQuantities, setImportQuantities] = useState({});
  const [importing, setImporting] = useState(false);
  const [showDefaultsEditor, setShowDefaultsEditor] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const [fetchingPreview, setFetchingPreview] = useState(false);

  const filteredCards = cards.filter(card => {
    const matchesSearch = 
      card.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (card.description && card.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (card.headline && card.headline.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesSize = typeFilter === 'all' || (card.cardType === typeFilter) || (card.size === typeFilter);
    
    return matchesSearch && matchesSize;
  });

  return html`
    <div class="library-container">
      <!-- Library Filters and Search Panel -->
      <div class="library-header-controls glass-panel">
        <div class="search-input-wrapper">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" class="search-icon">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Search saved templates..."
            value=${searchTerm}
            onInput=${(e) => setSearchTerm(e.target.value)}
            class="library-search-input"
          />
        </div>

        <div class="size-filter-tabs">
          <button
            class="filter-tab ${typeFilter === 'all' ? 'active' : ''}"
            onClick=${() => setTypeFilter('all')}
          >
            All Types
          </button>
          ${Object.entries(CARD_TYPES).map(([key, val]) => html`
            <button
              class="filter-tab ${typeFilter === key ? 'active' : ''}"
              onClick=${() => setTypeFilter(key)}
            >
              ${val.name}
            </button>
          `)}

          <div style="margin-left:12px; display:inline-flex; gap:8px;">
            <button class="lib-action-btn secondary-btn" onClick=${() => setShowImportModal(true)}>Import</button>
            <button class="lib-action-btn secondary-btn" onClick=${() => setShowDefaultsEditor(true)}>Type Defaults</button>
          </div>
        </div>
      </div>

      <!-- Library Grid -->
      ${filteredCards.length > 0 ? html`
        <div class="library-grid animate-fade-in">
          ${filteredCards.map(card => {
            const sizeInfo = CARD_SIZES[card.size] || CARD_SIZES['poker'];
            return html`
              <div 
                class="library-card-item glass-panel" 
                style="--card-border-glow: ${card.themeColor || '#6366f1'}"
              >
                <!-- Mini Card Header representation -->
                <div 
                  class="library-card-header-bar" 
                  style="background: ${card.bgColor || '#1e1e24'}; border-bottom: 2px solid ${card.themeColor || '#6366f1'}"
                >
                  <div class="library-card-title-group">
                    <span class="lib-card-title" style="color: ${card.textColor || '#ffffff'}">${card.title}</span>
                    <span class="lib-card-size">${(CARD_TYPES[card.cardType] && CARD_TYPES[card.cardType].name) || sizeInfo.name} • ${sizeInfo.width}"x${sizeInfo.height}"</span>
                  </div>
                  <div class="lib-card-icon-indicator" style="color: ${card.themeColor || '#6366f1'}">
                    ${card.iconType === 'upload' && card.iconUpload ? html`
                      <img src=${card.iconUpload} class="lib-icon-preview" alt="icon" />
                    ` : card.iconSvgPath ? html`
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                        <path d=${card.iconSvgPath} />
                      </svg>
                    ` : null}
                  </div>
                </div>

                <!-- Mini Card Description representation -->
                <div class="library-card-body-preview">
                  <p class="lib-card-desc-text">
                    ${card.description ? (card.description.length > 85 ? card.description.substring(0, 85) + '...' : card.description) : html`<i>No description provided</i>`}
                  </p>
                  
                  <div class="lib-card-callouts">
                    ${card.bottomLeft && html`
                      <span class="lib-callout">${card.bottomLeft}</span>
                    `}
                    ${card.bottomRight && html`
                      <span class="lib-callout">${card.bottomRight}</span>
                    `}
                  </div>
                </div>

                <!-- Action Button Overlay -->
                <div class="library-card-actions">
                  <button 
                    class="lib-action-btn primary-glow-btn add-sheet-btn" 
                    onClick=${() => onAddCardToSheet(card)}
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" class="margin-right-xs">
                      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    Add to Sheet
                  </button>

                  <div class="secondary-actions-row">
                    <button 
                      class="lib-action-btn secondary-btn" 
                      onClick=${() => onEditCard(card)}
                      title="Edit template"
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" class="margin-right-xs">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                      Edit
                    </button>
                    
                    <button 
                      class="lib-action-btn secondary-btn" 
                      onClick=${() => onDuplicateCard(card)}
                      title="Duplicate card template"
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" class="margin-right-xs">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                      </svg>
                      Copy
                    </button>
                    
                    <button 
                      class="lib-action-btn delete-btn" 
                      onClick=${() => {
                        if (confirm(`Are you sure you want to delete "${card.title}"?`)) {
                          onDeleteCard(card.id);
                        }
                      }}
                      title="Delete card template"
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            `;
          })}
        </div>
      ` : html`
        <div class="empty-library-state glass-panel">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1" class="empty-icon animate-pulse">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21" />
          </svg>
          <h3>Your Library is Empty</h3>
          <p>You haven't saved any custom card templates yet. Create your first epic game card in the "Card Creator" to get started!</p>
        </div>
      `}

      ${showImportModal && html`
        <div class="modal-overlay z-index-top">
          <div class="modal-content glass-panel import-modal" style="max-width:620px;">
            <h3>Import Cards from CSV</h3>
            ${!importAllRows.length && !importSuccess && html`
              <div>
                <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:12px;">Expected columns: <code style="font-size:0.8rem; background:rgba(255,255,255,0.06); padding:1px 4px; border-radius:3px;">title, cardtype, description, headline, bottomleft, bottomright, bgcolor, textcolor, themecolor, iconid, cardart, cardbackimage</code></p>

                <!-- Tab switcher -->
                <div style="display:flex; gap:0; border:1px solid var(--border-color); border-radius:6px; overflow:hidden; margin-bottom:14px; width:fit-content;">
                  <button
                    style="padding:6px 16px; font-size:0.85rem; border:none; cursor:pointer; transition:var(--transition-fast); background:${importTab === 'file' ? 'var(--accent-primary)' : 'transparent'}; color:${importTab === 'file' ? '#fff' : 'var(--text-secondary)'};"
                    onClick=${() => { setImportTab('file'); setImportError(''); }}
                  >Upload File</button>
                  <button
                    style="padding:6px 16px; font-size:0.85rem; border:none; cursor:pointer; transition:var(--transition-fast); background:${importTab === 'url' ? 'var(--accent-primary)' : 'transparent'}; color:${importTab === 'url' ? '#fff' : 'var(--text-secondary)'};"
                    onClick=${() => { setImportTab('url'); setImportError(''); }}
                  >URL</button>
                </div>

                ${importTab === 'file' && html`
                  <div>
                    <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:10px;">
                      In Google Sheets: <strong>File → Download → Comma Separated Values (.csv)</strong>, then select the file below.
                    </p>
                    <label style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; border:2px dashed var(--border-glow); border-radius:8px; padding:28px 16px; cursor:pointer; transition:var(--transition-fast); background:rgba(99,102,241,0.04);"
                      onDragOver=${(e) => e.preventDefault()}
                      onDrop=${async (e) => {
                        e.preventDefault();
                        setImportError('');
                        const file = e.dataTransfer.files[0];
                        if (!file) return;
                        if (!file.name.endsWith('.csv') && file.type !== 'text/csv') { setImportError('Please drop a .csv file'); return; }
                        const text = await file.text();
                        const norm = parseCsvToRows(text).map(r => { const out = {}; Object.keys(r).forEach(k => out[k.toLowerCase().trim()] = r[k]); return out; });
                        if (!norm.length) { setImportError('CSV file is empty'); return; }
                        setImportAllRows(norm);
                        const initQty = {};
                        norm.forEach((_, i) => { initQty[i] = 1; });
                        setImportQuantities(initQty);
                      }}
                    >
                      <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--accent-primary);">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                      <span style="font-size:0.9rem; color:var(--text-primary);">Drop CSV here or click to browse</span>
                      <input type="file" accept=".csv,text/csv" style="position:absolute; opacity:0; pointer-events:none;" onChange=${async (e) => {
                        setImportError('');
                        const file = e.target.files[0];
                        if (!file) return;
                        const text = await file.text();
                        const norm = parseCsvToRows(text).map(r => { const out = {}; Object.keys(r).forEach(k => out[k.toLowerCase().trim()] = r[k]); return out; });
                        if (!norm.length) { setImportError('CSV file is empty'); return; }
                        setImportAllRows(norm);
                        const initQty = {};
                        norm.forEach((_, i) => { initQty[i] = 1; });
                        setImportQuantities(initQty);
                        e.target.value = '';
                      }} />
                    </label>
                  </div>
                `}

                ${importTab === 'url' && html`
                  <div>
                    <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:8px;">
                      The sheet must be set to <strong>"Anyone with the link can view"</strong>. Use the export URL format below.
                    </p>
                    <input type="text" class="form-text-input" placeholder="https://docs.google.com/spreadsheets/d/{ID}/export?format=csv&gid={GID}" value=${importCsvUrl} onInput=${(e) => { setImportCsvUrl(e.target.value); setImportError(''); }} />
                  </div>
                `}

                ${importError && html`<div style="color:#f43f5e; font-size:0.85rem; margin-top:8px;">${importError}</div>`}

                <div style="margin-top:14px; display:flex; gap:8px;">
                  ${importTab === 'url' && html`
                    <button class="lib-action-btn primary-glow-btn" onClick=${async () => {
                      if (!importCsvUrl.trim()) { setImportError('Please enter a CSV export URL'); return; }
                      setFetchingPreview(true);
                      setImportError('');
                      try {
                        const rows = await fetchCsv(importCsvUrl.trim());
                        if (rows.length === 0) { setImportError('CSV is empty'); setFetchingPreview(false); return; }
                        const norm = rows.map(r => { const out = {}; Object.keys(r).forEach(k => out[k.toLowerCase().trim()] = r[k]); return out; });
                        setImportAllRows(norm);
                        const initQty = {};
                        norm.forEach((_, i) => { initQty[i] = 1; });
                        setImportQuantities(initQty);
                      } catch (err) {
                        setImportError('Failed to fetch CSV: ' + (err.message || err));
                      } finally { setFetchingPreview(false); }
                    }} disabled=${fetchingPreview}>${fetchingPreview ? 'Fetching...' : 'Fetch & Preview'}</button>
                  `}
                  <button class="lib-action-btn secondary-btn" onClick=${() => { setShowImportModal(false); setImportError(''); setImportSuccess(''); setImportTab('file'); }}>Close</button>
                </div>
              </div>
            `}

            ${importSuccess && html`
              <div style="background:rgba(16,185,129,0.1); border:1px solid #10b981; border-radius:4px; padding:12px; margin-bottom:12px;">
                <p style="color:#10b981; font-weight:500;">${importSuccess}</p>
              </div>
              <div style="display:flex; gap:8px;">
                ${onGoToSheetBuilder && html`
                  <button class="lib-action-btn primary-glow-btn" onClick=${() => { setShowImportModal(false); setImportError(''); setImportSuccess(''); setImportAllRows([]); setImportQuantities({}); setImportTab('file'); onGoToSheetBuilder(); }}>View Sheets</button>
                `}
                <button class="lib-action-btn secondary-btn" onClick=${() => { setShowImportModal(false); setImportError(''); setImportSuccess(''); setImportAllRows([]); setImportQuantities({}); setImportTab('file'); }}>Done</button>
              </div>
            `}

            ${importAllRows.length > 0 && !importSuccess && html`
              <div style="margin-top:12px;">
                <h4 style="margin-bottom:8px;">Configure Import (${importAllRows.length} card${importAllRows.length !== 1 ? 's' : ''})</h4>
                <p style="font-size:0.82rem; color:var(--text-secondary); margin-bottom:8px;">Set the <strong>Qty</strong> column to control how many copies of each card are placed on the print sheets. Set to 0 to import to library only.</p>
                <div style="border:1px solid rgba(255,255,255,0.1); border-radius:4px; overflow:auto; max-height:280px;">
                  <table style="width:100%; font-size:0.8rem; border-collapse:collapse;">
                    <thead style="position:sticky; top:0; background:rgba(15,18,37,0.95); z-index:1;">
                      <tr>
                        <th style="padding:6px 8px; text-align:center; border-bottom:1px solid rgba(255,255,255,0.1); color:var(--accent-primary); white-space:nowrap; min-width:60px;">Qty</th>
                        ${Object.keys(importAllRows[0]).map(col => html`<th style="padding:6px 8px; text-align:left; border-bottom:1px solid rgba(255,255,255,0.1); white-space:nowrap;">${col}</th>`)}
                      </tr>
                    </thead>
                    <tbody>
                      ${importAllRows.map((row, idx) => html`
                        <tr style="${idx % 2 === 0 ? 'background:rgba(255,255,255,0.02);' : ''}">
                          <td style="padding:4px 8px; border-bottom:1px solid rgba(255,255,255,0.05); text-align:center;">
                            <input
                              type="number"
                              min="0"
                              max="99"
                              value=${importQuantities[idx] ?? 1}
                              onInput=${(e) => {
                                const val = Math.max(0, parseInt(e.target.value) || 0);
                                setImportQuantities(prev => ({ ...prev, [idx]: val }));
                              }}
                              style="width:52px; padding:2px 4px; background:rgba(99,102,241,0.1); border:1px solid var(--border-color); border-radius:4px; color:var(--text-primary); text-align:center; font-size:0.85rem;"
                            />
                          </td>
                          ${Object.keys(row).map(k => html`<td style="padding:6px 8px; border-bottom:1px solid rgba(255,255,255,0.05); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:120px;">${row[k] || '(empty)'}</td>`)}
                        </tr>
                      `)}
                    </tbody>
                  </table>
                </div>
                <div style="margin-top:12px; display:flex; gap:8px; align-items:center;">
                  <button class="lib-action-btn primary-glow-btn" onClick=${async () => {
                    if (!onBulkImport) { setImportError('Bulk import handler not available'); return; }
                    setImporting(true);
                    setImportError('');
                    try {
                      const quantities = importAllRows.map((_, i) => Number(importQuantities[i] ?? 1));
                      const res = await onBulkImport(importAllRows, quantities);
                      const sheetMsg = res.sheetsCreated > 0 ? ` Placed on ${res.sheetsCreated} sheet${res.sheetsCreated !== 1 ? 's' : ''}.` : '';
                      setImportSuccess(`Successfully imported ${res.imported} card${res.imported !== 1 ? 's' : ''}${sheetMsg}${res.errors.length > 0 ? ' (' + res.errors.length + ' rows had errors).' : ''}`);
                      setImportAllRows([]);
                      setImportQuantities({});
                    } catch (err) {
                      setImportError('Import failed: ' + (err.message || err));
                    } finally { setImporting(false); }
                  }} disabled=${importing}>${importing ? 'Importing...' : 'Import All'}</button>
                  <button class="lib-action-btn secondary-btn" onClick=${() => { setImportAllRows([]); setImportQuantities({}); setImportError(''); }}>Back</button>
                  <span style="font-size:0.8rem; color:var(--text-muted); margin-left:4px;">
                    Total copies: ${importAllRows.reduce((sum, _, i) => sum + (Number(importQuantities[i] ?? 1)), 0)}
                  </span>
                </div>
              </div>
            `}
          </div>
        </div>
      `}

      ${showDefaultsEditor && html`
        <div class="modal-overlay z-index-top">
          <div class="modal-content glass-panel import-modal">
            <h3>Card Type Defaults</h3>
            <p>Set a default back image URL for each card type. Cards without an explicit back will use these.</p>
            ${Object.entries(CARD_TYPES).map(([key, val]) => html`
              <div style="margin-bottom:8px;">
                <label class="input-label">${val.name} Back Image URL</label>
                <input type="text" class="form-text-input" value=${(cardTypeDefaults && cardTypeDefaults[key]) || ''} onInput=${(e) => {
                  const v = e.target.value;
                  setCardTypeDefaults(prev => ({ ...(prev||{}), [key]: v }));
                }} />
              </div>
            `)}
            <div style="margin-top:8px; display:flex; gap:8px;">
              <button class="lib-action-btn primary-glow-btn" onClick=${() => setShowDefaultsEditor(false)}>Save</button>
              <button class="lib-action-btn secondary-btn" onClick=${() => setShowDefaultsEditor(false)}>Close</button>
            </div>
          </div>
        </div>
      `}
    </div>
  `;
}
