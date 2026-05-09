import React from 'react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/lib/ThemeContext';

const EMOJI_TO_KEY = {
  '🟢': 'wealthsimple',
  '🔴': 'interactive-brokers',
  '🟡': 'questrade',
  '🔵': 'rbc',
  '🇺🇸': 'schwab',
  '🟣': 'unifolio',
  '📄': 'generic',
};

const LOGOS = {
  wealthsimple: { label: 'WS', tone: 'emerald', ring: 'rounded-2xl', accent: 'after:rounded-full', svgFile: '/logos/wealthsimple.svg', wide: true },
  'interactive-brokers': { label: 'IBKR', tone: 'red', ring: 'rounded-lg', wide: true, svgFile: '/logos/interactive-brokers.svg' },
  ibkr: { label: 'IBKR', tone: 'red', ring: 'rounded-lg', wide: true, svgFile: '/logos/interactive-brokers.svg' },
  questrade: { label: 'Q', tone: 'gold', ring: 'rounded-full', svgFile: '/logos/questrade.svg' },
  td: { label: 'TD', tone: 'emerald', ring: 'rounded-md', svgFile: '/logos/td.svg' },
  rbc: { label: 'RBC', tone: 'blue', ring: 'rounded-xl', wide: true, svgFile: '/logos/rbc.svg' },
  bmo: { label: 'BMO', tone: 'blue', ring: 'rounded-full', wide: true },
  scotia: { label: 'S', tone: 'red', ring: 'rounded-full' },
  cibc: { label: 'CIBC', tone: 'red', ring: 'rounded-lg', wide: true },
  'national-bank': { label: 'NB', tone: 'red', ring: 'rounded-md' },
  nbdb: { label: 'NB', tone: 'red', ring: 'rounded-md' },
  schwab: { label: 'CS', tone: 'blue', ring: 'rounded-lg', svgFile: '/logos/schwab.svg' },
  chase: { label: 'C', tone: 'blue', ring: 'rounded-md', svgFile: '/logos/chase.svg' },
  robinhood: { label: 'RH', tone: 'gold', ring: 'rounded-xl', svgFile: '/logos/robinhood.svg' },
  unifolio: { label: 'U', tone: 'primary', ring: 'rounded-xl' },
  generic: { label: 'CSV', tone: 'primary', ring: 'rounded-lg', wide: true },
};

const SIZE_CLASSES = {
  xs: 'h-5 text-[8px]',
  sm: 'h-8 text-[10px]',
  md: 'h-9 text-[11px]',
  lg: 'h-10 text-xs',
  xl: 'h-12 text-sm',
};

const SIZE_W_CLASSES = {
  xs: 'w-5',
  sm: 'w-8',
  md: 'w-9',
  lg: 'w-10',
  xl: 'w-12',
};

const SVG_SIZE = {
  xs: { h: 14, wWide: 32, wNarrow: 14 },
  sm: { h: 18, wWide: 42, wNarrow: 18 },
  md: { h: 20, wWide: 48, wNarrow: 20 },
  lg: { h: 22, wWide: 52, wNarrow: 22 },
  xl: { h: 26, wWide: 62, wNarrow: 26 },
};

function normalizeKey(...values) {
  const raw = values
    .filter(Boolean)
    .map(value => EMOJI_TO_KEY[value] || String(value))
    .join(' ')
    .toLowerCase();

  if (!raw.trim()) return 'generic';
  if (raw.includes('wealthsimple')) return 'wealthsimple';
  if (raw.includes('interactive') || raw.includes('ibkr')) return 'interactive-brokers';
  if (raw.includes('questrade')) return 'questrade';
  if (raw.includes('td direct') || raw === 'td') return 'td';
  if (raw.includes('rbc')) return 'rbc';
  if (raw.includes('bmo')) return 'bmo';
  if (raw.includes('scotia')) return 'scotia';
  if (raw.includes('cibc')) return 'cibc';
  if (raw.includes('national') || raw.includes('nbdb')) return 'national-bank';
  if (raw.includes('schwab')) return 'schwab';
  if (raw.includes('chase')) return 'chase';
  if (raw.includes('robinhood')) return 'robinhood';
  if (raw.includes('unifolio')) return 'unifolio';
  if (raw.includes('csv') || raw.includes('generic') || raw.includes('file')) return 'generic';
  return raw.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'generic';
}

function toneClass(tone) {
  switch (tone) {
    case 'emerald':
      return 'from-primary/25 via-emerald-400/10 to-secondary text-primary border-primary/30';
    case 'red':
      return 'from-primary/25 via-red-400/10 to-secondary text-primary border-primary/30';
    case 'gold':
      return 'from-primary/25 via-amber-300/10 to-secondary text-primary border-primary/30';
    case 'blue':
      return 'from-primary/25 via-sky-400/10 to-secondary text-primary border-primary/30';
    default:
      return 'from-primary/25 via-primary/10 to-secondary text-primary border-primary/30';
  }
}

function isDarkBackground() {
  if (typeof document === 'undefined') return true;
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--background').trim();
  // HSL format: "H S% L%" — lightness < 40 means dark
  const parts = bg.split(/\s+/);
  const l = parseFloat(parts[2] || '50');
  return l < 40;
}

export default function InstitutionLogo({
  institution,
  logo,
  logoKey,
  broker,
  name,
  id,
  size = 'md',
  className = '',
}) {
  const { selectedTheme } = useTheme();
  const key = normalizeKey(
    logoKey,
    logo,
    broker,
    institution?.logo_key,
    institution?.logoKey,
    institution?.logo,
    institution?.id,
    institution?.name,
    id,
    name,
  );
  const def = LOGOS[key] || {
    label: String(name || institution?.name || broker || key || '?').slice(0, 3).toUpperCase(),
    tone: 'primary',
    ring: 'rounded-lg',
    wide: true,
  };

  const displayName = name || institution?.name || broker || def.label;

  if (def.svgFile) {
    const dark = isDarkBackground();
    const imgFilter = dark
      ? 'brightness(0) invert(1) opacity(0.9)'
      : 'brightness(0) opacity(0.8)';
    const svgDims = SVG_SIZE[size] || SVG_SIZE.md;
    const imgW = def.wide ? svgDims.wWide : svgDims.wNarrow;

    return (
      <span
        title={displayName}
        aria-label={`${displayName} logo`}
        className={cn(
          'relative inline-flex shrink-0 items-center justify-center overflow-hidden border bg-gradient-to-br font-black uppercase tracking-tight shadow-sm shadow-primary/10',
          SIZE_CLASSES[size] || SIZE_CLASSES.md,
          def.wide ? 'px-1.5' : SIZE_W_CLASSES[size] || SIZE_W_CLASSES.md,
          def.ring,
          toneClass(def.tone),
          className,
        )}
      >
        <span className="absolute inset-0 bg-[radial-gradient(circle_at_28%_18%,hsl(var(--foreground)/0.24),transparent_34%),linear-gradient(135deg,hsl(var(--primary)/0.20),transparent_62%)]" />
        <span className="absolute inset-x-1 top-1 h-px bg-foreground/25" />
        <img
          src={def.svgFile}
          alt={displayName}
          width={imgW}
          height={svgDims.h}
          className="relative z-10 object-contain select-none"
          style={{ filter: imgFilter, maxWidth: '100%', maxHeight: '70%' }}
          draggable={false}
        />
      </span>
    );
  }

  return (
    <span
      title={displayName}
      aria-label={`${displayName} logo`}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden border bg-gradient-to-br font-black uppercase tracking-tight shadow-sm shadow-primary/10',
        SIZE_CLASSES[size] || SIZE_CLASSES.md,
        SIZE_W_CLASSES[size] || SIZE_W_CLASSES.md,
        def.ring,
        toneClass(def.tone),
        className,
      )}
    >
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_28%_18%,hsl(var(--foreground)/0.24),transparent_34%),linear-gradient(135deg,hsl(var(--primary)/0.20),transparent_62%)]" />
      <span className="absolute inset-x-1 top-1 h-px bg-foreground/25" />
      <span className={cn('relative z-10 leading-none', def.wide && 'scale-x-90 text-[0.82em]')}>
        {def.label}
      </span>
    </span>
  );
}
