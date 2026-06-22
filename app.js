import { h, render } from 'https://esm.sh/preact@10.19.6';
import { useState, useEffect } from 'https://esm.sh/preact@10.19.6/hooks';
import htm from 'https://esm.sh/htm@3.1.1';

// Import Custom components
import Header from './components/Header.js';
import CardCreator from './components/CardCreator.js';
import CardPreview from './components/CardPreview.js';
import CardLibrary from './components/CardLibrary.js';
import CardSheetBuilder from './components/CardSheetBuilder.js';
import AuthModal from './components/AuthModal.js';

// Import Database & Utilities
import * as localDB from './utils/db.js';
import * as cloudDB from './utils/firestoreDB.js';
import { auth, isFirebaseConfigured } from './utils/firebase.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { packCards, getNextAvailablePosition, CARD_SIZES, getSizeForType } from './utils/binPacker.js';
import { exportSheetsToPDF } from './utils/pdfExporter.js';

const html = htm.bind(h);

const DEFAULT_CARD = {
  title: 'Eldritch Flame',
  size: 'poker',
  cardType: 'attack',
  iconType: 'vector',
  iconId: 'flame',
  iconSvgPath: 'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3.5z',
  iconUpload: null,
  headline: 'Spell - Fire Element',
  description: 'Launch a sphere of crackling flame. Deals 6 Magic Fire damage and inflicts a Burning status effect on all enemies in the target row.',
  bottomLeft: 'Cost: 2 Mana',
  bottomRight: 'Rare Item',
  bgColor: '#ffffff',
  textColor: '#1a1a1a',
  themeColor: '#f43f5e',
  iconColor: '#f43f5e',
  cardArt: null,
  cardBackImage: null,
  titleFont: 'Outfit',
  bodyFont: 'Inter',

  // Art overlay icon details
  artIconType: 'none', 
  artIconId: null,
  artIconSvgPath: null,
  artIconUpload: null,
  artIconColor: '#f43f5e',

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
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [sheetCount, setSheetCount] = useState(1);

  // Auth state
  const [currentUser, setCurrentUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [migrationPending, setMigrationPending] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Theme state — persisted in localStorage, default dark
  const [theme, setTheme] = useState(() => localStorage.getItem('cardforge-theme') || 'dark');

  // Per-card-type defaults (e.g., default back image). Persisted in localStorage.
  const [cardTypeDefaults, setCardTypeDefaults] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('cardforge-cardTypeDefaults') || '{}');
    } catch (e) {
      return {};
    }
  });

  // Sync theme attribute to <html> and persist
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('cardforge-theme', theme);
  }, [theme]);

  // Persist card type defaults
  useEffect(() => {
    try {
      localStorage.setItem('cardforge-cardTypeDefaults', JSON.stringify(cardTypeDefaults || {}));
    } catch (e) {
      console.warn('Failed to persist cardTypeDefaults', e);
    }
  }, [cardTypeDefaults]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');
  
  // PDF Export loading state
  const [exportProgress, setExportProgress] = useState(null); // null or percentage (0-100)

  // Normalize legacy cards that only store `size` (no `cardType`)
  function normalizeCards(cards) {
    return cards.map(c => {
      if (!c.cardType) {
        return { ...c, cardType: c.size === 'large' ? 'class' : 'attack' };
      }
      return c;
    });
  }

  function applySheetState(sheetData, cardsById) {
    if (!sheetData || !sheetData.items) return;
    // Cloud sheets use compact format { id, cardId, ... }; local sheets have full card objects
    const items = sheetData.items.map(item => {
      if (item.card) return item; // local format — already has card
      const card = cardsById ? cardsById[item.cardId] : null;
      return card ? { ...item, card } : null;
    }).filter(Boolean);
    setSheetItems(items);
    if (sheetData.pageCount && Number.isInteger(sheetData.pageCount) && sheetData.pageCount > 0) {
      setSheetCount(sheetData.pageCount);
    } else if (items.length > 0) {
      setSheetCount(Math.max(0, ...items.map(i => i.sheetIndex || 0)) + 1);
    }
    setActiveSheetIndex(0);
  }

  // Load data on mount and whenever auth state changes
  useEffect(() => {
    if (!isFirebaseConfigured) {
      // Firebase not set up yet — always use local storage
      localDB.getCards().then(saved => {
        setLibraryCards(normalizeCards(saved));
        return localDB.getSheets();
      }).then(savedSheets => {
        if (savedSheets?.length > 0) applySheetState(savedSheets[0], null);
        setAuthReady(true);
      }).catch(err => {
        console.error('Failed to load local data:', err);
        setAuthReady(true);
      });
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      try {
        if (user) {
          // Logged in — load from Firestore
          const cloudCards = await cloudDB.getCards(user.uid);
          const normalized = normalizeCards(cloudCards);
          setLibraryCards(normalized);

          const cardsById = Object.fromEntries(normalized.map(c => [c.id, c]));
          const savedSheets = await cloudDB.getSheets(user.uid);
          if (savedSheets?.length > 0) {
            applySheetState(savedSheets[0], cardsById);
          } else {
            // No cloud data yet — offer to migrate local cards
            const localCards = await localDB.getCards();
            if (localCards.length > 0) setMigrationPending(true);
          }
        } else {
          // Not logged in — load from IndexedDB
          const saved = await localDB.getCards();
          setLibraryCards(normalizeCards(saved));
          const savedSheets = await localDB.getSheets();
          if (savedSheets?.length > 0) applySheetState(savedSheets[0], null);
        }
      } catch (err) {
        console.error('Failed to load data:', err);
      } finally {
        setAuthReady(true);
      }
    });

    return unsubscribe;
  }, []);

  // Auto-save sheets whenever items or page count change
  useEffect(() => {
    if (!authReady) return;

    const saveTimeout = setTimeout(async () => {
      try {
        if (sheetItems.length > 0 || sheetCount > 1) {
          if (currentUser && isFirebaseConfigured) {
            // Compact format for Firestore — strip full card objects, store only cardId
            const compactItems = sheetItems.map(item => ({
              id: item.id,
              cardId: item.card?.id || item.cardId,
              sheetIndex: item.sheetIndex,
              x: item.x,
              y: item.y,
              w: item.w,
              h: item.h
            }));
            await cloudDB.saveSheets(currentUser.uid, { items: compactItems, pageCount: sheetCount });
          } else {
            await localDB.saveSheets({ items: sheetItems, pageCount: sheetCount });
          }
        } else {
          if (currentUser && isFirebaseConfigured) {
            await cloudDB.clearSheets(currentUser.uid);
          } else {
            await localDB.clearSheets();
          }
        }
      } catch (err) {
        console.error('Failed to auto-save sheet layouts:', err);
      }
    }, 500);

    return () => clearTimeout(saveTimeout);
  }, [sheetItems, sheetCount, currentUser, authReady]);

  // Save Card to Library
  const handleSaveCard = async () => {
    try {
      const cardToSave = {
        ...currentCard,
        id: currentCard.id || `card-${Date.now()}`
      };

      let saved;
      if (currentUser && isFirebaseConfigured) {
        saved = await cloudDB.saveCard(currentUser.uid, cardToSave);
      } else {
        saved = await localDB.saveCard(cardToSave);
      }

      setLibraryCards(prev => {
        const idx = prev.findIndex(c => c.id === saved.id);
        if (idx >= 0) {
          const clone = [...prev];
          clone[idx] = saved;
          return clone;
        }
        return [saved, ...prev];
      });

      // Sync updated card to all sheet instances that reference it
      setSheetItems(prev => prev.map(item =>
        item.card?.id === saved.id ? { ...item, card: saved } : item
      ));

      // Keep local image data in editor (Firestore version may have Storage URLs)
      setCurrentCard(cardToSave);

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
      let saved;
      if (currentUser && isFirebaseConfigured) {
        saved = await cloudDB.saveCard(currentUser.uid, newCard);
      } else {
        saved = await localDB.saveCard(newCard);
      }
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
      if (currentUser && isFirebaseConfigured) {
        await cloudDB.deleteCard(currentUser.uid, cardId);
      } else {
        await localDB.deleteCard(cardId);
      }
      setLibraryCards(prev => prev.filter(c => c.id !== cardId));
      setSheetItems(prev => prev.filter(item => item.card.id !== cardId));
    } catch (err) {
      console.error('Failed to delete card:', err);
    }
  };

  // Sign out
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setMigrationPending(false);
      // onAuthStateChanged will fire with null and reload local data
    } catch (err) {
      console.error('Sign out failed:', err);
    }
  };

  // Migrate local IndexedDB cards up to the user's Firestore account
  const handleMigrateLocalData = async () => {
    if (!currentUser || !isFirebaseConfigured) return;
    setIsSyncing(true);
    try {
      const localCards = await localDB.getCards();
      for (const card of localCards) {
        await cloudDB.saveCard(currentUser.uid, card);
      }
      const localSheets = await localDB.getSheets();
      if (localSheets?.length > 0 && localSheets[0].items) {
        const compactItems = localSheets[0].items.map(item => ({
          id: item.id,
          cardId: item.card?.id || item.cardId,
          sheetIndex: item.sheetIndex,
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h
        }));
        await cloudDB.saveSheets(currentUser.uid, { items: compactItems, pageCount: localSheets[0].pageCount || 1 });
      }
      // Reload from cloud so UI reflects synced state
      const cloudCards = await cloudDB.getCards(currentUser.uid);
      const normalized = normalizeCards(cloudCards);
      setLibraryCards(normalized);
      const cardsById = Object.fromEntries(normalized.map(c => [c.id, c]));
      const savedSheets = await cloudDB.getSheets(currentUser.uid);
      if (savedSheets?.length > 0) applySheetState(savedSheets[0], cardsById);
      setMigrationPending(false);
    } catch (err) {
      console.error('Migration failed:', err);
      alert('Sync failed. Please try again.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Add card to sheet list
  const handleAddCardToSheet = (card) => {
    const sizeInfo = card.cardType ? getSizeForType(card.cardType) : (CARD_SIZES[card.size] || CARD_SIZES['poker']);

    const currentPageItems = sheetItems.filter(item => item.sheetIndex === activeSheetIndex);
    const nextPosition = getNextAvailablePosition(currentPageItems, sizeInfo.width, sizeInfo.height);

    let targetIndex = activeSheetIndex;
    let x = 0.25;
    let y = 0.25;

    if (nextPosition) {
      x = nextPosition.x;
      y = nextPosition.y;
    } else {
      // Current page is full; create a new page for the item.
      targetIndex = sheetCount;
      setSheetCount(sheetCount + 1);
      setActiveSheetIndex(targetIndex);
    }

    const newInstance = {
      id: `instance-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      card: card,
      sheetIndex: targetIndex,
      x,
      y,
      w: sizeInfo.width,
      h: sizeInfo.height
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

  // Bulk import handler: accept rows and per-row quantities, save cards to library, place copies on sheets
  const handleBulkImport = async (rows, quantities = []) => {
    if (!rows || !rows.length) return { imported: 0, errors: [], sheetsCreated: 0 };
    const results = [];
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const title = row.title || row.Title || `Imported Card ${Date.now()}-${i}`;
        let cardType = (row.cardType || row.CardType || row.type || row.Type || '').toString().toLowerCase();
        if (!cardType) {
          const sizeVal = (row.size || row.Size || '').toString().toLowerCase();
          cardType = (sizeVal === 'large' || sizeVal === 'class') ? 'class' : 'attack';
        }

        const cardObj = {
          ...DEFAULT_CARD,
          id: `card-${Date.now()}-${i}`,
          title: title,
          cardType: cardType,
          size: row.size || (cardType === 'class' ? 'large' : 'poker'),
          headline: row.headline || row.Headline || DEFAULT_CARD.headline,
          description: row.description || row.Description || DEFAULT_CARD.description,
          bottomLeft: row.bottomLeft || row.BottomLeft || '',
          bottomRight: row.bottomRight || row.BottomRight || '',
          bgColor: row.bgColor || DEFAULT_CARD.bgColor,
          textColor: row.textColor || DEFAULT_CARD.textColor,
          themeColor: row.themeColor || DEFAULT_CARD.themeColor,
          iconType: row.iconType || row.icontype || DEFAULT_CARD.iconType,
          iconId: row.iconId || row.iconid || row.icon || DEFAULT_CARD.iconId,
          iconUpload: row.iconUpload || row.iconupload || null,
          cardArt: row.cardArt || row.cardart || null,
          cardBackImage: row.cardBackImage || row.cardbackimage || null,
        };

        const saved = currentUser && isFirebaseConfigured
          ? await cloudDB.saveCard(currentUser.uid, cardObj)
          : await localDB.saveCard(cardObj);
        results.push(saved);
      } catch (err) {
        errors.push({ row: i, error: err.message || String(err) });
      }
    }

    if (results.length > 0) {
      setLibraryCards(prev => [...results.slice().reverse(), ...prev]);
    }

    // Place copies on sheets according to quantities
    const totalCopies = quantities.reduce((sum, q) => sum + (Number(q) || 0), 0);
    let sheetsCreated = 0;

    if (totalCopies > 0 && results.length > 0) {
      // Build sheet items iteratively so each placement sees prior items
      let currentItems = [...sheetItems];
      let currentCount = sheetCount;
      // Start placing on the last existing sheet (or sheet 0)
      let placeOnIndex = currentItems.length > 0
        ? Math.max(...currentItems.map(item => item.sheetIndex))
        : 0;
      const origSheetCount = currentCount;

      for (let i = 0; i < results.length; i++) {
        const card = results[i];
        const qty = Math.max(0, Math.floor(Number(quantities[i]) || 0));
        const sizeInfo = getSizeForType(card.cardType);

        for (let q = 0; q < qty; q++) {
          const pageItems = currentItems.filter(item => item.sheetIndex === placeOnIndex);
          const pos = getNextAvailablePosition(pageItems, sizeInfo.width, sizeInfo.height);

          let x, y, targetIndex;
          if (pos) {
            x = pos.x; y = pos.y; targetIndex = placeOnIndex;
          } else {
            // Current sheet is full — start a new one
            currentCount++;
            placeOnIndex = currentCount - 1;
            targetIndex = placeOnIndex;
            const newPos = getNextAvailablePosition([], sizeInfo.width, sizeInfo.height);
            x = newPos.x; y = newPos.y;
          }

          currentItems.push({
            id: `instance-${Date.now()}-${i}-${q}-${Math.random().toString(36).substr(2, 5)}`,
            card,
            sheetIndex: targetIndex,
            x, y,
            w: sizeInfo.width,
            h: sizeInfo.height
          });
        }
      }

      sheetsCreated = currentCount - origSheetCount;
      setSheetItems(currentItems);
      setSheetCount(currentCount);
      setActiveSheetIndex(placeOnIndex);
    }

    return { imported: results.length, errors, sheetsCreated };
  };

  const buildSheetModels = () => {
    const sheets = Array.from({ length: sheetCount }, (_, idx) => ({
      id: `sheet-${idx + 1}`,
      cards: []
    }));

    sheetItems.forEach(item => {
      const index = Number.isInteger(item.sheetIndex) && item.sheetIndex >= 0 && item.sheetIndex < sheetCount
        ? item.sheetIndex
        : 0;
      sheets[index].cards.push(item);
    });

    return sheets;
  };

  // Export positioned sheet elements to PDF
  const handleExportPDF = async () => {
    if (sheetItems.length === 0 && sheetCount === 1) return;
    
    setExportProgress(10);
    try {
      // 1. Use existing sheet grouping to preserve page layouts
      const sheets = buildSheetModels();
      
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
        currentUser=${currentUser}
        onShowAuth=${() => setShowAuthModal(true)}
        onSignOut=${handleSignOut}
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
              
              <${CardPreview} card=${currentCard} cardTypeDefaults=${cardTypeDefaults} />
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
              onBulkImport=${handleBulkImport}
              onGoToSheetBuilder=${() => setActiveTab('sheet-builder')}
              cardTypeDefaults=${cardTypeDefaults}
              setCardTypeDefaults=${setCardTypeDefaults}
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
              activeSheetIndex=${activeSheetIndex}
              setActiveSheetIndex=${setActiveSheetIndex}
              sheetCount=${sheetCount}
              setSheetCount=${setSheetCount}
            />
          </div>
        `}

      </main>

      <!-- AUTH MODAL -->
      ${showAuthModal && html`<${AuthModal} onClose=${() => setShowAuthModal(false)} />`}

      <!-- LOCAL DATA MIGRATION PROMPT -->
      ${migrationPending && html`
        <div class="modal-overlay z-index-top">
          <div class="modal-content glass-panel animate-zoom-in migration-modal">
            <h3>Sync your local cards?</h3>
            <p>You have cards saved in this browser that aren't in your cloud account yet. Would you like to sync them?</p>
            <div class="migration-actions">
              <button class="primary-glow-btn" onClick=${handleMigrateLocalData} disabled=${isSyncing}>
                ${isSyncing ? 'Syncing...' : 'Yes, sync my cards'}
              </button>
              <button class="secondary-btn" onClick=${() => setMigrationPending(false)}>Skip</button>
            </div>
          </div>
        </div>
      `}

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
