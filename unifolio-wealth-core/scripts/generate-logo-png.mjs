import sharp from 'sharp';
import { writeFileSync } from 'fs';

// 12 dots arranged in a ring — mirrors the React component geometry
// viewBox 0 0 28 28, center (14,14), radius 11, dot r=2.5
const N = 12;
const CX = 14, CY = 14, R = 11;

// Royal purple theme chartColors palette
const COLORS = [
  '#a78bfa', '#818cf8', '#c4b5fd', '#7c3aed',
  '#6d28d9', '#8b5cf6', '#ddd6fe', '#7c3aed',
  '#a78bfa', '#c084fc', '#e879f9', '#f0abfc',
];

// Generate dot positions
const dots = Array.from({ length: N }, (_, i) => {
  const angle = (i / N) * Math.PI * 2;
  return {
    cx: CX + R * Math.cos(angle),
    cy: CY + R * Math.sin(angle),
    color: COLORS[i],
  };
});

// Background: deep purple-black matching royalpurple theme
const BG = '#0d0a1a';
const GLOW = '#7c3aed';

const SIZE = 512;
const SCALE = SIZE / 28;
const DOT_R = 2.5 * SCALE;
const GLOW_R = DOT_R * 2.2;

const dotsSvg = dots.map(d =>
  `<circle cx="${(d.cx * SCALE).toFixed(2)}" cy="${(d.cy * SCALE).toFixed(2)}" r="${DOT_R.toFixed(2)}" fill="${d.color}" opacity="0.95"/>`
).join('\n  ');

// Subtle glow dots underneath
const glowDots = dots.map(d =>
  `<circle cx="${(d.cx * SCALE).toFixed(2)}" cy="${(d.cy * SCALE).toFixed(2)}" r="${GLOW_R.toFixed(2)}" fill="${d.color}" opacity="0.18"/>`
).join('\n  ');

const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <defs>
    <!-- Outer ambient glow -->
    <radialGradient id="bg" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#1a0e3a"/>
      <stop offset="100%" stop-color="${BG}"/>
    </radialGradient>
    <!-- Center wheel glow -->
    <radialGradient id="wheelGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${GLOW}" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="${GLOW}" stop-opacity="0"/>
    </radialGradient>
    <filter id="softBlur">
      <feGaussianBlur stdDeviation="2.5"/>
    </filter>
    <filter id="dotGlow">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="${SIZE}" height="${SIZE}" fill="url(#bg)" rx="80"/>

  <!-- Ambient center glow -->
  <circle cx="${SIZE/2}" cy="${SIZE/2}" r="${SIZE * 0.38}" fill="url(#wheelGlow)"/>

  <!-- Glow halos behind dots -->
  <g filter="url(#softBlur)" opacity="0.7">
    ${glowDots}
  </g>

  <!-- Main dots with glow filter -->
  <g filter="url(#dotGlow)">
    ${dotsSvg}
  </g>

  <!-- Wordmark: "unifolio" -->
  <text
    x="${SIZE / 2}"
    y="${SIZE * 0.82}"
    font-family="'SF Pro Display', 'Inter', 'Helvetica Neue', Arial, sans-serif"
    font-size="${SIZE * 0.085}"
    font-weight="300"
    letter-spacing="${SIZE * 0.012}"
    fill="#e2d9f3"
    text-anchor="middle"
    opacity="0.92"
  >unifolio</text>
</svg>`;

writeFileSync('/tmp/unifolio-logo.svg', svgContent);

// Convert to PNG via sharp
await sharp(Buffer.from(svgContent))
  .png({ quality: 100 })
  .toFile('/Users/tuay/unifolio/unifolio/unifolio-wealth-core/public/logo.png');

// Also produce a square 256px version for Discord server icon
await sharp(Buffer.from(svgContent))
  .resize(256, 256)
  .png({ quality: 100 })
  .toFile('/Users/tuay/unifolio/unifolio/unifolio-wealth-core/public/logo-256.png');

console.log('Generated: public/logo.png (512px) and public/logo-256.png (256px)');
