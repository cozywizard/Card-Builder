/**
 * High-Resolution PDF Exporter for CardForge
 * Translates sheet structures into a premium, duplex-aligned PDF.
 * Uses jsPDF for rendering and a 300 DPI HTML Canvas for high fidelity.
 */

import { CARD_SIZES, SHEET_WIDTH, SHEET_HEIGHT, getSizeForType, getCardSize, DPI, BLEED } from './binPacker.js';
import { loadGoogleFont } from '../components/CardCreator.js';

// DPI resolution for printing (shared with binPacker.js so custom pixel
// sizes and rendered output stay in exact sync)
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
 * Rasterizes raw icon-library SVG markup (as fetched by IconPicker) into a
 * loadable image, recoloring any `currentColor` references to a fixed hex
 * value first. The live preview colors these icons by setting the CSS
 * `color` property on a wrapping element and letting `fill="currentColor"`
 * inherit it -- a standalone data-URI SVG loaded into an <img> has no such
 * page context to inherit from, so the color has to be baked in directly.
 */
function loadColoredSvg(svgText, color) {
  if (!svgText) return Promise.resolve(null);
  const recolored = svgText.replace(/currentColor/g, color);
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(recolored)}`;
  return loadImage(dataUrl);
}

/**
 * Computes draw dimensions/offset (relative to the frame's own top-left) to
 * fit an image inside a frame while preserving aspect ratio and letterboxing
 * -- the canvas equivalent of CSS `object-fit: contain`.
 */
function fitContain(imgW, imgH, frameW, frameH) {
  const imgRatio = imgW / imgH;
  const frameRatio = frameW / frameH;
  if (imgRatio > frameRatio) {
    const dw = frameW;
    const dh = frameW / imgRatio;
    return { dw, dh, dx: 0, dy: (frameH - dh) / 2 };
  }
  const dh = frameH;
  const dw = frameH * imgRatio;
  return { dw, dh, dx: (frameW - dw) / 2, dy: 0 };
}

// Canvas fillText only honors a weight/style once that exact face has been
// loaded via the Font Loading API -- unlike DOM/CSS text, it will NOT fall
// back gracefully to a loaded weight of the same family, it silently
// substitutes the system default font instead. The card layout below draws
// text at 400 (body), 500 (subheadline) and bold/700 (titles, badges,
// footer tags), so every one of those has to be explicitly loaded or the
// exported PNG's fonts drift from what the live preview shows.
const CANVAS_FONT_WEIGHTS = [400, 500, 700];

async function ensureFontLoaded(fontName) {
  loadGoogleFont(fontName);
  if (!fontName) return;
  try {
    await Promise.all(
      CANVAS_FONT_WEIGHTS.map((weight) => document.fonts.load(`${weight} 1em "${fontName}"`))
    );
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
 * Draws a card onto a high-DPI canvas.
 *
 * @param {Object} card
 * @param {HTMLCanvasElement} canvas
 * @param {'front'|'back'} side
 * @param {Object} [opts]
 * @param {boolean} [opts.bleed=false] - When true, the canvas is sized to
 *   include The Game Crafter's standard 0.125" bleed border beyond the
 *   card's trim edge (matching their card proofing template), and the
 *   background/art is extended to fill it. All existing layout math below
 *   is untouched — it still operates in trim-box coordinates ((0,0) to
 *   (w,h)) via a context translate, so nothing needs to be re-derived.
 *   Custom pixel sizes never get bleed added — they're assumed to already
 *   be the print service's exact template size.
 */
export async function renderCardToCanvas(card, canvas, side = 'front', { bleed = false } = {}) {
  const size = getCardSize(card);
  // Prefer the card's exact custom pixel dimensions when set, so rounding
  // from inches back to pixels can never drift off the requested size.
  const w = size.isCustom ? size.widthPx : size.width * INCH_TO_PX;
  const h = size.isCustom ? size.heightPx : size.height * INCH_TO_PX;
  const bleedPx = (bleed && !size.isCustom) ? BLEED * INCH_TO_PX : 0;

  canvas.width = Math.round(w + bleedPx * 2);
  canvas.height = Math.round(h + bleedPx * 2);
  const ctx = canvas.getContext('2d');

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Shift the origin so (0,0)..(w,h) always maps to the trim box, exactly
  // as if bleed didn't exist — every position below is unaffected.
  ctx.save();
  ctx.translate(bleedPx, bleedPx);

  await Promise.all([
    ensureFontLoaded(card.titleFont || 'Outfit'),
    ensureFontLoaded(card.bodyFont || 'Inter')
  ]);

  if (side === 'front') {
    // 1. Draw Card Background (extends into the bleed border so a die-cut
    // wobble never exposes a white sliver at the trim edge)
    ctx.fillStyle = card.bgColor || '#1e1e24';
    ctx.fillRect(-bleedPx, -bleedPx, w + bleedPx * 2, h + bleedPx * 2);

    // Draw Card Inner Trim -- matches the live preview's `.card-inner-trim`:
    // a thin, inset, rounded, semi-transparent border. (Previously this was
    // a thick ~24px border flush with the card edge, which looked nothing
    // like the hairline trim shown on screen.) The preview always displays
    // the card at a fixed 320px width, so its pixel values (8px inset, 2px
    // stroke, 10px radius) are scaled here proportionally to the export's
    // actual physical width.
    const trimInset = w * (8 / 320);
    const trimRadius = w * (10 / 320);
    const trimLineWidth = w * (2 / 320);
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = card.themeColor || '#6366f1';
    ctx.lineWidth = trimLineWidth;
    drawRoundedRect(
      ctx,
      trimInset + trimLineWidth / 2,
      trimInset + trimLineWidth / 2,
      w - trimInset * 2 - trimLineWidth,
      h - trimInset * 2 - trimLineWidth,
      trimRadius
    );
    ctx.stroke();
    ctx.restore();

    // 2. Card Header (Common for both layouts). Always anchored to the top
    // of the card -- the live preview's header region is always first in
    // its flex column, whether or not the card has art underneath it.
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
    const titleY = textMargin;
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

      // Bottom of the header block (title + optional headline). Everything
      // below -- the art box, then description, then footer -- stacks
      // directly beneath it, matching the live preview's flex-column order
      // of header -> art -> description -> footer.
      const headerBottomY = subY + subFontSize + (0.1 * INCH_TO_PX);

      // Draw Illustration Art Frame. This 45%-of-card-height zone is always
      // reserved right below the header -- matching `.card-art-box`, which
      // the live preview renders (with a white backing) whether or not art
      // has been uploaded -- so description/footer positioning lines up
      // with the preview either way.
      const artHeight = h * 0.45;
      const artMargin = 0.15 * INCH_TO_PX;
      const artY = headerBottomY;
      const artRadius = 0.06 * INCH_TO_PX;
      const frameW = w - (artMargin * 2);

      ctx.save();
      ctx.fillStyle = '#ffffff';
      drawRoundedRect(ctx, artMargin, artY, frameW, artHeight, artRadius);
      ctx.fill();
      ctx.clip();

      if (card.cardArt) {
        const artImg = await loadImage(card.cardArt);
        if (artImg) {
          const { dw, dh, dx, dy } = fitContain(artImg.width, artImg.height, frameW, artHeight);
          ctx.drawImage(artImg, artMargin + dx, artY + dy, dw, dh);
        }
      } else if (card.cardArtType === 'icon' && card.cardArtSvg) {
        // Icon-library illustration mode (`.card-art-full-icon` in the live
        // preview) -- previously silently ignored here, leaving the
        // exported card's art frame blank.
        const artIconImg = await loadColoredSvg(card.cardArtSvg, card.artIconColor || '#6366f1');
        if (artIconImg) {
          const { dw, dh, dx, dy } = fitContain(artIconImg.width, artIconImg.height, frameW, artHeight);
          ctx.drawImage(artIconImg, artMargin + dx, artY + dy, dw, dh);
        }
      }
      ctx.restore();

      // DRAW ILLUSTRATION OVERLAY ICON IF SPECIFIED
      if (card.artIconType && card.artIconType !== 'none') {
        const rX = w / 2;
        const rY = artY + (artHeight / 2);
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

      // Draw Main Header Icon (top-right next to title). Gated on iconType
      // !== 'none' -- matching the live preview, which never even renders
      // `.card-icon-container` in that case. `iconSvgPath` stays populated
      // in the card data after switching to "none" (it's just not meant to
      // be drawn), so it can't be used alone to decide whether to draw.
      if (card.iconType !== 'none') {
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

          // Matches `.card-icon-container`'s `color: var(--card-icon-color)`
          // in the live preview, which falls back to the theme color.
          ctx.strokeStyle = card.iconColor || card.themeColor || '#6366f1';
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          const path = new Path2D(card.iconSvgPath);
          ctx.stroke(path);
          ctx.restore();
        }
      }

      // 3. Draw Card Description (Word Wrap + Font Auto-scaling). Starts
      // below the art box (not right after the headline) -- matching the
      // live preview, where the description is a separate flex item that
      // comes after the art box, not stacked on top of it.
      const descY = artY + artHeight + (0.12 * INCH_TO_PX);
      const descWidth = w - (textMargin * 2);
      
      let descText = card.description || '';
      let descFontSize = 0.11 * INCH_TO_PX;
      
      if (descText.length > 100) descFontSize *= 0.9;
      if (descText.length > 180) descFontSize *= 0.8;
      if (descText.length > 250) descFontSize *= 0.7;

      ctx.font = `${descFontSize}px "${bodyFont}", system-ui, sans-serif`;
      // Matches `.card-description-box`'s `color: var(--card-text)` in the
      // live preview exactly -- full opacity, no alpha reduction. (The
      // previous `+ 'dd'` suffix not only dimmed it below the preview's
      // color but could silently no-op the whole assignment for some hex
      // values, since canvas ignores an invalid fillStyle string and keeps
      // whatever color was already active -- leaving the description in
      // the theme color instead of the chosen typography color.)
      ctx.fillStyle = card.textColor || '#ffffff';
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
      
      // Bottom-Left. Matches `.card-callout-tag` (a barely-there white fill
      // + hairline border) plus `.callout-left`'s single 3px theme-colored
      // accent edge -- not a full theme-tinted outline on all four sides.
      // Scaled proportionally to the export's physical width the same way
      // the card's inner trim is (see above), since the live preview always
      // renders this at a fixed 320px width.
      const accentW = w * (3 / 320);
      // CSS reserves accent-border-width + 8px padding before the text
      // starts (`border-left: 3px` + `padding: 2px 8px`). The text used to
      // start right at the edge of the accent bar (only 8px in, with no
      // allowance for the accent's own width), so it visually crowded into
      // /overlapped the colored stripe.
      const tagTextGap = accentW + (w * (8 / 320));
      if (card.bottomLeft) {
        const tagText = card.bottomLeft.toString();
        const textW = ctx.measureText(tagText).width;
        const tagH = 0.22 * INCH_TO_PX;
        const tagY = h - textMargin - tagH;
        const tagW = textW + tagTextGap + (w * (8 / 320));

        ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.fillRect(textMargin, tagY, tagW, tagH);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        ctx.strokeRect(textMargin, tagY, tagW, tagH);
        ctx.fillStyle = card.themeColor || '#6366f1';
        ctx.fillRect(textMargin, tagY, accentW, tagH);

        ctx.fillStyle = card.textColor || '#ffffff';
        ctx.fillText(tagText, textMargin + tagTextGap, h - textMargin - 4);
      }

      // Bottom-Right
      if (card.bottomRight) {
        const tagText = card.bottomRight.toString();
        const textW = ctx.measureText(tagText).width;
        const tagH = 0.22 * INCH_TO_PX;
        const tagW = textW + tagTextGap + (w * (8 / 320));
        const tagX = w - textMargin - tagW;
        const tagY = h - textMargin - tagH;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.fillRect(tagX, tagY, tagW, tagH);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        ctx.strokeRect(tagX, tagY, tagW, tagH);
        ctx.fillStyle = card.themeColor || '#6366f1';
        ctx.fillRect(tagX + tagW - accentW, tagY, accentW, tagH);

        ctx.fillStyle = card.textColor || '#ffffff';
        ctx.textAlign = 'right';
        ctx.fillText(tagText, w - textMargin - tagTextGap, h - textMargin - 4);
      }
    }

  } else {
    // RENDER CARD BACK
    if (card.cardBackImage) {
      const backImg = await loadImage(card.cardBackImage);
      if (backImg) {
        // Extend into the bleed border so the back matches the front's
        // bleed treatment (no white sliver at the trim edge)
        ctx.drawImage(backImg, -bleedPx, -bleedPx, w + bleedPx * 2, h + bleedPx * 2);

        // Border over image
        ctx.strokeStyle = card.themeColor || '#6366f1';
        ctx.lineWidth = 0.08 * INCH_TO_PX;
        ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
        ctx.restore();
        return;
      }
    }

    // Default premium geometric card back pattern (extends into bleed)
    ctx.fillStyle = card.bgColor || '#1e1e24';
    ctx.fillRect(-bleedPx, -bleedPx, w + bleedPx * 2, h + bleedPx * 2);

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

    ctx.restore(); // matches the inner save() above (mesh clip)
  }

  ctx.restore(); // matches the outer save()/translate() at the top of this function
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

/**
 * Renders a single card face to a standalone PNG and triggers a browser
 * download. For preset card types, the output automatically includes The
 * Game Crafter's standard 0.125" bleed border beyond the trim edge (their
 * card proofing template spec), so the file's pixel dimensions match what
 * their upload system expects exactly — no unwanted stretching that would
 * push your design past their safe zone. Custom pixel sizes are exported
 * as-is, since they're assumed to already be the print service's exact
 * template size (bleed included).
 *
 * @param {Object} card - The card template to render
 * @param {'front'|'back'} side - Which face to export
 */
export async function exportCardToPNG(card, side = 'front') {
  const canvas = document.createElement('canvas');
  await renderCardToCanvas(card, canvas, side, { bleed: true });

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return;

  const safeTitle = (card.title || 'card')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'card';

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeTitle}-${side}-${canvas.width}x${canvas.height}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
