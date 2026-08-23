/**
 * Intelligent Shelf Bin Packer for Card Builder
 * Packs cards of varying sizes into standard 8.5" x 11" Letter sheets.
 * All dimensions are in inches for precision printing.
 */

export const SHEET_WIDTH = 8.5;
export const SHEET_HEIGHT = 11.0;
export const MARGIN = 0.25; // 0.25" printer safety margins
export const MAX_WIDTH = SHEET_WIDTH - (MARGIN * 2); // 8.0" printable width
export const MAX_HEIGHT = SHEET_HEIGHT - (MARGIN * 2); // 10.5" printable height

export const CARD_SIZES = {
  'poker': { name: 'Poker', width: 2.5, height: 3.5 },
  'bridge': { name: 'Bridge', width: 2.25, height: 3.5 },
  'tarot': { name: 'Tarot', width: 2.75, height: 4.75 },
  'mini': { name: 'Mini', width: 1.75, height: 2.5 },
  'square': { name: 'Square', width: 2.5, height: 2.5 },
  'business': { name: 'Business Card', width: 2.0, height: 3.5 },
  'large': { name: 'Large Size', width: 3.0, height: 5.0 }
};

// --- Print-service bleed & safe-zone spec (matches The Game Crafter's
// published card proofing template: https://help.thegamecrafter.com/article/391-bleed )
// CARD_SIZES above are FINISHED/TRIM sizes — the size the card is cut to.
// Print files need extra artwork bleeding past that trim edge so a die-cut
// wobble never exposes white, and all text must stay clear of the trim
// line by a further safety margin.
export const BLEED = 0.125;      // inches of art bleed added beyond the trim edge, per side
export const SAFE_ZONE = 0.25;   // inches from the bleed (outer file) edge that text/art must stay inside — i.e. 0.125" inside the trim line

// Inset (from the trim edge, i.e. the live preview's own box / the export's
// (0,0)-(w,h) trim-box coordinates) that the SAFE_ZONE line sits at.
export const SAFE_ZONE_INSET = SAFE_ZONE - BLEED; // 0.125"

// Inset the decorative trim border (and the plain card-back border) is
// drawn at, in both the live preview and the exported PNG. Deliberately
// larger than SAFE_ZONE_INSET (not just equal to it) so the border reads as
// clearly *inside* the dashed safe-zone guide with real breathing room,
// including clearing the guide's own rounded corners near the card's
// corners, rather than sitting flush against (or past) the line.
export const CONTENT_INSET = 0.2; // inches

// Inset title/art/description/footer content is drawn at -- further in
// than CONTENT_INSET so there's a visible gap between the trim border and
// the content, instead of both sitting flush against each other (text
// touching the border, the art frame's background painting over it).
export const CONTENT_PADDING = 0.3; // inches

/**
 * Given a trim-size sizeInfo (as returned by getCardSize), returns the
 * bleed-inclusive output dimensions used for print-ready exports.
 * Custom pixel sizes are assumed to already be the print service's exact
 * template size (bleed included, per the "Exact Pixel Size" hint text), so
 * they pass through unchanged rather than getting bleed added on top.
 */
export function getBleedSize(sizeInfo) {
  if (!sizeInfo || sizeInfo.isCustom) {
    return { bleedWidth: sizeInfo.width, bleedHeight: sizeInfo.height, hasBleed: false };
  }
  return {
    bleedWidth: sizeInfo.width + BLEED * 2,
    bleedHeight: sizeInfo.height + BLEED * 2,
    hasBleed: true
  };
}

// Legacy logical card types (attack/modifier/class) from an earlier version
// of the app, which mapped each type to one fixed physical size. Cards are
// now sized directly via CARD_SIZES/`card.size`; this is kept only to
// resolve the size of old cards that still carry a `cardType` field.
export const CARD_TYPES = {
  'attack': { name: 'Attack', sizeKey: 'poker' },
  'modifier': { name: 'Modifier', sizeKey: 'poker' },
  'class': { name: 'Class', sizeKey: 'large' }
};

export function getSizeForType(cardType) {
  if (!cardType) return CARD_SIZES['poker'];
  const type = CARD_TYPES[cardType.toLowerCase()];
  if (!type) return CARD_SIZES['poker'];
  return CARD_SIZES[type.sizeKey] || CARD_SIZES['poker'];
}

// Fixed rendering resolution (pixels per inch) shared by the live preview,
// the print-sheet PDF export, and single-card PNG export.
export const DPI = 300;

/**
 * Resolves the working width/height (in inches) for a card.
 * If the card has an exact custom pixel size set (e.g. to match a print
 * service's required dimensions, like The Game Crafter's card templates),
 * that takes priority over the card type/size preset. The card's type
 * still controls which layout template is rendered — custom sizing only
 * overrides the physical output dimensions.
 */
export function getCardSize(card) {
  if (!card) return CARD_SIZES['poker'];

  if (card.sizeMode === 'custom') {
    const widthPx = Number(card.customWidthPx);
    const heightPx = Number(card.customHeightPx);
    if (widthPx > 0 && heightPx > 0) {
      return {
        name: 'Custom',
        width: widthPx / DPI,
        height: heightPx / DPI,
        widthPx,
        heightPx,
        isCustom: true
      };
    }
  }

  if (card.size && CARD_SIZES[card.size]) return CARD_SIZES[card.size];
  // Legacy fallback for cards saved under the older attack/modifier/class
  // card-type system, which had no explicit `size` field of its own.
  if (card.cardType) return getSizeForType(card.cardType);
  return CARD_SIZES['poker'];
}

export function getNextAvailablePosition(existingItems, itemWidth, itemHeight, pageWidth = SHEET_WIDTH, pageHeight = SHEET_HEIGHT, margin = MARGIN) {
  const minX = margin;
  const maxX = pageWidth - margin;
  const maxY = pageHeight - margin - itemHeight;
  const candidates = new Set([margin]);

  existingItems.forEach(item => {
    const top = item.y;
    const bottom = item.y + item.h;
    if (top >= margin && top <= maxY) candidates.add(top);
    if (bottom >= margin && bottom <= maxY) candidates.add(bottom);
  });

  const sortedY = Array.from(candidates).sort((a, b) => a - b);

  for (const y of sortedY) {
    if (y > maxY) continue;

    // Determine horizontal blockers for this Y range
    const blockers = existingItems
      .filter(item => !(item.y + item.h <= y || item.y >= y + itemHeight))
      .map(item => [item.x, item.x + item.w])
      .sort((a, b) => a[0] - b[0]);

    const merged = [];
    for (const interval of blockers) {
      if (!merged.length) {
        merged.push([...interval]);
      } else {
        const last = merged[merged.length - 1];
        if (interval[0] <= last[1]) {
          last[1] = Math.max(last[1], interval[1]);
        } else {
          merged.push([...interval]);
        }
      }
    }

    let nextX = minX;
    if (merged.length === 0) {
      if (nextX + itemWidth <= maxX) return { x: nextX, y };
      continue;
    }

    if (merged[0][0] - nextX >= itemWidth) {
      return { x: nextX, y };
    }

    for (let i = 0; i < merged.length; i++) {
      nextX = merged[i][1];
      if (nextX < minX) nextX = minX;
      const gapEnd = (i === merged.length - 1) ? maxX : merged[i + 1][0];
      if (nextX + itemWidth <= gapEnd && nextX + itemWidth <= maxX) {
        return { x: nextX, y };
      }
      nextX = gapEnd;
    }
  }

  return null;
}


/**
 * Packs a list of card items into one or more sheets.
 * Each card item has a unique ID and a card template reference.
 * Uses a classic 2D Shelf First-Fit (SFF) algorithm.
 * 
 * @param {Array} items - Array of { id, cardTemplate }
 * @returns {Array} - Array of sheets, each being { id, cards: [{ id, card, x, y, w, h }] }
 */
export function packCards(items) {
  if (!items || items.length === 0) return [];

  // Clone items to avoid mutating inputs and resolve their dimensions
  const cardsToPack = items.map(item => {
    const sizeInfo = getCardSize(item.card);
    return {
      id: item.id,
      card: item.card,
      w: sizeInfo.width,
      h: sizeInfo.height
    };
  });

  const sheets = [];
  let currentSheetIndex = 0;

  function createNewSheet() {
    return {
      id: `sheet-${Date.now()}-${currentSheetIndex++}`,
      cards: []
    };
  }

  let activeSheet = createNewSheet();
  sheets.push(activeSheet);

  // We maintain shelves for the current active sheet
  // A shelf has: y (start height), h (height of tallest card on shelf), currentX (next available slot)
  let shelves = [];

  for (const item of cardsToPack) {
    let placed = false;

    // Check if the item can fit on any existing shelf in the active sheet
    for (let shelf of shelves) {
      if (shelf.currentX + item.w <= MAX_WIDTH && item.h <= shelf.h) {
        // Fits!
        activeSheet.cards.push({
          id: item.id,
          card: item.card,
          x: MARGIN + shelf.currentX,
          y: MARGIN + shelf.y,
          w: item.w,
          h: item.h
        });
        shelf.currentX += item.w;
        placed = true;
        break;
      }
    }

    if (placed) continue;

    // Try to create a new shelf on the active sheet
    let newShelfY = 0;
    if (shelves.length > 0) {
      const lastShelf = shelves[shelves.length - 1];
      newShelfY = lastShelf.y + lastShelf.h;
    }

    // Check if this new shelf would exceed the sheet height
    if (newShelfY + item.h <= MAX_HEIGHT) {
      const newShelf = {
        y: newShelfY,
        h: item.h,
        currentX: item.w
      };
      shelves.push(newShelf);
      activeSheet.cards.push({
        id: item.id,
        card: item.card,
        x: MARGIN,
        y: MARGIN + newShelf.y,
        w: item.w,
        h: item.h
      });
      placed = true;
    }

    if (placed) continue;

    // If it doesn't fit on the active sheet, start a new sheet!
    activeSheet = createNewSheet();
    sheets.push(activeSheet);
    
    // Reset shelves for the new sheet
    const firstShelf = {
      y: 0,
      h: item.h,
      currentX: item.w
    };
    shelves = [firstShelf];
    
    activeSheet.cards.push({
      id: item.id,
      card: item.card,
      x: MARGIN,
      y: MARGIN,
      w: item.w,
      h: item.h
    });
  }

  // Redistribute x positions within each shelf row (space-between justification)
  for (const sheet of sheets) {
    const rows = new Map();
    for (const card of sheet.cards) {
      const key = card.y;
      if (!rows.has(key)) rows.set(key, []);
      rows.get(key).push(card);
    }

    for (const rowCards of rows.values()) {
      rowCards.sort((a, b) => a.x - b.x);
      const totalCardWidth = rowCards.reduce((sum, c) => sum + c.w, 0);
      const gap = rowCards.length > 1
        ? (MAX_WIDTH - totalCardWidth) / (rowCards.length - 1)
        : 0;
      let currentX = MARGIN;
      for (const card of rowCards) {
        card.x = currentX;
        currentX += card.w + gap;
      }
    }
  }

  return sheets;
}
