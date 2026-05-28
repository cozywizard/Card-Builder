/**
 * High-Resolution PDF Exporter for CardForge
 * Translates sheet structures into a premium, duplex-aligned PDF.
 * Uses jsPDF for rendering and a 300 DPI HTML Canvas for high fidelity.
 */

import { CARD_SIZES, SHEET_WIDTH, SHEET_HEIGHT } from './binPacker.js';

// DPI resolution for printing
const DPI = 300;
const INCH_TO_PX = DPI; 

/**
 * Loads a base64 or URL image asynchronously
 */
function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Ensures Google Font is loaded inside browser session before rendering to Canvas
 */
async function ensureFontLoaded(fontName) {
  if (!fontName) return;
  const id = `gfont-${fontName.replace(/\s+/g, '-').toLowerCase()}`;
  if (!document.getElementById(id)) {
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/\s+/g, '+')}:wght@400;500;700;800&display=swap`;
    document.head.appendChild(link);
  }
  
  try {
    // Wait for the font face to be loaded
    await document.fonts.load(`1em "${fontName}"`);
  } catch (e) {
    console.warn(`Font loading timed out or failed for: ${fontName}`, e);
  }
}

/**
 * Word wrapping helper for Canvas 2D
 */
function wrapCanvasText(ctx, text, maxWidth) {
  const words = text.split(' ');
  let line = '';
  let lines = [];
  
  for (let n = 0; n < words.length; n++) {
    let testLine = line + words[n] + ' ';
    let metrics = ctx.measureText(testLine);
    let testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      lines.push(line.trim());
      line = words[n] + ' ';
    } else {
      line = testLine;
    }
  }
  lines.push(line.trim());
  return lines;
}

/**
 * Helper to draw a rounded rectangle
 */
function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Draws a card onto a high-DPI canvas
 */
export async function renderCardToCanvas(card, canvas, side = 'front') {
  const size = CARD_SIZES[card.size] || CARD_SIZES['poker'];
  const w = size.width * INCH_TO_PX;
  const h = size.height * INCH_TO_PX;

  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  
  // Clear canvas
  ctx.clearRect(0, 0, w, h);

  // Load selected fonts dynamically before drawing
  await ensureFontLoaded(card.titleFont || 'Outfit');
  await ensureFontLoaded(card.bodyFont || 'Inter');

  if (side === 'front') {
    // 1. Draw Card Background
    ctx.fillStyle = card.bgColor || '#1e1e24';
    ctx.fillRect(0, 0, w, h);

    // Draw Subtle Outer Glow Border or Frame
    ctx.strokeStyle = card.themeColor || '#6366f1';
    ctx.lineWidth = 0.08 * INCH_TO_PX; // ~24px at 300 DPI
    ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);

    // 2. Card Header (Common for both layouts)
    ctx.fillStyle = card.textColor || '#ffffff';
    const titleFont = card.titleFont || 'Outfit';
    
    // Auto-scale title font based on title length
    let titleFontSize = 0.22 * INCH_TO_PX; // Default title size in inches
    const titleText = card.title || 'Untitled Card';
    if (titleText.length > 15) titleFontSize *= 0.8;
    if (titleText.length > 22) titleFontSize *= 0.7;

    ctx.font = `bold ${titleFontSize}px "${titleFont}", system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    
    const textMargin = 0.2 * INCH_TO_PX;
    
    // Calculate Title position based on layout
    const titleY = (card.size !== 'large' && card.cardArt) ? (h * 0.45) + (0.25 * INCH_TO_PX) : textMargin;
    ctx.fillText(titleText, textMargin, titleY);

    const bodyFont = card.bodyFont || 'Inter';
    const subFontSize = 0.12 * INCH_TO_PX;
    ctx.font = `500 ${subFontSize}px "${bodyFont}", system-ui, sans-serif`;
    ctx.fillStyle = card.themeColor || '#6366f1';
    
    const subY = titleY + titleFontSize + (0.05 * INCH_TO_PX);

    // --- RENDER DUPLEX LAYOUT: LARGE 3"x5" VS STANDARD ---
    if (card.size === 'large') {
      // Draw subheader
      ctx.fillText('LARGE HERO ABILITY TEMPLATE', textMargin, subY);

      // We render 3 ability sections: Ability 1 (Standard), Ability 2 (Standard), Ultimate
      const startY = 1.35 * INCH_TO_PX;
      const boxW = w - (textMargin * 2);
      const radius = 0.08 * INCH_TO_PX; // 24px

      // --- ABILITY 1 BLOCK ---
      const ab1Y = startY;
      const ab1H = 0.9 * INCH_TO_PX;
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      drawRoundedRect(ctx, textMargin, ab1Y, boxW, ab1H, radius);
      ctx.fill();
      ctx.stroke();

      // Draw Title
      ctx.fillStyle = card.textColor || '#ffffff';
      ctx.font = `bold ${0.14 * INCH_TO_PX}px "${titleFont}", system-ui, sans-serif`;
      ctx.fillText(card.ability1Title || 'Standard Ability 1', textMargin + 16, ab1Y + 12);

      // Draw AP Badge
      const ab1Cost = card.ability1Points || '1 AP';
      ctx.font = `bold ${0.10 * INCH_TO_PX}px "${bodyFont}", system-ui, sans-serif`;
      const costW1 = ctx.measureText(ab1Cost).width;
      ctx.strokeStyle = card.themeColor || '#6366f1';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(w - textMargin - costW1 - 20, ab1Y + 10, costW1 + 10, 0.18 * INCH_TO_PX);
      ctx.fillStyle = card.themeColor || '#6366f1';
      ctx.fillText(ab1Cost, w - textMargin - costW1 - 15, ab1Y + 12);

      // Draw Description
      ctx.fillStyle = (card.textColor || '#ffffff') + 'bb';
      ctx.font = `${0.11 * INCH_TO_PX}px "${bodyFont}", system-ui, sans-serif`;
      const lines1 = wrapCanvasText(ctx, card.ability1Desc || 'Deals physical damage or provides support properties.', boxW - 32);
      let textY1 = ab1Y + 45;
      for (const line of lines1) {
        ctx.fillText(line, textMargin + 16, textY1);
        textY1 += 0.15 * INCH_TO_PX;
      }
      ctx.restore();

      // --- ABILITY 2 BLOCK ---
      const ab2Y = ab1Y + ab1H + (0.15 * INCH_TO_PX);
      const ab2H = 0.9 * INCH_TO_PX;
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      drawRoundedRect(ctx, textMargin, ab2Y, boxW, ab2H, radius);
      ctx.fill();
      ctx.stroke();

      // Draw Title
      ctx.fillStyle = card.textColor || '#ffffff';
      ctx.font = `bold ${0.14 * INCH_TO_PX}px "${titleFont}", system-ui, sans-serif`;
      ctx.fillText(card.ability2Title || 'Standard Ability 2', textMargin + 16, ab2Y + 12);

      // Draw AP Badge
      const ab2Cost = card.ability2Points || '2 AP';
      ctx.font = `bold ${0.10 * INCH_TO_PX}px "${bodyFont}", system-ui, sans-serif`;
      const costW2 = ctx.measureText(ab2Cost).width;
      ctx.strokeStyle = card.themeColor || '#6366f1';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(w - textMargin - costW2 - 20, ab2Y + 10, costW2 + 10, 0.18 * INCH_TO_PX);
      ctx.fillStyle = card.themeColor || '#6366f1';
      ctx.fillText(ab2Cost, w - textMargin - costW2 - 15, ab2Y + 12);

      // Draw Description
      ctx.fillStyle = (card.textColor || '#ffffff') + 'bb';
      ctx.font = `${0.11 * INCH_TO_PX}px "${bodyFont}", system-ui, sans-serif`;
      const lines2 = wrapCanvasText(ctx, card.ability2Desc || 'Additional card power, defense, or utility.', boxW - 32);
      let textY2 = ab2Y + 45;
      for (const line of lines2) {
        ctx.fillText(line, textMargin + 16, textY2);
        textY2 += 0.15 * INCH_TO_PX;
      }
      ctx.restore();

      // --- ULTIMATE ABILITY BLOCK ---
      const ultY = ab2Y + ab2H + (0.15 * INCH_TO_PX);
      const ultH = 1.1 * INCH_TO_PX;
      ctx.save();
      ctx.fillStyle = 'rgba(244, 63, 94, 0.03)';
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.2)'; // Pink borders
      ctx.lineWidth = 2;
      drawRoundedRect(ctx, textMargin, ultY, boxW, ultH, radius);
      ctx.fill();
      ctx.stroke();

      // Draw Glowing Accent Border overlay
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.3)';
      ctx.shadowColor = '#f43f5e';
      ctx.shadowBlur = 10;
      ctx.lineWidth = 1;
      drawRoundedRect(ctx, textMargin, ultY, boxW, ultH, radius);
      ctx.stroke();
      ctx.shadowBlur = 0; // Reset shadow

      // Draw Title
      ctx.fillStyle = '#f43f5e'; // Ultimate pink
      ctx.font = `bold ${0.15 * INCH_TO_PX}px "${titleFont}", system-ui, sans-serif`;
      ctx.fillText(card.ultimateTitle || 'Ultimate Ability', textMargin + 16, ultY + 14);

      // Draw Ultimate AP Badge
      const ultCost = card.ultimatePoints || '5 AP';
      ctx.font = `bold ${0.11 * INCH_TO_PX}px "${bodyFont}", system-ui, sans-serif`;
      const costW3 = ctx.measureText(ultCost).width;
      ctx.fillStyle = '#f43f5e';
      ctx.fillRect(w - textMargin - costW3 - 22, ultY + 12, costW3 + 12, 0.20 * INCH_TO_PX);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(ultCost, w - textMargin - costW3 - 16, ultY + 14);

      // Draw Description
      ctx.fillStyle = '#fdf4f5';
      ctx.font = `${0.11 * INCH_TO_PX}px "${bodyFont}", system-ui, sans-serif`;
      const lines3 = wrapCanvasText(ctx, card.ultimateDesc || 'Unleashes massive fire wave. Deals high impact damage.', boxW - 32);
      let textY3 = ultY + 50;
      for (const line of lines3) {
        ctx.fillText(line, textMargin + 16, textY3);
        textY3 += 0.16 * INCH_TO_PX;
      }
      ctx.restore();

    } else {
      // STANDARD SIZE CARD LAYOUT
      if (card.headline) {
        ctx.fillText(card.headline.toUpperCase(), textMargin, subY);
      }

      // Draw Illustration Art Frame Background/Art
      const artHeight = h * 0.45;
      const artMargin = 0.15 * INCH_TO_PX;

      if (card.cardArt) {
        const artImg = await loadImage(card.cardArt);
        if (artImg) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(artMargin, artMargin, w - (artMargin * 2), artHeight);
          ctx.clip();
          
          const imgRatio = artImg.width / artImg.height;
          const targetRatio = (w - (artMargin * 2)) / artHeight;
          let dw, dh, dx, dy;
          
          if (imgRatio > targetRatio) {
            dh = artHeight;
            dw = artHeight * imgRatio;
            dx = artMargin - (dw - (w - (artMargin * 2))) / 2;
            dy = artMargin;
          } else {
            dw = w - (artMargin * 2);
            dh = dw / imgRatio;
            dx = artMargin;
            dy = artMargin - (dh - artHeight) / 2;
          }
          
          ctx.drawImage(artImg, dx, dy, dw, dh);
          ctx.restore();
          
          ctx.strokeStyle = (card.themeColor || '#6366f1') + '66';
          ctx.lineWidth = 2;
          ctx.strokeRect(artMargin, artMargin, w - (artMargin * 2), artHeight);
        }
      }

      // DRAW ILLUSTRATION OVERLAY ICON IF SPECIFIED
      if (card.artIconType && card.artIconType !== 'none') {
        const rX = w / 2;
        const rY = artMargin + (artHeight / 2);
        const rSize = 0.22 * INCH_TO_PX; // circular radius ~66px

        ctx.save();
        // 1. Draw circular container glass backing
        ctx.beginPath();
        ctx.arc(rX, rY, rSize, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(15, 18, 37, 0.85)';
        ctx.fill();
        ctx.strokeStyle = card.themeColor || '#6366f1';
        ctx.lineWidth = 3;
        ctx.stroke();

        // 2. Draw overlay icon
        const iconSize = 0.22 * INCH_TO_PX;
        const iconX = rX - (iconSize / 2);
        const iconY = rY - (iconSize / 2);

        if (card.artIconType === 'upload' && card.artIconUpload) {
          const artIconImg = await loadImage(card.artIconUpload);
          if (artIconImg) {
            ctx.drawImage(artIconImg, iconX, iconY, iconSize, iconSize);
          }
        } else if (card.artIconType === 'vector' && card.artIconSvgPath) {
          ctx.translate(iconX, iconY);
          ctx.scale(iconSize / 24, iconSize / 24);
          
          ctx.strokeStyle = card.themeColor || '#6366f1';
          ctx.lineWidth = 2.5;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          
          const path = new Path2D(card.artIconSvgPath);
          ctx.stroke(path);
        }
        ctx.restore();
      }

      // Draw Main Header Icon (top-right next to title)
      const iconSize = 0.45 * INCH_TO_PX;
      const iconX = w - textMargin - iconSize;
      const iconY = titleY;

      if (card.iconType === 'upload' && card.iconUpload) {
        const iconImg = await loadImage(card.iconUpload);
        if (iconImg) {
          ctx.drawImage(iconImg, iconX, iconY, iconSize, iconSize);
        }
      } else if (card.iconSvgPath) {
        ctx.save();
        ctx.translate(iconX, iconY);
        ctx.scale(iconSize / 24, iconSize / 24);
        
        ctx.strokeStyle = card.themeColor || '#6366f1';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        const path = new Path2D(card.iconSvgPath);
        ctx.stroke(path);
        ctx.restore();
      }

      // 3. Draw Card Description (Word Wrap + Font Auto-scaling)
      const descY = subY + subFontSize + (0.12 * INCH_TO_PX);
      const descWidth = w - (textMargin * 2);
      
      let descText = card.description || '';
      let descFontSize = 0.11 * INCH_TO_PX;
      
      if (descText.length > 100) descFontSize *= 0.9;
      if (descText.length > 180) descFontSize *= 0.8;
      if (descText.length > 250) descFontSize *= 0.7;

      ctx.font = `${descFontSize}px "${bodyFont}", system-ui, sans-serif`;
      ctx.fillStyle = (card.textColor || '#ffffff') + 'dd';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      const wrapLines = wrapCanvasText(ctx, descText, descWidth);
      let currentLineY = descY;
      const lineHeight = descFontSize * 1.35;
      const footerY = h - (0.4 * INCH_TO_PX);

      for (let i = 0; i < wrapLines.length; i++) {
        if (currentLineY + lineHeight > footerY) {
          ctx.fillText(wrapLines[i] + '...', textMargin, currentLineY);
          break;
        }
        ctx.fillText(wrapLines[i], textMargin, currentLineY);
        currentLineY += lineHeight;
      }

      // 4. Draw Callouts (Bottom Left & Bottom Right)
      ctx.font = `bold ${0.11 * INCH_TO_PX}px "${bodyFont}", system-ui, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      
      // Bottom-Left
      if (card.bottomLeft) {
        const tagText = card.bottomLeft.toString();
        const textW = ctx.measureText(tagText).width;
        const tagH = 0.22 * INCH_TO_PX;
        
        ctx.fillStyle = (card.themeColor || '#6366f1') + '22';
        ctx.fillRect(textMargin, h - textMargin - tagH, textW + 16, tagH);
        ctx.strokeStyle = card.themeColor || '#6366f1';
        ctx.lineWidth = 1;
        ctx.strokeRect(textMargin, h - textMargin - tagH, textW + 16, tagH);
        
        ctx.fillStyle = card.textColor || '#ffffff';
        ctx.fillText(tagText, textMargin + 8, h - textMargin - 4);
      }

      // Bottom-Right
      if (card.bottomRight) {
        const tagText = card.bottomRight.toString();
        const textW = ctx.measureText(tagText).width;
        const tagH = 0.22 * INCH_TO_PX;
        const tagX = w - textMargin - textW - 16;
        
        ctx.fillStyle = (card.themeColor || '#6366f1') + '22';
        ctx.fillRect(tagX, h - textMargin - tagH, textW + 16, tagH);
        ctx.strokeStyle = card.themeColor || '#6366f1';
        ctx.lineWidth = 1;
        ctx.strokeRect(tagX, h - textMargin - tagH, textW + 16, tagH);
        
        ctx.fillStyle = card.textColor || '#ffffff';
        ctx.textAlign = 'right';
        ctx.fillText(tagText, w - textMargin - 8, h - textMargin - 4);
      }
    }

  } else {
    // RENDER CARD BACK
    if (card.cardBackImage) {
      const backImg = await loadImage(card.cardBackImage);
      if (backImg) {
        ctx.drawImage(backImg, 0, 0, w, h);
        
        // Border over image
        ctx.strokeStyle = card.themeColor || '#6366f1';
        ctx.lineWidth = 0.08 * INCH_TO_PX;
        ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
        return;
      }
    }

    // Default premium geometric card back pattern
    ctx.fillStyle = card.bgColor || '#1e1e24';
    ctx.fillRect(0, 0, w, h);

    // Thick border
    const borderThickness = 0.08 * INCH_TO_PX;
    ctx.strokeStyle = card.themeColor || '#6366f1';
    ctx.lineWidth = borderThickness;
    ctx.strokeRect(borderThickness / 2, borderThickness / 2, w - borderThickness, h - borderThickness);

    // Inner geometric mesh pattern
    ctx.save();
    ctx.strokeStyle = (card.themeColor || '#6366f1') + '44'; // Translucent theme color
    ctx.lineWidth = 2;
    
    const sizeOffset = borderThickness + (0.1 * INCH_TO_PX);
    ctx.beginPath();
    ctx.rect(sizeOffset, sizeOffset, w - (sizeOffset * 2), h - (sizeOffset * 2));
    ctx.clip();
    
    // Draw diamond grid pattern
    const gridSize = 0.25 * INCH_TO_PX;
    for (let xPos = -w; xPos < w * 2; xPos += gridSize) {
      ctx.beginPath();
      ctx.moveTo(xPos, 0);
      ctx.lineTo(xPos + h, h);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(xPos, 0);
      ctx.lineTo(xPos - h, h);
      ctx.stroke();
    }

    // Draw central medallion
    const cx = w / 2;
    const cy = h / 2;
    const radius = 0.4 * INCH_TO_PX;
    
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = card.bgColor || '#1e1e24';
    ctx.fill();
    ctx.strokeStyle = card.themeColor || '#6366f1';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw an inner glowing diamond
    ctx.beginPath();
    ctx.moveTo(cx, cy - radius + 10);
    ctx.lineTo(cx + radius - 10, cy);
    ctx.lineTo(cx, cy + radius - 10);
    ctx.lineTo(cx - radius + 10, cy);
    ctx.closePath();
    ctx.fillStyle = card.themeColor || '#6366f1';
    ctx.fill();

    ctx.restore();
  }
}

/**
 * Compiles a list of sheets and exports them as a PDF.
 * Duplex prints: Page 1 (Sheet 1 Front), Page 2 (Sheet 1 Mirrored Back), etc.
 * 
 * @param {Array} sheets - Array of sheets with positioned cards
 * @param {Function} onProgress - Optional callback for loading percentage (0 to 100)
 */
export async function exportSheetsToPDF(sheets, onProgress = () => {}) {
  if (!sheets || sheets.length === 0) return;

  const { jsPDF } = window.jspdf;
  // Initialize standard portrait Letter PDF (8.5 x 11 inches)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'in',
    format: 'letter'
  });

  const tempCanvas = document.createElement('canvas');
  const totalSteps = sheets.length * 2; // Front + Back for each sheet
  let completedSteps = 0;

  for (let s = 0; s < sheets.length; s++) {
    const sheet = sheets[s];

    // If not the first sheet, add a new page before drawing
    if (s > 0) {
      doc.addPage();
    }

    // --- PAGE A: FRONT SHEET ---
    for (const item of sheet.cards) {
      // Explicitly load fonts before rendering
      await ensureFontLoaded(item.card.titleFont || 'Outfit');
      await ensureFontLoaded(item.card.bodyFont || 'Inter');
      
      await renderCardToCanvas(item.card, tempCanvas, 'front');
      const imgData = tempCanvas.toDataURL('image/png');
      doc.addImage(imgData, 'PNG', item.x, item.y, item.w, item.h);
    }
    completedSteps++;
    onProgress(Math.round((completedSteps / totalSteps) * 100));

    // --- PAGE B: MIRRORED BACK SHEET ---
    doc.addPage();
    for (const item of sheet.cards) {
      // Calculate horizontally mirrored position:
      // X coordinate is mirrored along the printable sheet width.
      const mirroredX = SHEET_WIDTH - item.x - item.w;
      
      await renderCardToCanvas(item.card, tempCanvas, 'back');
      const imgData = tempCanvas.toDataURL('image/png');
      doc.addImage(imgData, 'PNG', mirroredX, item.y, item.w, item.h);
    }
    completedSteps++;
    onProgress(Math.round((completedSteps / totalSteps) * 100));
  }

  doc.save(`cardforge-deck-${Date.now()}.pdf`);
}
