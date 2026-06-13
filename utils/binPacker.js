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

// Logical card types used in the app. These map to physical sizes above.
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
    const sizeInfo = item.card.cardType ? getSizeForType(item.card.cardType) : (CARD_SIZES[item.card.size] || CARD_SIZES['poker']);
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

  return sheets;
}
