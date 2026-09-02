import { h } from 'https://esm.sh/preact@10.19.6';
import { useState, useRef, useEffect } from 'https://esm.sh/preact@10.19.6/hooks';
import htm from 'https://esm.sh/htm@3.1.1';
import { getCardSize, BORDER_INSET, getBorderWidthIn, getContentInsetIn, getSafeZoneInsetIn } from '../utils/binPacker.js';
import { loadGoogleFont } from './CardCreator.js';

const html = htm.bind(h);

export default function CardPreview({ card, forceSide = 'front', cardSizeDefaults = {} }) {
  const [side, setSide] = useState('front');
  const [showGuides, setShowGuides] = useState(true);
  const cardRef = useRef(null);
  
  // Sync forceSide if parent changes it
  useEffect(() => {
    setSide(forceSide);
  }, [forceSide]);

  // Load fonts dynamically
  useEffect(() => {
    loadGoogleFont(card.titleFont);
    loadGoogleFont(card.bodyFont);
  }, [card.titleFont, card.bodyFont]);

  // Premium 3D Tilt Effect
  const handleMouseMove = (e) => {
    const cardEl = cardRef.current;
    if (!cardEl || side === 'back') return;

    const rect = cardEl.getBoundingClientRect();
    const x = e.clientX - rect.left; // x position within element
    const y = e.clientY - rect.top;  // y position within element
    
    // Calculate rotate degrees based on mouse position relative to center
    const xc = rect.width / 2;
    const yc = rect.height / 2;
    const rotateY = ((x - xc) / xc) * 12; // max 12 deg
    const rotateX = -((y - yc) / yc) * 12; // max 12 deg
    
    // Glossy overlay positioning
    const glossX = (x / rect.width) * 100;
    const glossY = (y / rect.height) * 100;

    cardEl.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
    cardEl.style.setProperty('--gloss-x', `${glossX}%`);
    cardEl.style.setProperty('--gloss-y', `${glossY}%`);
    cardEl.style.setProperty('--sheen-opacity', '0.2');
  };

  const handleMouseLeave = () => {
    const cardEl = cardRef.current;
    if (!cardEl) return;
    // Smoothly reset transformations
    cardEl.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
    cardEl.style.setProperty('--sheen-opacity', '0');
  };

  const toggleFlip = (e) => {
    e.stopPropagation();
    setSide(side === 'front' ? 'back' : 'front');
  };

// Dimensions based on card type selection or legacy size
   const sizeInfo = getCardSize(card);

  // The Game Crafter print safe-zone guide (matches their card proofing
  // overlay: 0.125" bleed + a further 0.125" clearance inside the trim
  // line = 0.25" total from the outer file edge). Expressed as a % inset
  // from the card box edge -- getSafeZoneInsetIn accounts for whether
  // sizeInfo's own box is the trim box (most presets) or already has the
  // bleed border baked into it (poker, custom pixel sizes), since the
  // inset from the box's own edge differs between the two.
  const safeZoneInsetIn = getSafeZoneInsetIn(sizeInfo);
  const safeInsetPctX = (safeZoneInsetIn / sizeInfo.width) * 100;
  const safeInsetPctY = (safeZoneInsetIn / sizeInfo.height) * 100;
  const guidesAvailable = safeInsetPctX != null;

  // Two separate insets, both needing to clear the safe-zone guide above,
  // in real pixels -- not the fixed 20px/8px the CSS used to hardcode,
  // which only cleared it by coincidence for card types close to Poker
  // width. `.card-preview-wrapper` always renders at a fixed 320px CSS
  // width (see app.css), so the physical inch measurements below (the same
  // ones the PNG export uses) convert to px here via that fixed scale
  // factor -- uniform in both axes since the preview box is never
  // stretched off its own aspect ratio. Applies to custom pixel sizes too
  // (see safeInsetPct comment above) -- a flat 8px/20px fallback here would
  // shrink to invisible on a large custom canvas instead of scaling with it.
  //   - trimInsetPx: where the decorative edge border itself sits -- flush
  //     against the trim edge (BORDER_INSET is 0), matching The Game
  //     Crafter's own "Border Area" guide, which starts right at the trim
  //     line rather than floating inside the safe zone.
  //   - contentPaddingPx: where header/art/description/footer content
  //     starts -- further in than the border so there's a visible gap,
  //     rather than text/art sitting flush against (or painting over) it.
  const PREVIEW_WIDTH_PX = 320;
  const previewScale = PREVIEW_WIDTH_PX / sizeInfo.width;
  const trimInsetPx = BORDER_INSET * previewScale;
  const contentPaddingPx = getContentInsetIn(sizeInfo) * previewScale;

  // Border thickness is no longer user-adjustable -- The Game Crafter's
  // template requires it to span the full trim-edge-to-safe-zone-line gap
  // (getBorderWidthIn) or not exist at all, so a thin/oversized border
  // never gets drawn. `borderEnabled` defaults to true (a border shows
  // unless explicitly turned off) to match the previous default appearance.
  const borderEnabled = card.borderEnabled !== false;
  const borderWidthPx = borderEnabled ? getBorderWidthIn(sizeInfo) * previewScale : 0;

  // Font auto-scaling based on text lengths (Standard sizes only)
  const titleText = card.title || 'Untitled Card';
  const getTitleFontSize = () => {
    const len = titleText.length;
    if (len > 22) return '1.05rem';
    if (len > 15) return '1.2rem';
    return '1.4rem';
  };

  const descText = card.description || '';
  const getDescFontSize = () => {
    const sizeMap = { sm: '0.72rem', md: '0.85rem', lg: '1rem', xl: '1.15rem' };
    if (card.descFontSize && card.descFontSize !== 'auto') return sizeMap[card.descFontSize] || '0.85rem';
    const len = descText.length;
    if (len > 250) return '0.62rem';
    if (len > 180) return '0.7rem';
    if (len > 100) return '0.78rem';
    return '0.85rem';
  };

  return html`
    <div class="card-preview-wrapper" style="--card-aspect: ${sizeInfo.width / sizeInfo.height}">
      <!-- Toggle Flip Button -->
      <button class="flip-btn-floating" onClick=${toggleFlip} title="Flip Card Preview">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 11A8.1 8.1 0 0 0 4.5 9M4 5v4h4 M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"/>
        </svg>
        <span>${side === 'front' ? 'View Back' : 'View Front'}</span>
      </button>

      <!-- Toggle Print Safe-Zone Guide (The Game Crafter proofing overlay) -->
      ${guidesAvailable && html`
        <button
          class="flip-btn-floating guides-toggle-btn ${showGuides ? 'active' : ''}"
          onClick=${(e) => { e.stopPropagation(); setShowGuides(!showGuides); }}
          title="Toggle The Game Crafter print safe-zone guide (0.25&quot; from the bleed edge / 0.125&quot; inside the trim line)"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="3 3"/>
          </svg>
          <span>${showGuides ? 'Hide' : 'Show'} Safe Zone</span>
        </button>
      `}

      <!-- Interactive 3D Card -->
      <div 
        ref=${cardRef}
        class="card-inner-container ${side === 'back' ? 'is-flipped' : ''} ${card.size === 'large' ? 'card-large-layout-border' : ''}"
        onMouseMove=${handleMouseMove}
        onMouseLeave=${handleMouseLeave}
        style="
          --card-bg: ${card.bgColor || '#1e1e24'};
          --card-text: ${card.textColor || '#ffffff'};
          --card-theme: ${card.themeColor || '#6366f1'};
          --card-icon-color: ${card.iconColor || card.themeColor || '#6366f1'};
          --card-art-icon-color: ${card.artIconColor || card.themeColor || '#6366f1'};
          --title-font: ${card.titleFont || 'Outfit'};
          --body-font: ${card.bodyFont || 'Inter'};
          --card-trim-inset: ${trimInsetPx}px;
          --card-content-padding: ${contentPaddingPx}px;
          --card-border-color: ${card.borderColor || card.themeColor || '#6366f1'};
          --card-border-width: ${borderWidthPx}px;
        "
      >
        <!-- Glossy Overlay -->
        <div class="card-gloss-overlay"></div>

        <!-- FRONT SIDE -->
        <div class="card-face card-front">
          <!-- Outer themed trim -->
          <div class="card-inner-trim"></div>

          <!-- The Game Crafter print safe-zone guide -->
          ${showGuides && guidesAvailable && html`
            <div class="print-safe-zone-guide" style="top: ${safeInsetPctY}%; left: ${safeInsetPctX}%; right: ${safeInsetPctX}%; bottom: ${safeInsetPctY}%;"></div>
          `}

          <!-- Card Header (Title & Subtitle) -->
          <div class="card-header-region">
            <div class="card-title-block">
              <h2 class="card-preview-title" style="font-size: ${getTitleFontSize()}">
                ${titleText}
              </h2>
              ${card.size !== 'large' && card.headline && html`
                <span class="card-preview-headline">${card.headline.toUpperCase()}</span>
              `}
              ${card.size === 'large' && html`
                <span class="card-preview-headline">LARGE HERO ABILITY TEMPLATE</span>
              `}
            </div>

            <!-- Card Header Icon (Standard Sizes Only) -->
            ${card.size !== 'large' && card.iconType !== 'none' && html`
              <div class="card-icon-container">
                ${card.iconType === 'upload' && card.iconUpload ? html`
                  <img src=${card.iconUpload} class="card-custom-icon" alt="icon" />
                ` : card.iconSvgPath ? html`
                  <svg viewBox="0 0 24 24" class="card-vector-icon" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d=${card.iconSvgPath} />
                  </svg>
                ` : null}
              </div>
            `}
          </div>

          <!-- DUPLEX RENDERER: DYNAMIC LAYOUT SWAP -->
          ${card.size === 'large' ? html`
            <!-- LARGE CARD SYSTEM: 2 STANDARD ABILITIES + 1 ULTIMATE -->
            <div class="large-abilities-container">
              
              <!-- ABILITY BLOCK 1 -->
              <div class="ability-layout-block ability-standard">
                <div class="ability-block-header">
                  <span class="ability-title-txt">${card.ability1Title || 'Standard Ability 1'}</span>
                  <span class="ability-points-badge">${card.ability1Points || '1 AP'}</span>
                </div>
                <div class="ability-description-txt">
                  ${card.ability1Desc || 'Deals damage or provides support attributes.'}
                </div>
              </div>

              <!-- ABILITY BLOCK 2 -->
              <div class="ability-layout-block ability-standard">
                <div class="ability-block-header">
                  <span class="ability-title-txt">${card.ability2Title || 'Standard Ability 2'}</span>
                  <span class="ability-points-badge">${card.ability2Points || '2 AP'}</span>
                </div>
                <div class="ability-description-txt">
                  ${card.ability2Desc || 'Additional card power, defenses, or modifiers.'}
                </div>
              </div>

              <!-- ULTIMATE ABILITY BLOCK -->
              <div class="ability-layout-block ability-ultimate">
                <div class="ability-block-header">
                  <span class="ability-title-txt ultimate-glowing-text">${card.ultimateTitle || 'Ultimate Power'}</span>
                  <span class="ability-points-badge ultimate-points-badge">${card.ultimatePoints || '5 AP'}</span>
                </div>
                <div class="ability-description-txt ultimate-desc-txt">
                  ${card.ultimateDesc || 'Epic high-cost impact effect.'}
                </div>
              </div>

            </div>
          ` : html`
            <!-- STANDARD CARD LAYOUT -->
            <!-- Card Art Box -->
            <div class="card-art-box ${(card.cardArt || (card.cardArtType === 'icon' && card.cardArtSvg)) ? 'has-art' : ''}">
              ${card.cardArt ? html`
                <img src=${card.cardArt} class="card-art-image" alt="Art" />
              ` : (card.cardArtType === 'icon' && card.cardArtSvg) ? html`
                <div
                  class="card-art-full-icon"
                  dangerouslySetInnerHTML=${{ __html: card.cardArtSvg }}
                />
              ` : html`
                <div class="card-art-placeholder">
                  <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="3 3">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <path d="M21 15l-5-5L5 21"/>
                  </svg>
                  <span>Illustration Frame</span>
                </div>
              `}
            </div>

            <!-- Card Body Description -->
            <div class="card-description-box" style="font-size: ${getDescFontSize()}">
              ${card.description || 'Provide a compelling description detailing card functions, attributes, lore, or abilities.'}
            </div>

            <!-- Card Footer Callouts -->
            <div class="card-footer-box">
              ${card.bottomLeft ? html`
                <div class="card-callout-tag callout-left">${card.bottomLeft}</div>
              ` : html`<div></div>`}
              
              ${card.bottomRight ? html`
                <div class="card-callout-tag callout-right">${card.bottomRight}</div>
              ` : html`<div></div>`}
            </div>
          `}
        </div>

        <!-- BACK SIDE -->
        <div class="card-face card-back">
          <!-- Background image or premium diamond lattice -->
          ${(() => {
            const backImage = card.cardBackImage || (cardSizeDefaults && cardSizeDefaults[card.size]) || null;
            if (backImage) {
              return html`
                <img src=${backImage} class="card-back-background" alt="Card Back" />
                <div class="card-inner-trim"></div>
              `;
            }
            return html`
              <div class="card-inner-trim"></div>
              <div class="card-back-geometric-mesh"></div>
              <div class="card-back-medallion">
                <div class="card-back-inner-diamond"></div>
              </div>
            `;
          })()}

          <!-- The Game Crafter print safe-zone guide -->
          ${showGuides && guidesAvailable && html`
            <div class="print-safe-zone-guide" style="top: ${safeInsetPctY}%; left: ${safeInsetPctX}%; right: ${safeInsetPctX}%; bottom: ${safeInsetPctY}%;"></div>
          `}
        </div>
      </div>
    </div>
  `;
}
