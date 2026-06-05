import { h } from 'https://esm.sh/preact@10.19.6';
import { useState, useRef } from 'https://esm.sh/preact@10.19.6/hooks';
import htm from 'https://esm.sh/htm@3.1.1';
import { packCards, getNextAvailablePosition, SHEET_WIDTH, SHEET_HEIGHT, MARGIN, CARD_SIZES } from '../utils/binPacker.js';
import CardPreview from './CardPreview.js';

const html = htm.bind(h);

// Renders a real CardPreview scaled down to fit the pixel slot on the sheet canvas.
// `slotW` and `slotH` are in pixels (the positioned-card-canvas dimensions).
function ScaledCardPreview({ card, slotW, slotH, forceSide }) {
  // CardPreview renders at a fixed container width of 320px.
  // Derive the natural preview height from the card's aspect ratio.
  const sizeInfo = CARD_SIZES[card.size] || CARD_SIZES['poker'];
  const aspect = sizeInfo.width / sizeInfo.height;
  const PREVIEW_W = 320;
  const PREVIEW_H = Math.round(PREVIEW_W / aspect);

  // Scale factor to shrink the 320×PREVIEW_H render into the slot.
  const scaleX = slotW / PREVIEW_W;
  const scaleY = slotH / PREVIEW_H;
  const scale = Math.min(scaleX, scaleY);

  return html`
    <div style="
      width: ${slotW}px;
      height: ${slotH}px;
      overflow: hidden;
      position: relative;
      pointer-events: none;
    ">
      <div style="
        position: absolute;
        top: 0;
        left: 0;
        width: ${PREVIEW_W}px;
        height: ${PREVIEW_H}px;
        transform: scale(${scale});
        transform-origin: top left;
      ">
        <${CardPreview} card=${card} forceSide=${forceSide} />
      </div>
    </div>
  `;
}

// Screen coordinates: 80 pixels = 1 inch
const SCALE = 80; 
const PAGE_WIDTH_PX = SHEET_WIDTH * SCALE; // 680px
const PAGE_HEIGHT_PX = SHEET_HEIGHT * SCALE; // 880px
const MARGIN_PX = MARGIN * SCALE; // 20px

export default function CardSheetBuilder({ 
  libraryCards, 
  sheetItems, 
  setSheetItems,
  onExportPDF,
  activeSheetIndex,
  setActiveSheetIndex,
  sheetCount,
  setSheetCount
}) {
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [viewMode, setViewMode] = useState('front'); // front, back, split (side-by-side)
  
  // Dragging state tracking
  const [dragItem, setDragItem] = useState(null); // { id, startX, startY, offsetX, offsetY }
  const pageContainerRef = useRef(null);

  // Auto-pack layout trigger
  const handleAutoPack = () => {
    if (sheetItems.length === 0) return;
    const packedSheets = packCards(sheetItems);
    
    // We rebuild our sheetItems array with the packed sheet coordinates
    const newItems = [];
    packedSheets.forEach((sheet, sheetIdx) => {
      sheet.cards.forEach(cardItem => {
        newItems.push({
          id: cardItem.id,
          card: cardItem.card,
          sheetIndex: sheetIdx,
          x: cardItem.x,
          y: cardItem.y,
          w: cardItem.w,
          h: cardItem.h
        });
      });
    });
    setSheetItems(newItems);
    if (packedSheets.length > 0) {
      setSheetCount(packedSheets.length);
      setActiveSheetIndex(Math.min(activeSheetIndex, packedSheets.length - 1));
    }
  };

  const handleAddCardInstance = (card) => {
    const sizeInfo = CARD_SIZES[card.size] || CARD_SIZES['poker'];
    const currentPageItems = sheetItems.filter(item => item.sheetIndex === activeSheetIndex);
    const nextPosition = getNextAvailablePosition(currentPageItems, sizeInfo.width, sizeInfo.height);

    let targetSheet = activeSheetIndex;
    let position = { x: MARGIN, y: MARGIN };

    if (nextPosition) {
      position = nextPosition;
    } else {
      targetSheet = sheetCount;
      setSheetCount(sheetCount + 1);
      setActiveSheetIndex(targetSheet);
    }

    const newInstance = {
      id: `instance-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      card: card,
      sheetIndex: targetSheet,
      x: position.x,
      y: position.y,
      w: sizeInfo.width,
      h: sizeInfo.height
    };
    
    setSheetItems([...sheetItems, newInstance]);
    setShowAddDrawer(false);
  };

  const handleRemoveInstance = (id, e) => {
    e.stopPropagation();
    setSheetItems(sheetItems.filter(item => item.id !== id));
  };

  // --- Drag and Drop Handlers ---
  const handleMouseDown = (item, e) => {
    if (e.button !== 0) return; // Only left click
    e.preventDefault();
    
    const pageRect = e.currentTarget.parentElement.getBoundingClientRect();
    
    // Mouse coords in pixels relative to page container
    const mouseX = e.clientX - pageRect.left;
    const mouseY = e.clientY - pageRect.top;
    
    // Card top-left in pixels relative to page container
    const cardLeft = item.x * SCALE;
    const cardTop = item.y * SCALE;
    
    setDragItem({
      id: item.id,
      offsetX: mouseX - cardLeft,
      offsetY: mouseY - cardTop,
      w: item.w,
      h: item.h
    });
  };

  const handleMouseMove = (e) => {
    if (!dragItem) return;
    
    const pageRect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - pageRect.left;
    const mouseY = e.clientY - pageRect.top;
    
    // Target position in inches
    let newX = (mouseX - dragItem.offsetX) / SCALE;
    let newY = (mouseY - dragItem.offsetY) / SCALE;

    // --- Constraints ---
    // Must remain within printable area (respecting margins)
    const minX = MARGIN;
    const maxX = SHEET_WIDTH - MARGIN - dragItem.w;
    const minY = MARGIN;
    const maxY = SHEET_HEIGHT - MARGIN - dragItem.h;

    newX = Math.max(minX, Math.min(maxX, newX));
    newY = Math.max(minY, Math.min(maxY, newY));

    // Magnetic Snapping (snap to nearest 0.125 inches for millimeter-perfect align)
    const snapInterval = 0.125;
    newX = Math.round(newX / snapInterval) * snapInterval;
    newY = Math.round(newY / snapInterval) * snapInterval;

    // Update active coordinates of the dragged card
    setSheetItems(prev => prev.map(item => {
      if (item.id === dragItem.id) {
        return { ...item, x: newX, y: newY };
      }
      return item;
    }));
  };

  const handleMouseUp = () => {
    setDragItem(null);
  };

  // Group items by sheet index
  const sheetsCount = Math.max(1, sheetCount);
  const activeSheetItems = sheetItems.filter(item => item.sheetIndex === activeSheetIndex);

  // Clear sheet templates
  const handleClearSheet = () => {
    if (confirm('Clear all cards from print layouts?')) {
      setSheetItems([]);
      setSheetCount(1);
      setActiveSheetIndex(0);
    }
  };

  const handleAddPage = () => {
    const nextIndex = sheetCount;
    setSheetCount(sheetCount + 1);
    setActiveSheetIndex(nextIndex);
  };

  const handleDeletePage = () => {
    if (sheetCount <= 1) return;
    if (!confirm(`Delete Page ${activeSheetIndex + 1} and its contents?`)) return;

    const remainingItems = sheetItems
      .filter(item => item.sheetIndex !== activeSheetIndex)
      .map(item => {
        if (item.sheetIndex > activeSheetIndex) {
          return { ...item, sheetIndex: item.sheetIndex - 1 };
        }
        return item;
      });

    const nextIndex = Math.max(0, activeSheetIndex - 1);
    setSheetItems(remainingItems);
    setSheetCount(sheetCount - 1);
    setActiveSheetIndex(nextIndex);
  };

  return html`
    <div class="sheet-builder-layout">
      <!-- CONTROL BAR -->
      <div class="sheet-builder-controls glass-panel">
        <div class="sheet-controls-group">
          <button class="primary-glow-btn" onClick=${() => setShowAddDrawer(true)}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" class="margin-right-xs">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
            Add Card From Library
          </button>
          
          <button class="secondary-btn" onClick=${handleAutoPack} disabled=${sheetItems.length === 0} title="Pack templates automatically to optimize page spacing">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" class="margin-right-xs">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            </svg>
            Intelligent Auto-Pack
          </button>

          <button class="secondary-btn" onClick=${handleAddPage} title="Create a new blank sheet page">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" class="margin-right-xs">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New Page
          </button>

          <button class="secondary-btn delete-btn-secondary" onClick=${handleDeletePage} disabled=${sheetCount <= 1} title="Delete the current sheet page">
            Delete Page
          </button>

          <button class="secondary-btn delete-btn-secondary" onClick=${handleClearSheet} disabled=${sheetItems.length === 0}>
            Clear Sheets
          </button>
        </div>

        <div class="sheet-controls-group">
          <!-- View Side Toggles -->
          <div class="view-mode-tabs">
            <button class="filter-tab ${viewMode === 'front' ? 'active' : ''}" onClick=${() => setViewMode('front')}>Front Page</button>
            <button class="filter-tab ${viewMode === 'back' ? 'active' : ''}" onClick=${() => setViewMode('back')}>Mirrored Back</button>
            <button class="filter-tab ${viewMode === 'split' ? 'active' : ''}" onClick=${() => setViewMode('split')}>Split Preview</button>
          </div>

          <!-- Export to PDF Button -->
          <button class="pdf-export-trigger-btn primary-glow-btn" onClick=${onExportPDF} disabled=${sheetItems.length === 0}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" class="margin-right-xs">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
            </svg>
            Export 2-Page Print PDF
          </button>
        </div>
      </div>

      <!-- PAGE NAVIGATOR -->
      <div class="sheet-pagination-bar glass-panel">
        <span>Active Sheet Layout:</span>
        <div class="pagination-buttons">
          ${Array.from({ length: sheetsCount }).map((_, idx) => html`
            <button 
              class="pagination-btn ${activeSheetIndex === idx ? 'active' : ''}"
              onClick=${() => setActiveSheetIndex(idx)}
            >
              Page ${idx + 1}
            </button>
          `)}
        </div>
      </div>

      <!-- INTERACTIVE SHEET AREA -->
      <div class="sheets-flex-container ${viewMode === 'split' ? 'split-view' : ''}">
        
        <!-- FRONT SHEET RENDERER -->
        ${(viewMode === 'front' || viewMode === 'split') && html`
          <div class="virtual-sheet-wrapper">
            <h4>Front Print Layout (Sheet ${activeSheetIndex + 1})</h4>
            <div 
              ref=${pageContainerRef}
              class="virtual-sheet-page front-sheet glass-panel"
              onMouseMove=${handleMouseMove}
              onMouseUp=${handleMouseUp}
              onMouseLeave=${handleMouseUp}
              style="width: ${PAGE_WIDTH_PX}px; height: ${PAGE_HEIGHT_PX}px;"
            >
              <!-- Safe Bleed/Margin Borders -->
              <div class="sheet-margin-safety-border" style="top: ${MARGIN_PX}px; left: ${MARGIN_PX}px; right: ${MARGIN_PX}px; bottom: ${MARGIN_PX}px;">
                <span class="safety-indicator-label">Print Safe Margin (0.25")</span>
              </div>

              <!-- Placed Card Elements -->
              ${activeSheetItems.map(item => {
                const slotW = item.w * SCALE;
                const slotH = item.h * SCALE;
                return html`
                  <div
                    class="positioned-card-canvas ${dragItem?.id === item.id ? 'is-dragging' : ''}"
                    style="
                      left: ${item.x * SCALE}px;
                      top: ${item.y * SCALE}px;
                      width: ${slotW}px;
                      height: ${slotH}px;
                      --card-theme-color: ${item.card.themeColor || '#6366f1'};
                    "
                    onMouseDown=${(e) => handleMouseDown(item, e)}
                  >
                    <!-- Full-fidelity card render scaled to slot size -->
                    <${ScaledCardPreview}
                      card=${item.card}
                      slotW=${slotW}
                      slotH=${slotH}
                      forceSide="front"
                    />

                    <!-- Trash Remover Tag -->
                    <button
                      class="remove-instance-btn"
                      onClick=${(e) => handleRemoveInstance(item.id, e)}
                      title="Remove card from sheet"
                      style="pointer-events: all;"
                    >
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                `;
              })}

              ${activeSheetItems.length === 0 && html`
                <div class="sheet-empty-prompt">
                  <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1" class="margin-bottom-sm">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
                  </svg>
                  <span>Use "+ Add Card From Library" to position cards on this page.</span>
                </div>
              `}
            </div>
          </div>
        `}

        <!-- DUPLEX MIRRORED BACK SHEET RENDERER -->
        ${(viewMode === 'back' || viewMode === 'split') && html`
          <div class="virtual-sheet-wrapper">
            <h4>Mirrored Back Layout (Sheet ${activeSheetIndex + 1})</h4>
            <div 
              class="virtual-sheet-page back-sheet glass-panel"
              style="width: ${PAGE_WIDTH_PX}px; height: ${PAGE_HEIGHT_PX}px;"
            >
              <!-- Safe Bleed/Margin Borders -->
              <div class="sheet-margin-safety-border" style="top: ${MARGIN_PX}px; left: ${MARGIN_PX}px; right: ${MARGIN_PX}px; bottom: ${MARGIN_PX}px;">
                <span class="safety-indicator-label">Print Safe Margin (0.25")</span>
              </div>

              <!-- Mirrored Back Elements -->
              ${activeSheetItems.map(item => {
                // Horizontal coordinates are mirrored!
                const mirroredX = SHEET_WIDTH - item.x - item.w;
                const slotW = item.w * SCALE;
                const slotH = item.h * SCALE;
                return html`
                  <div
                    class="positioned-card-canvas mirrored-back-canvas"
                    style="
                      left: ${mirroredX * SCALE}px;
                      top: ${item.y * SCALE}px;
                      width: ${slotW}px;
                      height: ${slotH}px;
                      --card-theme-color: ${item.card.themeColor || '#6366f1'};
                    "
                  >
                    <!-- Full-fidelity card back render scaled to slot size -->
                    <${ScaledCardPreview}
                      card=${item.card}
                      slotW=${slotW}
                      slotH=${slotH}
                      forceSide="back"
                    />
                  </div>
                `;
              })}

              ${activeSheetItems.length === 0 && html`
                <div class="sheet-empty-prompt">
                  <span>No card backs to mirror.</span>
                </div>
              `}
            </div>
          </div>
        `}
      </div>

      <!-- CARD PICKER SIDE DRAWER -->
      ${showAddDrawer && html`
        <div class="modal-overlay" onClick=${() => setShowAddDrawer(false)}>
          <div class="modal-content glass-panel add-card-drawer animate-slide-in" onClick=${(e) => e.stopPropagation()}>
            <div class="modal-header">
              <h3>Select Card Template to Add</h3>
              <button class="close-modal-btn" onClick=${() => setShowAddDrawer(false)}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div class="drawer-cards-list">
              ${libraryCards.length > 0 ? libraryCards.map(card => {
                const sizeInfo = CARD_SIZES[card.size] || CARD_SIZES['poker'];
                return html`
                  <div class="drawer-card-item glass-panel" onClick=${() => handleAddCardInstance(card)}>
                    <div class="drawer-card-meta">
                      <span class="drawer-card-title">${card.title}</span>
                      <span class="drawer-card-size">${sizeInfo.name} (${sizeInfo.width}" × ${sizeInfo.height}")</span>
                    </div>
                    <button class="primary-glow-btn mini-btn">Add Instance</button>
                  </div>
                `;
              }) : html`
                <div class="drawer-empty-state">
                  <p>Your library is empty! Please design and save a card in the "Card Creator" tab first.</p>
                </div>
              `}
            </div>
          </div>
        </div>
      `}
    </div>
  `;
}
