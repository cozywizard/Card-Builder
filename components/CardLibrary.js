import { h } from 'https://esm.sh/preact@10.19.6';
import { useState } from 'https://esm.sh/preact@10.19.6/hooks';
import htm from 'https://esm.sh/htm@3.1.1';
import { CARD_SIZES } from '../utils/binPacker.js';

const html = htm.bind(h);

export default function CardLibrary({ cards, onEditCard, onDuplicateCard, onDeleteCard, onAddCardToSheet }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sizeFilter, setSizeFilter] = useState('all');

  const filteredCards = cards.filter(card => {
    const matchesSearch = 
      card.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (card.description && card.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (card.headline && card.headline.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesSize = sizeFilter === 'all' || card.size === sizeFilter;
    
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
            class="filter-tab ${sizeFilter === 'all' ? 'active' : ''}"
            onClick=${() => setSizeFilter('all')}
          >
            All Sizes
          </button>
          ${Object.entries(CARD_SIZES).map(([key, val]) => html`
            <button
              class="filter-tab ${sizeFilter === key ? 'active' : ''}"
              onClick=${() => setSizeFilter(key)}
            >
              ${val.name}
            </button>
          `)}
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
                    <span class="lib-card-size">${sizeInfo.name} • ${sizeInfo.width}"x${sizeInfo.height}"</span>
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
    </div>
  `;
}
