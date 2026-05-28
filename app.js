import { h, render } from 'https://esm.sh/preact@10.19.6';
import { useState, useEffect } from 'https://esm.sh/preact@10.19.6/hooks';
import htm from 'https://esm.sh/htm@3.1.1';

// Import Custom components
import Header from './components/Header.js';
import CardCreator from './components/CardCreator.js';
import CardPreview from './components/CardPreview.js';
import CardLibrary from './components/CardLibrary.js';
import CardSheetBuilder from './components/CardSheetBuilder.js';

// Import Database & Utilities
import { getCards, saveCard, deleteCard } from './utils/db.js';
import { packCards } from './utils/binPacker.js';
import { exportSheetsToPDF } from './utils/pdfExporter.js';

const html = htm.bind(h);

const DEFAULT_CARD = {
  title: 'Eldritch Flame',
  size: 'poker',
  iconType: 'vector',
  iconId: 'flame',
  iconSvgPath: 'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3.5z',
  iconUpload: null,
  headline: 'Spell - Fire Element',
  description: 'Launch a sphere of crackling flame. Deals 6 Magic Fire damage and inflicts a Burning status effect on all enemies in the target row.',
  bottomLeft: 'Cost: 2 Mana',
  bottomRight: 'Rare Item',
  bgColor: '#1a0d1a',
  textColor: '#fce7f3',
  themeColor: '#f43f5e',
  cardArt: null,
  cardBackImage: null,
  titleFont: 'Outfit',
  bodyFont: 'Inter',

  // Art overlay icon details
  artIconType: 'none', 
  artIconId: null,
  artIconSvgPath: null,
  artIconUpload: null,

  // Modular ability section fields (for Large 3"x5" template size)
  ability1Points: '1 AP',
  ability1Title: 'Slash',
  ability1Desc: 'Deals 3 physical damage to the target.',
  
  ability2Points: '2 AP',
  ability2Title: 'Flame Shield',
  ability2Desc: 'Gain a protective fire barrier that inflicts 1 burn damage to attackers.',
  
  ultimatePoints: '5 AP',
  ultimateTitle: 'Supernova',
  ultimateDesc: 'Unleashes massive fire wave. Deals 12 fire damage to all active targets and inflicts burn.'
};

function App() {
  const [activeTab, setActiveTab] = useState('creator');
  const [libraryCards, setLibraryCards] = useState([]);
  const [currentCard, setCurrentCard] = useState({ ...DEFAULT_CARD, id: `card-${Date.now()}` });
  const [sheetItems, setSheetItems] = useState([]); // Array of positioned instances: { id, card, sheetIndex, x, y, w, h }

  // Theme state — persisted in localStorage, default dark
  const [theme, setTheme] = useState(() => localStorage.getItem('cardforge-theme') || 'dark');

  // Sync theme attribute to <html> and persist
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('cardforge-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');
  
  // PDF Export loading state
  const [exportProgress, setExportProgress] = useState(null); // null or percentage (0-100)

  // Load cards from DB on mount
  useEffect(() => {
    async function loadInitialData() {
      try {
        const saved = await getCards();
        setLibraryCards(saved);
      } catch (err) {
        console.error('Failed to load card templates from database:', err);
      }
    }
    loadInitialData();
  }, []);

  // Save Card to Library
  const handleSaveCard = async () => {
    try {
      const cardToSave = {
        ...currentCard,
        id: currentCard.id || `card-${Date.now()}`
      };
      
      const saved = await saveCard(cardToSave);
      
      // Update state
      setLibraryCards(prev => {
        const idx = prev.findIndex(c => c.id === saved.id);
        if (idx >= 0) {
          const clone = [...prev];
          clone[idx] = saved;
          return clone;
        }
        return [saved, ...prev];
      });

      // Update current card id if newly created
      setCurrentCard(cardToSave);

      // Fire victory confetti micro-delight
      if (window.confetti) {
        window.confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.8 },
          colors: [cardToSave.themeColor || '#6366f1', '#a855f7', '#3b82f6']
        });
      }

    } catch (err) {
      console.error('Failed to save card template:', err);
      alert('Error saving card to database.');
    }
  };

  // Edit Card: Load from library into editor
  const handleEditCard = (card) => {
    setCurrentCard({ ...card });
    setActiveTab('creator');
  };

  // Duplicate Card
  const handleDuplicateCard = async (card) => {
    try {
      const newCard = {
        ...card,
        id: `card-${Date.now()}`,
        title: `${card.title} (Copy)`
      };
      const saved = await saveCard(newCard);
      setLibraryCards(prev => [saved, ...prev]);

      if (window.confetti) {
        window.confetti({
          particleCount: 40,
          spread: 40,
          origin: { y: 0.8 }
        });
      }
    } catch (err) {
      console.error('Failed to duplicate card template:', err);
    }
  };

  // Delete Card
  const handleDeleteCard = async (cardId) => {
    try {
      await deleteCard(cardId);
      setLibraryCards(prev => prev.filter(c => c.id !== cardId));
      
      // Clean up any positioned instances from print layouts
      setSheetItems(prev => prev.filter(item => item.card.id !== cardId));
    } catch (err) {
      console.error('Failed to delete card:', err);
    }
  };

  // Add card to sheet list
  const handleAddCardToSheet = (card) => {
    const sizeInfo = card.size ? card.size : 'poker';
    const cardSize = card.size === 'tarot' ? { w: 2.75, h: 4.75 } : 
                     card.size === 'bridge' ? { w: 2.25, h: 3.5 } :
                     card.size === 'mini' ? { w: 1.75, h: 2.5 } :
                     card.size === 'square' ? { w: 2.5, h: 2.5 } :
                     card.size === 'business' ? { w: 2.0, h: 3.5 } :
                     card.size === 'large' ? { w: 3.0, h: 5.0 } :
                     { w: 2.5, h: 3.5 }; // Poker size default

    const newInstance = {
      id: `instance-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      card: card,
      sheetIndex: 0, // default first page
      x: 0.25, // default margins
      y: 0.25,
      w: cardSize.w,
      h: cardSize.h
    };

    setSheetItems(prev => [...prev, newInstance]);
    setActiveTab('sheet-builder');

    if (window.confetti) {
      window.confetti({
        particleCount: 30,
        spread: 30,
        origin: { y: 0.8 },
        colors: [card.themeColor || '#6366f1']
      });
    }
  };

  // Export positioned sheet elements to PDF
  const handleExportPDF = async () => {
    if (sheetItems.length === 0) return;
    
    setExportProgress(10);
    try {
      // 1. Package the positioned cards into clean sheet models
      const sheets = packCards(sheetItems);
      
      // 2. Fire high-res PDF generation
      await exportSheetsToPDF(sheets, (progress) => {
        setExportProgress(progress);
      });

      setExportProgress(100);
      setTimeout(() => {
        setExportProgress(null);
        if (window.confetti) {
          window.confetti({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.5 }
          });
        }
      }, 800);

    } catch (err) {
      console.error('PDF export failed:', err);
      alert('Error generating print layout PDF.');
      setExportProgress(null);
    }
  };

  // Load a brand new blank template
  const handleNewCard = () => {
    setCurrentCard({
      ...DEFAULT_CARD,
      id: `card-${Date.now()}`,
      title: 'Blank Card'
    });
  };

  return html`
    <div class="app-container">
      <!-- HEADER COMPONENT -->
      <${Header} 
        activeTab=${activeTab} 
        setActiveTab=${setActiveTab} 
        libraryCount=${libraryCards.length}
        theme=${theme}
        onToggleTheme=${toggleTheme}
      />

      <main class="app-main-content">
        
        <!-- CARD CREATOR WORKSPACE -->
        ${activeTab === 'creator' && html`
          <div class="creator-workspace animate-fade-in">
            <div class="creator-editor-side">
              <div class="creator-headline-action">
                <h2>Design Arena</h2>
                <button class="new-card-btn secondary-btn" onClick=${handleNewCard}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" class="margin-right-xs">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  New Template
                </button>
              </div>
              <${CardCreator} 
                card=${currentCard} 
                onChangeCard=${setCurrentCard} 
                onSaveCard=${handleSaveCard} 
              />
            </div>
            
            <div class="creator-preview-side">
              <div class="preview-headline">
                <h3>Live Showcase Preview</h3>
                <span class="preview-hint">Move mouse over card for glowing 3D perspective</span>
              </div>
              
              <${CardPreview} card=${currentCard} />
            </div>
          </div>
        `}

        <!-- CARD LIBRARY PAGE -->
        ${activeTab === 'library' && html`
          <div class="library-workspace">
            <div class="library-title-row">
              <div>
                <h2>Your Forge Library</h2>
                <p class="subtitle-desc">Browse, manage, copy, and select created templates to assemble into printable layouts</p>
              </div>
            </div>
            
            <${CardLibrary} 
              cards=${libraryCards} 
              onEditCard=${handleEditCard} 
              onDuplicateCard=${handleDuplicateCard} 
              onDeleteCard=${handleDeleteCard} 
              onAddCardToSheet=${handleAddCardToSheet} 
            />
          </div>
        `}

        <!-- CARD SHEET BUILDER PAGE -->
        ${activeTab === 'sheet-builder' && html`
          <div class="sheet-builder-workspace">
            <div class="sheet-builder-title-row">
              <div>
                <h2>Duplex Sheet Assembler</h2>
                <p class="subtitle-desc">Position templates onto 8.5" × 11" pages. Safe printable borders and mirrored backs are coordinated automatically for double-sided prints.</p>
              </div>
            </div>

            <${CardSheetBuilder} 
              libraryCards=${libraryCards} 
              sheetItems=${sheetItems} 
              setSheetItems=${setSheetItems} 
              onExportPDF=${handleExportPDF} 
            />
          </div>
        `}

      </main>

      <!-- PDF GENERATION EXPORT LOADING MODAL -->
      ${exportProgress !== null && html`
        <div class="modal-overlay z-index-top">
          <div class="modal-content glass-panel animate-zoom-in text-center export-modal">
            <h3>Compiling High-Resolution PDF</h3>
            <p>Drawing custom vector cards, textures, and typography coordinates...</p>
            
            <div class="progress-bar-container">
              <div class="progress-bar-fill" style="width: ${exportProgress}%"></div>
            </div>
            
            <span class="progress-label-percent">${exportProgress}% Rendered</span>
          </div>
        </div>
      `}
    </div>
  `;
}

// Bootstrap Preact to DOM element
render(html`<${App} />`, document.getElementById('app'));
