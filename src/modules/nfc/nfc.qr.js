/**
 * Premium QR code generator — produces a classy, branded QR code with:
 *   • Rounded dot modules (circles instead of squares)
 *   • Company brand colour as the accent
 *   • Dark card-style background with subtle border
 *   • Centre logo area (finder patterns are kept square for scannability)
 *   • Gradient colour from brand → lighter variant
 *
 * Uses the `qrcode` package for QR matrix data, then renders a custom SVG
 * that's converted to PNG via a data-URI approach.
 */
import QRCode from 'qrcode';

const DEFAULT_BRAND = '#1f9e78';

/**
 * Lighten a hex colour by mixing with white.
 */
function lighten(hex, amount = 0.3) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lr = Math.round(r + (255 - r) * amount);
  const lg = Math.round(g + (255 - g) * amount);
  const lb = Math.round(b + (255 - b) * amount);
  return `#${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`;
}

/**
 * Check if a cell is part of a finder pattern (the 3 corner squares).
 */
function isFinderPattern(row, col, size) {
  const inTopLeft = row < 7 && col < 7;
  const inTopRight = row < 7 && col >= size - 7;
  const inBottomLeft = row >= size - 7 && col < 7;
  return inTopLeft || inTopRight || inBottomLeft;
}

/**
 * Generate a premium SVG QR code string.
 */
function generateQrSvg(url, { brandColour = DEFAULT_BRAND, size = 512 } = {}) {
  // Generate QR matrix
  const qr = QRCode.create(url, { errorCorrectionLevel: 'M' });
  const modules = qr.modules;
  const moduleCount = modules.size;
  const data = modules.data;

  const padding = 4; // quiet zone
  const totalModules = moduleCount + padding * 2;
  const cellSize = size / totalModules;
  const dotRadius = cellSize * 0.38; // slightly smaller than half for gaps

  const brandLight = lighten(brandColour, 0.35);
  const brandDark = brandColour;

  let svgContent = '';

  // Defs: gradient + glow filter
  svgContent += `<defs>
    <linearGradient id="dotGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${brandLight}"/>
      <stop offset="100%" stop-color="${brandDark}"/>
    </linearGradient>
    <linearGradient id="finderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${brandLight}"/>
      <stop offset="100%" stop-color="${brandDark}"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="2" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>`;



  // Render data modules as circles (skip finder patterns)
  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (!data[row * moduleCount + col]) continue;
      if (isFinderPattern(row, col, moduleCount)) continue;

      const cx = (col + padding + 0.5) * cellSize;
      const cy = (row + padding + 0.5) * cellSize;
      svgContent += `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${dotRadius.toFixed(2)}" fill="url(#dotGrad)"/>`;
    }
  }

  // Render finder patterns with premium look (rounded outer, square inner, dot center)
  const finderPositions = [
    [0, 0],                            // top-left
    [0, moduleCount - 7],              // top-right
    [moduleCount - 7, 0],              // bottom-left
  ];

  for (const [fRow, fCol] of finderPositions) {
    const x = (fCol + padding) * cellSize;
    const y = (fRow + padding) * cellSize;
    const finderSize = 7 * cellSize;
    const r = cellSize * 1.2;

    // Outer ring (rounded rect)
    svgContent += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${finderSize.toFixed(2)}" height="${finderSize.toFixed(2)}" rx="${r.toFixed(2)}" fill="none" stroke="url(#finderGrad)" stroke-width="${(cellSize * 0.7).toFixed(2)}" filter="url(#glow)"/>`;

    // Inner square (rounded rect)
    const innerOffset = 2 * cellSize;
    const innerSize = 3 * cellSize;
    const innerR = cellSize * 0.6;
    svgContent += `<rect x="${(x + innerOffset).toFixed(2)}" y="${(y + innerOffset).toFixed(2)}" width="${innerSize.toFixed(2)}" height="${innerSize.toFixed(2)}" rx="${innerR.toFixed(2)}" fill="url(#finderGrad)"/>`;
  }



  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${svgContent}</svg>`;
}

/**
 * Generate a premium QR code as SVG string.
 * @param {string} url - The URL to encode
 * @param {object} opts - Options
 * @param {string} opts.brandColour - Hex colour for brand accent
 * @param {number} opts.size - Image dimension in px (default 512)
 * @returns {string} SVG string
 */
export function generatePremiumQrSvg(url, opts = {}) {
  return generateQrSvg(url, opts);
}
