import { h } from 'https://esm.sh/preact@10.19.6';
import { useState, useEffect } from 'https://esm.sh/preact@10.19.6/hooks';
import htm from 'https://esm.sh/htm@3.1.1';
import IconPicker from './IconPicker.js';
import { CARD_SIZES } from '../utils/binPacker.js';

const html = htm.bind(h);

const THEME_PRESETS = [
  {
    name: 'Modern Blue',
    bgColor: '#ffffff',
    textColor: '#1e3a8a',
    themeColor: '#3b82f6', // Bright Blue
  },
  {
    name: 'Vibrant Coral',
    bgColor: '#ffffff',
    textColor: '#64748b',
    themeColor: '#f43f5e', // Coral/Pink
  },
  {
    name: 'Purple Elegance',
    bgColor: '#ffffff',
    textColor: '#6b21a8',
    themeColor: '#a855f7', // Bright Purple
  },
  {
    name: 'Forest Green',
    bgColor: '#ffffff',
    textColor: '#15803d',
    themeColor: '#10b981', // Emerald
  },
  {
    name: 'Warm Amber',
    bgColor: '#ffffff',
    textColor: '#78350f',
    themeColor: '#f59e0b', // Amber/Gold
  },
  {
    name: 'Sleek Navy',
    bgColor: '#ffffff',
    textColor: '#001f3f',
    themeColor: '#0066cc', // Navy Blue
  }
];

// Expanded suite of 26 curated high-quality Google Web Fonts
export const GOOGLE_FONTS = [
  // Modern & Clean Sans-serif
  'Outfit', 'Inter', 'Roboto', 'Poppins', 'Montserrat', 'Lato', 'Raleway', 'Oswald', 'Rubik',
  // Classic & Elegant Serif
  'Cinzel', 'Playfair Display', 'Merriweather', 'Lora', 'PT Serif', 'MedievalSharp', 'Rye',
  // Retrogaming & Sci-fi Monospace/Display
  'Press Start 2P', 'Share Tech Mono', 'Orbitron', 'VT323', 'Bebas Neue', 'Metamorphous',
  // Fun, Handdrawn & Artistic
  'Lobster', 'Pacifico', 'Creepster', 'Architects Daughter'
];

/**
 * Dynamically injects Google Web Fonts link stylesheet into head
 */
export function loadGoogleFont(fontName) {
  if (!fontName) return;
  const id = `gfont-${fontName.replace(/\s+/g, '-').toLowerCase()}`;
  if (document.getElementById(id)) return; // Font link already exists
  
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  // Load standard weights: 400 (regular), 500 (medium), 700 (bold), 800 (extra bold)
  link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/\s+/g, '+')}:wght@400;500;700;800&display=swap`;
  document.head.appendChild(link);
}

export default function CardCreator({ card, onChangeCard, onSaveCard }) {
  const [activeTab, setActiveTab] = useState('design'); // design, content, graphics
  const [showIconModal, setShowIconModal] = useState(false);
  const [showArtModal, setShowArtModal] = useState(false);

  // Dynamic Google Font loader hook
  useEffect(() => {
    loadGoogleFont(card.titleFont);
    loadGoogleFont(card.bodyFont);
  }, [card.titleFont, card.bodyFont]);

  const handleTextChange = (field, value) => {
    onChangeCard({ ...card, [field]: value });
  };

  const handleImageUpload = (e, field) => {
    const file = e.target.files[0];
    if (!file) return;

    // Warning if size is too large
    if (file.size > 2 * 1024 * 1024) {
      alert('Image exceeds 2MB. To guarantee optimal performance, please upload a smaller graphic.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      onChangeCard({ ...card, [field]: event.target.result });
    };
    reader.readAsDataURL(file);
  };

  const removeGraphic = (field) => {
    onChangeCard({ ...card, [field]: null });
  };

  const applyPreset = (preset) => {
    onChangeCard({
      ...card,
      bgColor: preset.bgColor,
      textColor: preset.textColor,
      themeColor: preset.themeColor
    });
  };

  return html`
    <div class="creator-control-panel glass-panel">
      <div class="creator-tabs">
        <button 
          class="tab-btn ${activeTab === 'design' ? 'active' : ''}" 
          onClick=${() => setActiveTab('design')}
        >
          Visuals
        </button>
        <button 
          class="tab-btn ${activeTab === 'content' ? 'active' : ''}" 
          onClick=${() => setActiveTab('content')}
        >
          Text Content
        </button>
        <button 
          class="tab-btn ${activeTab === 'graphics' ? 'active' : ''}" 
          onClick=${() => setActiveTab('graphics')}
        >
          Graphics
        </button>
      </div>

      <div class="creator-form-content">
        <!-- DESIGN / VISUALS TAB -->
        ${activeTab === 'design' && html`
          <div class="form-section">
            <h3 class="section-title">Dimensions & Theme</h3>
            
            <!-- Card Size -->
            <div class="form-group">
              <label class="input-label">Card Size Standard</label>
              <select 
                class="form-select" 
                value=${card.size || 'poker'}
                onChange=${(e) => handleTextChange('size', e.target.value)}
              >
                ${Object.entries(CARD_SIZES).map(([key, val]) => html`
                  <option value=${key}>${val.name} (${val.width}" × ${val.height}")</option>
                `)}
              </select>
            </div>

            <!-- Theme Presets -->
            <div class="form-group">
              <label class="input-label">Quick Styles & Palettes</label>
              <div class="presets-grid">
                ${THEME_PRESETS.map(preset => html`
                  <button 
                    type="button"
                    class="preset-card-btn"
                    style="--p-bg: ${preset.bgColor}; --p-theme: ${preset.themeColor};"
                    onClick=${() => applyPreset(preset)}
                    title=${preset.name}
                  >
                    <span class="preset-indicator-color" style="background: ${preset.bgColor}"></span>
                    <span class="preset-indicator-color" style="background: ${preset.themeColor}"></span>
                    <span class="preset-name-label">${preset.name}</span>
                  </button>
                `)}
              </div>
            </div>

            <!-- Custom Colors -->
            <div class="form-group row-group">
              <div>
                <label class="input-label">Background Color</label>
                <div class="color-picker-input-wrapper">
                  <input 
                    type="color" 
                    class="form-color-picker" 
                    value=${card.bgColor || '#1e1e24'}
                    onInput=${(e) => handleTextChange('bgColor', e.target.value)}
                  />
                  <input 
                    type="text" 
                    class="form-text-input hex-input" 
                    value=${card.bgColor || '#1e1e24'}
                    onInput=${(e) => handleTextChange('bgColor', e.target.value)}
                  />
                </div>
              </div>
              
              <div>
                <label class="input-label">Accent / Border</label>
                <div class="color-picker-input-wrapper">
                  <input 
                    type="color" 
                    class="form-color-picker" 
                    value=${card.themeColor || '#6366f1'}
                    onInput=${(e) => handleTextChange('themeColor', e.target.value)}
                  />
                  <input 
                    type="text" 
                    class="form-text-input hex-input" 
                    value=${card.themeColor || '#6366f1'}
                    onInput=${(e) => handleTextChange('themeColor', e.target.value)}
                  />
                </div>
              </div>
              
              <div>
                <label class="input-label">Typography Color</label>
                <div class="color-picker-input-wrapper">
                  <input 
                    type="color" 
                    class="form-color-picker" 
                    value=${card.textColor || '#ffffff'}
                    onInput=${(e) => handleTextChange('textColor', e.target.value)}
                  />
                  <input 
                    type="text" 
                    class="form-text-input hex-input" 
                    value=${card.textColor || '#ffffff'}
                    onInput=${(e) => handleTextChange('textColor', e.target.value)}
                  />
                </div>
              </div>
            </div>

            <!-- Font Styles -->
            <h3 class="section-title margin-top-title">Typography Setup</h3>
            <div class="form-group">
              <label class="input-label">Heading Font Family</label>
              <select 
                class="form-select font-selector" 
                value=${card.titleFont || 'Outfit'}
                onChange=${(e) => handleTextChange('titleFont', e.target.value)}
                style="font-family: ${card.titleFont || 'Outfit'};"
              >
                ${GOOGLE_FONTS.map(font => html`
                  <option value=${font} style="font-family: ${font};">${font}</option>
                `)}
              </select>
            </div>

            <div class="form-group">
              <label class="input-label">Body Text Font Family</label>
              <select 
                class="form-select font-selector" 
                value=${card.bodyFont || 'Inter'}
                onChange=${(e) => handleTextChange('bodyFont', e.target.value)}
                style="font-family: ${card.bodyFont || 'Inter'};"
              >
                ${GOOGLE_FONTS.map(font => html`
                  <option value=${font} style="font-family: ${font};">${font}</option>
                `)}
              </select>
            </div>
          </div>
        `}

        <!-- CONTENT / TEXTS TAB -->
        ${activeTab === 'content' && html`
          <div class="form-section">
            <h3 class="section-title">Card Header</h3>
            
            <!-- Card Title -->
            <div class="form-group">
              <label class="input-label">Card Title</label>
              <input 
                type="text" 
                class="form-text-input" 
                placeholder="Enter title (e.g. Firestorm)" 
                value=${card.title || ''}
                onInput=${(e) => handleTextChange('title', e.target.value)}
              />
            </div>

            <!-- DYNAMIC FORM LAYOUT OVERRIDES -->
            ${card.size === 'large' ? html`
              <!-- LARGE CARD ABILITY SYSTEM -->
              <h3 class="section-title margin-top-title">Ability Block 1 (Standard)</h3>
              <div class="form-group row-group-2">
                <div style="grid-column: span 2;">
                  <label class="input-label">Ability 1 Title</label>
                  <input 
                    type="text" 
                    class="form-text-input" 
                    placeholder="Slash" 
                    value=${card.ability1Title || ''}
                    onInput=${(e) => handleTextChange('ability1Title', e.target.value)}
                  />
                </div>
                <div>
                  <label class="input-label">AP Cost / Value</label>
                  <input 
                    type="text" 
                    class="form-text-input" 
                    placeholder="1 AP" 
                    value=${card.ability1Points || ''}
                    onInput=${(e) => handleTextChange('ability1Points', e.target.value)}
                  />
                </div>
              </div>
              <div class="form-group">
                <label class="input-label">Ability 1 Description</label>
                <textarea 
                  class="form-textarea-input" 
                  rows="2"
                  placeholder="Deals 3 physical damage to the target."
                  value=${card.ability1Desc || ''}
                  onInput=${(e) => handleTextChange('ability1Desc', e.target.value)}
                ></textarea>
              </div>

              <h3 class="section-title margin-top-title">Ability Block 2 (Standard)</h3>
              <div class="form-group row-group-2">
                <div style="grid-column: span 2;">
                  <label class="input-label">Ability 2 Title</label>
                  <input 
                    type="text" 
                    class="form-text-input" 
                    placeholder="Flame Shield" 
                    value=${card.ability2Title || ''}
                    onInput=${(e) => handleTextChange('ability2Title', e.target.value)}
                  />
                </div>
                <div>
                  <label class="input-label">AP Cost / Value</label>
                  <input 
                    type="text" 
                    class="form-text-input" 
                    placeholder="2 AP" 
                    value=${card.ability2Points || ''}
                    onInput=${(e) => handleTextChange('ability2Points', e.target.value)}
                  />
                </div>
              </div>
              <div class="form-group">
                <label class="input-label">Ability 2 Description</label>
                <textarea 
                  class="form-textarea-input" 
                  rows="2"
                  placeholder="Gain a protective fire barrier that inflicts 1 burn damage to attackers."
                  value=${card.ability2Desc || ''}
                  onInput=${(e) => handleTextChange('ability2Desc', e.target.value)}
                ></textarea>
              </div>

              <h3 class="section-title margin-top-title ultimate-section-header">Ultimate Ability Block</h3>
              <div class="form-group row-group-2">
                <div style="grid-column: span 2;">
                  <label class="input-label text-glowing-pink">Ultimate Title</label>
                  <input 
                    type="text" 
                    class="form-text-input ultimate-input" 
                    placeholder="Supernova" 
                    value=${card.ultimateTitle || ''}
                    onInput=${(e) => handleTextChange('ultimateTitle', e.target.value)}
                  />
                </div>
                <div>
                  <label class="input-label text-glowing-pink">AP Cost / Value</label>
                  <input 
                    type="text" 
                    class="form-text-input ultimate-input" 
                    placeholder="5 AP" 
                    value=${card.ultimatePoints || ''}
                    onInput=${(e) => handleTextChange('ultimatePoints', e.target.value)}
                  />
                </div>
              </div>
              <div class="form-group">
                <label class="input-label">Ultimate Description</label>
                <textarea 
                  class="form-textarea-input ultimate-textarea" 
                  rows="3"
                  placeholder="Unleashes massive fire wave. Deals 12 fire damage to all active targets."
                  value=${card.ultimateDesc || ''}
                  onInput=${(e) => handleTextChange('ultimateDesc', e.target.value)}
                ></textarea>
              </div>
            ` : html`
              <!-- STANDARD CARD LAYOUT -->
              <!-- Description Headline -->
              <div class="form-group">
                <label class="input-label">Description Headline (Subheader)</label>
                <input 
                  type="text" 
                  class="form-text-input" 
                  placeholder="Spell - Rare, Item - Accessory, etc." 
                  value=${card.headline || ''}
                  onInput=${(e) => handleTextChange('headline', e.target.value)}
                />
              </div>

              <!-- Icon Selector trigger -->
              <div class="form-group">
                <label class="input-label">Card Graphic Icon</label>
                <div class="icon-toggle-row">
                  <button 
                    type="button" 
                    class="toggle-choice-btn ${card.iconType !== 'upload' ? 'active' : ''}"
                    onClick=${() => handleTextChange('iconType', 'vector')}
                  >
                    Vector Icon
                  </button>
                  <button 
                    type="button" 
                    class="toggle-choice-btn ${card.iconType === 'upload' ? 'active' : ''}"
                    onClick=${() => handleTextChange('iconType', 'upload')}
                  >
                    Upload File
                  </button>
                </div>

                ${card.iconType === 'upload' ? html`
                  <div class="upload-area margin-top-sm">
                    <input 
                      type="file" 
                      id="icon-upload-input" 
                      accept="image/*" 
                      onChange=${(e) => handleImageUpload(e, 'iconUpload')}
                      class="hidden-file-input"
                    />
                    <label for="icon-upload-input" class="upload-trigger-label">
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                      </svg>
                      <span>${card.iconUpload ? 'Change Icon Graphic' : 'Upload PNG/SVG Icon'}</span>
                    </label>
                    ${card.iconUpload && html`
                      <div class="graphic-preview-thumbnail">
                        <img src=${card.iconUpload} alt="icon thumbnail" />
                        <button type="button" class="remove-graphic-btn" onClick=${() => removeGraphic('iconUpload')}>Remove</button>
                      </div>
                    `}
                  </div>
                ` : html`
                  <button 
                    type="button" 
                    class="select-vector-trigger-btn"
                    onClick=${() => setShowIconModal(true)}
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" class="margin-right-xs">
                      <circle cx="12" cy="12" r="10"/><path d="M12 8l4 4-4 4M8 12h8"/>
                    </svg>
                    ${card.iconId ? `Vector Selected: ${card.iconId.toUpperCase()}` : 'Browse Vector Icons Library'}
                  </button>
                `}

                <!-- Icon Color Picker (appears after icon selection) -->
                ${(card.iconUpload || card.iconId) && html`
                  <div class="form-group margin-top-sm">
                    <label class="input-label">Icon Color</label>
                    <div class="color-picker-input-wrapper">
                      <input 
                        type="color" 
                        class="form-color-picker" 
                        value=${card.iconColor || '#f43f5e'}
                        onInput=${(e) => handleTextChange('iconColor', e.target.value)}
                      />
                      <input 
                        type="text" 
                        class="form-text-input hex-input" 
                        value=${card.iconColor || '#f43f5e'}
                        onInput=${(e) => handleTextChange('iconColor', e.target.value)}
                      />
                    </div>
                  </div>
                `}
              </div>

              <!-- Card Description -->
              <div class="form-group">
                <label class="input-label">Description Text (Auto-scales font size)</label>
                <textarea 
                  class="form-textarea-input" 
                  rows="4"
                  placeholder="Deal 5 Fire damage to all targets in selected row. Costs 3 Mana energy."
                  value=${card.description || ''}
                  onInput=${(e) => handleTextChange('description', e.target.value)}
                ></textarea>
              </div>

              <!-- Callouts -->
              <div class="form-group row-group">
                <div>
                  <label class="input-label">Bottom-Left Callout</label>
                  <input 
                    type="text" 
                    class="form-text-input" 
                    placeholder="e.g. ATK: 5" 
                    value=${card.bottomLeft || ''}
                    onInput=${(e) => handleTextChange('bottomLeft', e.target.value)}
                  />
                </div>
                
                <div>
                  <label class="input-label">Bottom-Right Callout</label>
                  <input 
                    type="text" 
                    class="form-text-input" 
                    placeholder="e.g. DEF: 3" 
                    value=${card.bottomRight || ''}
                    onInput=${(e) => handleTextChange('bottomRight', e.target.value)}
                  />
                </div>
              </div>
            `}
          </div>
        `}
        <!-- GRAPHICS / UPLOADER TAB -->
        ${activeTab === 'graphics' && html`
          <div class="form-section">
            <h3 class="section-title">Illustration &amp; Custom Backgrounds</h3>
            
            <!-- Card Art / Illustration Frame -->
            <div class="form-group">
              <label class="input-label">Illustration Frame (Front of Card)</label>

              <!-- Mode Toggle -->
              <div class="icon-toggle-row">
                <button
                  type="button"
                  class="toggle-choice-btn ${(!card.cardArtType || card.cardArtType === 'upload') ? 'active' : ''}"
                  onClick=${() => handleTextChange('cardArtType', 'upload')}
                >
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" class="margin-right-xs">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                  </svg>
                  Upload Image
                </button>
                <button
                  type="button"
                  class="toggle-choice-btn ${card.cardArtType === 'icon' ? 'active' : ''}"
                  onClick=${() => handleTextChange('cardArtType', 'icon')}
                >
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" class="margin-right-xs">
                    <circle cx="12" cy="12" r="10"/><path d="M12 8l4 4-4 4M8 12h8"/>
                  </svg>
                  Icon Library
                </button>
              </div>

              <!-- Upload Image Mode -->
              ${(!card.cardArtType || card.cardArtType === 'upload') && html`
                <div class="upload-area margin-top-sm">
                  <input
                    type="file"
                    id="art-upload-input"
                    accept="image/*"
                    onChange=${(e) => handleImageUpload(e, 'cardArt')}
                    class="hidden-file-input"
                  />
                  <label for="art-upload-input" class="upload-trigger-label">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                    </svg>
                    <span>${card.cardArt ? 'Change Illustration Image' : 'Upload JPG / PNG / SVG'}</span>
                  </label>

                  ${card.cardArt && html`
                    <div class="graphic-preview-thumbnail full-width-thumb">
                      <img src=${card.cardArt} alt="illustration thumbnail" />
                      <div class="thumbnail-meta">
                        <span>Art Image Uploaded</span>
                        <button type="button" class="remove-graphic-btn" onClick=${() => {
                          onChangeCard({ ...card, cardArt: null, cardArtSvg: null });
                        }}>Remove</button>
                      </div>
                    </div>
                  `}
                </div>
              `}

              <!-- Icon Library Mode -->
              ${card.cardArtType === 'icon' && html`
                <div class="margin-top-sm">
                  <button
                    type="button"
                    class="select-vector-trigger-btn"
                    onClick=${() => setShowArtModal(true)}
                    style="width: 100%;"
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" class="margin-right-xs">
                      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                    </svg>
                    ${card.cardArtIconId ? `Icon: ${card.cardArtIconId}` : 'Browse 275,000+ Icons'}
                  </button>

                  ${card.cardArtSvg && html`
                    <div class="art-icon-preview-box">
                      <div
                        class="art-icon-preview-inner"
                        dangerouslySetInnerHTML=${{ __html: card.cardArtSvg }}
                      />
                      <button type="button" class="remove-graphic-btn" onClick=${() => {
                        onChangeCard({ ...card, cardArtSvg: null, cardArtIconId: null });
                      }}>Remove</button>
                    </div>

                    <!-- Art Icon Color Picker -->
                    <div class="form-group margin-top-sm">
                      <label class="input-label">Illustration Icon Color</label>
                      <div class="color-picker-input-wrapper">
                        <input 
                          type="color" 
                          class="form-color-picker" 
                          value=${card.artIconColor || '#f43f5e'}
                          onInput=${(e) => handleTextChange('artIconColor', e.target.value)}
                        />
                        <input 
                          type="text" 
                          class="form-text-input hex-input" 
                          value=${card.artIconColor || '#f43f5e'}
                          onInput=${(e) => handleTextChange('artIconColor', e.target.value)}
                        />
                      </div>
                    </div>
                  `}
                </div>
              `}
            </div>

            <!-- Card Back Image -->
            <div class="form-group">
              <label class="input-label">Card Back Image (Overrides pattern)</label>
              <div class="upload-area">
                <input
                  type="file"
                  id="back-upload-input"
                  accept="image/*"
                  onChange=${(e) => handleImageUpload(e, 'cardBackImage')}
                  class="hidden-file-input"
                />
                <label for="back-upload-input" class="upload-trigger-label">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 15h-2v-6h2zm0-8h-2V7h2z"/>
                  </svg>
                  <span>Upload Custom Back Face</span>
                </label>

                ${card.cardBackImage && html`
                  <div class="graphic-preview-thumbnail full-width-thumb">
                    <img src=${card.cardBackImage} alt="card back thumbnail" />
                    <div class="thumbnail-meta">
                      <span>Back Graphic Uploaded</span>
                      <button type="button" class="remove-graphic-btn" onClick=${() => removeGraphic('cardBackImage')}>Remove</button>
                    </div>
                  </div>
                `}
              </div>
              <p class="input-hint-text">Leave blank to use the gorgeous default neon-diamond pattern back side.</p>
            </div>
          </div>
        `}}
      </div>

      <!-- Action Panel -->
      <div class="creator-action-panel">
        <button class="save-deck-trigger-btn primary-glow-btn" onClick=${onSaveCard}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" class="margin-right-xs">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
          </svg>
          Save Template to Library
        </button>
      </div>

      <!-- VECTOR ICON SELECTOR MODAL (Main Header Icon) -->
      ${showIconModal && html`
        <div class="modal-overlay" onClick=${() => setShowIconModal(false)}>
          <div class="modal-content glass-panel animate-zoom-in" onClick=${(e) => e.stopPropagation()}>
            <div class="modal-header">
              <h3>Browse Icon Library — Card Header Icon</h3>
              <button class="close-modal-btn" onClick=${() => setShowIconModal(false)}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            
            <${IconPicker} 
              selectedId=${card.iconId} 
              onSelectIcon=${(id, svgText) => {
                // For header icon we still use SVG path extracted from returned SVG text
                // Parse out the viewBox & path/g content so it renders inline with stroke styling
                onChangeCard({
                  ...card,
                  iconType: 'upload',
                  iconId: id,
                  iconUpload: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`
                });
                setShowIconModal(false);
              }}
            />
          </div>
        </div>
      `}

      <!-- ILLUSTRATION FRAME ICON LIBRARY MODAL -->
      ${showArtModal && html`
        <div class="modal-overlay" onClick=${() => setShowArtModal(false)}>
          <div class="modal-content glass-panel animate-zoom-in" onClick=${(e) => e.stopPropagation()}>
            <div class="modal-header">
              <h3>Browse Icon Library — Illustration Frame</h3>
              <button class="close-modal-btn" onClick=${() => setShowArtModal(false)}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            
            <${IconPicker}
              selectedId=${card.cardArtIconId}
              onSelectIcon=${(id, svgText) => {
                onChangeCard({
                  ...card,
                  cardArtType: 'icon',
                  cardArtIconId: id,
                  cardArtSvg: svgText,
                  cardArt: null  // clear any uploaded image when icon is chosen
                });
                setShowArtModal(false);
              }}
            />
          </div>
        </div>
      `}
    </div>
  `;
}
