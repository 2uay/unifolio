import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/lib/ThemeContext';

// ── Ribbon config — depth drives per-ribbon parallax intensity ─────────────
const RIBBONS = [
  { id: 'a', left: '50%', top: '44%', w: '240vw', h: '46px', rotZ: -38, alpha: 0.58, zIndex: 3, depth: 0.7 },
  { id: 'b', left: '50%', top: '58%', w: '200vw', h: '26px', rotZ:  42, alpha: 0.44, zIndex: 4, depth: 1.2 },
  { id: 'c', left: '50%', top: '31%', w: '220vw', h: '62px', rotZ: -14, alpha: 0.50, zIndex: 2, depth: 0.3 },
  { id: 'd', left: '56%', top: '66%', w: '130vw', h: '20px', rotZ:  70, alpha: 0.32, zIndex: 5, depth: 1.6 },
  { id: 'e', left: '44%', top: '50%', w: '170vw', h: '34px', rotZ: -58, alpha: 0.38, zIndex: 1, depth: 0.9 },
];

// ── Dot-ring helpers (existing wave mode) ──────────────────────────────────
function buildRingDots(originX, originY, rx, ry, count, phaseOffset) {
  const dots = [];
  for (let k = 0; k < count; k++) {
    const angle = (k / count) * Math.PI * 2 + phaseOffset;
    dots.push({
      x: originX + rx * Math.cos(angle),
      y: originY + ry * Math.sin(angle),
    });
  }
  return dots;
}

function DotRingSVG({ w, h, originX, originY, isRainbow, offsetX = 0, colorVar = '--primary', opacityMult = 1 }) {
  const RINGS = 6;
  const circles = [];

  for (let i = 0; i < RINGS; i++) {
    const rx = (0.18 + i * 0.13) * w;
    const ry = rx * 0.36;
    const count = 8 + i * 6;
    const phase = i * 0.45;
    const baseOpacity = (0.52 - i * 0.055) * opacityMult;
    const color = isRainbow
      ? `hsl(${(i * 60) % 360}, 90%, 58%)`
      : `hsl(var(${colorVar}))`;

    buildRingDots(originX + offsetX, originY, rx, ry, count, phase).forEach((dot, idx) => {
      if (dot.y <= h + 6) {
        circles.push(
          <circle key={`r${i}-d${idx}`} cx={dot.x} cy={dot.y} r={1.8} fill={color} opacity={baseOpacity} />
        );
      }
    });
  }

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={w}
      height={h}
      style={{ filter: 'blur(0.5px)', animation: 'twb-dot-breathe 7s ease-in-out infinite' }}
      aria-hidden="true"
    >
      {circles}
    </svg>
  );
}

// ── Ribbon background (login page) ─────────────────────────────────────────
function RibbonBackground({ className }) {
  const stageRef = useRef(null);
  const ribbonRefs = useRef([]);
  const mouse = useRef({ tx: 0, ty: 0, cx: 0, cy: 0, frame: null });

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const s = mouse.current;

    const onPointer = (e) => {
      const x = e.touches ? e.touches[0].clientX : e.clientX;
      const y = e.touches ? e.touches[0].clientY : e.clientY;
      s.tx = (x / window.innerWidth  - 0.5) * 2;
      s.ty = (y / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('touchmove',   onPointer, { passive: true });

    if (reducedMotion) {
      return () => {
        window.removeEventListener('pointermove', onPointer);
        window.removeEventListener('touchmove',   onPointer);
      };
    }

    const tick = () => {
      s.cx += (s.tx - s.cx) * 0.12;
      s.cy += (s.ty - s.cy) * 0.12;
      if (stageRef.current) {
        stageRef.current.style.transform =
          `perspective(1100px) rotateX(${(-s.cy * 18).toFixed(2)}deg) rotateY(${(s.cx * 24).toFixed(2)}deg)`;
      }
      RIBBONS.forEach((r, i) => {
        const el = ribbonRefs.current[i];
        if (el) {
          const px = (s.cx * r.depth * 55).toFixed(1);
          const py = (s.cy * r.depth * 35).toFixed(1);
          el.style.transform = `translateX(calc(-50% + ${px}px)) translateY(calc(-50% + ${py}px)) rotateZ(${r.rotZ}deg)`;
        }
      });
      s.frame = requestAnimationFrame(tick);
    };
    s.frame = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('touchmove',   onPointer);
      cancelAnimationFrame(s.frame);
    };
  }, []);

  return (
    <div
      className={cn('pointer-events-none fixed inset-0 overflow-hidden', className)}
      style={{ background: 'hsl(var(--background))' }}
      aria-hidden="true"
    >
      {/* Stage — tilts with cursor */}
      <div
        ref={stageRef}
        style={{
          position: 'absolute',
          inset: 0,
          transform: 'perspective(1100px) rotateX(0deg) rotateY(0deg)',
        }}
      >
        {RIBBONS.map((r, i) => (
          <div
            key={r.id}
            ref={el => { ribbonRefs.current[i] = el; }}
            style={{
              position: 'absolute',
              left: r.left,
              top: r.top,
              width: r.w,
              height: r.h,
              zIndex: r.zIndex,
              transform: `translateX(-50%) translateY(-50%) rotateZ(${r.rotZ}deg)`,
              borderRadius: '3px',
              // Bright core, fades to transparent at both ends
              background: [
                `linear-gradient(to right,`,
                `  transparent 0%,`,
                `  hsl(var(--primary) / ${(r.alpha * 0.55).toFixed(2)}) 8%,`,
                `  hsl(var(--primary) / ${r.alpha.toFixed(2)}) 25%,`,
                `  hsl(var(--primary) / ${r.alpha.toFixed(2)}) 75%,`,
                `  hsl(var(--primary) / ${(r.alpha * 0.55).toFixed(2)}) 92%,`,
                `  transparent 100%`,
                `)`,
              ].join(''),
              boxShadow: `0 0 80px hsl(var(--primary) / ${(r.alpha * 0.40).toFixed(2)})`,
            }}
          >
            {/* Main gloss sweep */}
            <div style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '3px',
              background: 'linear-gradient(to bottom, rgba(255,255,255,0.40) 0%, rgba(255,255,255,0.10) 38%, transparent 68%)',
            }} />
            {/* Bright top-edge specular */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: '8%',
              right: '8%',
              height: '28%',
              borderRadius: '3px 3px 0 0',
              background: 'rgba(255,255,255,0.22)',
              filter: 'blur(1.5px)',
            }} />
          </div>
        ))}
      </div>

      {/* Dark radial vignette — grounds the composition in the page bg color */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: [
          'radial-gradient(ellipse 90% 80% at 50% 50%,',
          '  transparent 15%,',
          '  hsl(var(--background) / 0.72) 100%)',
        ].join(''),
        pointerEvents: 'none',
      }} />

      {/* Bottom fade — softens into the card area */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '35%',
        background: 'linear-gradient(to top, hsl(var(--background)) 0%, transparent 100%)',
        pointerEvents: 'none',
      }} />
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────
export default function ThemedWaveBackground({ className = '', intensity = 'default', variant = 'waves' }) {
  const { selectedTheme } = useTheme();
  const isRainbow = selectedTheme === 'rainbow';
  const strong = intensity === 'strong';

  if (variant === 'ribbon') {
    return <RibbonBackground className={className} />;
  }

  // ── Wave / dot-ring mode (existing app background) ──────────────────────
  const ref = useRef(null);
  const [dims, setDims] = useState({
    w: typeof window !== 'undefined' ? window.innerWidth  : 1440,
    h: typeof window !== 'undefined' ? window.innerHeight : 900,
  });
  const animState = useRef({ targetX: 50, targetY: 85, currentX: 50, currentY: 85, frame: 0, frameCount: 0 });
  const [renderKey, setRenderKey] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const ro = new ResizeObserver(entries => {
      const e = entries[0];
      if (e) setDims({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) });
    });
    ro.observe(el);

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const onMove = (e) => {
      const s = animState.current;
      s.targetX = (e.clientX / window.innerWidth) * 100;
      s.targetY = (e.clientY / window.innerHeight) * 100;
      el.style.setProperty('--cursor-x', `${e.clientX}px`);
      el.style.setProperty('--cursor-y', `${e.clientY}px`);
    };
    window.addEventListener('pointermove', onMove, { passive: true });

    if (reducedMotion) {
      el.style.setProperty('--wave-x', '50%');
      el.style.setProperty('--wave-y', '85%');
      el.style.setProperty('--wave-lift', '0px');
      return () => { window.removeEventListener('pointermove', onMove); ro.disconnect(); };
    }

    const tick = () => {
      const s = animState.current;
      s.currentX += (s.targetX - s.currentX) * 0.09;
      s.currentY += (s.targetY - s.currentY) * 0.09;
      el.style.setProperty('--wave-x', `${s.currentX.toFixed(2)}%`);
      el.style.setProperty('--wave-y', `${s.currentY.toFixed(2)}%`);
      el.style.setProperty('--wave-lift', `${Math.max(0, 90 - s.currentY).toFixed(2)}px`);
      s.frameCount++;
      if (s.frameCount % 4 === 0) setRenderKey(k => k + 1);
      s.frame = requestAnimationFrame(tick);
    };
    animState.current.frame = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(animState.current.frame);
      ro.disconnect();
    };
  }, []);

  const { w, h } = dims;
  const s = animState.current;
  const originX = (s.currentX / 100) * w;
  const originY = h * 1.06;

  const RAINBOW_GRADIENT = `linear-gradient(
    135deg,
    hsl(0,   100%, 52%) 0%,
    hsl(28,  100%, 52%) 11%,
    hsl(55,  100%, 50%) 22%,
    hsl(100, 100%, 42%) 33%,
    hsl(160, 100%, 42%) 44%,
    hsl(200, 100%, 52%) 55%,
    hsl(240, 100%, 58%) 66%,
    hsl(275, 100%, 56%) 77%,
    hsl(310, 100%, 52%) 88%,
    hsl(340, 100%, 52%) 100%
  )`;

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={cn(
        'pointer-events-none fixed inset-0 overflow-hidden',
        (strong || isRainbow) ? 'opacity-100' : 'opacity-70',
        className
      )}
      style={{
        '--wave-x': '50%',
        '--wave-y': '85%',
        '--wave-lift': '0px',
        '--cursor-x': '50vw',
        '--cursor-y': '85vh',
      }}
    >
      <div className="twb-field absolute inset-0" />

      {/* Dot rings — dimmed in rainbow mode so gradient stays dominant */}
      <DotRingSVG key={`a-${renderKey}`} w={w} h={h} originX={originX} originY={originY} isRainbow={isRainbow} offsetX={0}   colorVar="--primary" opacityMult={isRainbow ? 0.28 : 1} />
      <DotRingSVG key={`b-${renderKey}`} w={w} h={h} originX={originX} originY={originY} isRainbow={false}    offsetX={-20}  colorVar="--ring"    opacityMult={isRainbow ? 0.18 : 0.55} />
      <DotRingSVG key={`c-${renderKey}`} w={w} h={h} originX={originX} originY={originY} isRainbow={false}    offsetX={20}   colorVar="--accent"  opacityMult={isRainbow ? 0.18 : 0.55} />

      {!isRainbow && <div className="twb-surface absolute inset-x-0 bottom-0" />}

      {/* B&W cursor bubble — full-coverage in rainbow mode */}
      <div className="twb-bw absolute inset-0" />

      <style>{`
        .twb-field {
          ${isRainbow ? `
            background: ${RAINBOW_GRADIENT};
            background-size: 220% 220%;
            animation: twb-rainbow-shift 13s ease-in-out infinite alternate;
          ` : `
            background:
              radial-gradient(circle at var(--wave-x) var(--wave-y), hsl(var(--primary) / ${strong ? '0.30' : '0.18'}) 0%, transparent 26%),
              radial-gradient(circle at calc(var(--wave-x) + 18%) calc(var(--wave-y) + 8%), hsl(var(--ring) / ${strong ? '0.18' : '0.12'}) 0%, transparent 27%),
              radial-gradient(circle at calc(var(--wave-x) - 16%) calc(var(--wave-y) + 10%), hsl(var(--accent) / ${strong ? '0.18' : '0.11'}) 0%, transparent 28%),
              linear-gradient(180deg, hsl(var(--background)) 0%, hsl(var(--background)) 55%, hsl(var(--primary) / ${strong ? '0.10' : '0.07'}) 100%);
          `}
        }
        .twb-surface {
          height: ${strong ? '28vh' : '22vh'};
          min-height: ${strong ? '190px' : '150px'};
          transform: translateY(calc(36% - var(--wave-lift) * 0.16));
          background:
            radial-gradient(ellipse at var(--wave-x) -10%, hsl(var(--primary) / ${strong ? '0.42' : '0.28'}) 0%, transparent 34%),
            radial-gradient(ellipse at calc(var(--wave-x) - 22%) 8%, hsl(var(--accent) / ${strong ? '0.26' : '0.16'}) 0%, transparent 36%),
            radial-gradient(ellipse at calc(var(--wave-x) + 25%) 12%, hsl(var(--ring) / ${strong ? '0.22' : '0.14'}) 0%, transparent 37%),
            linear-gradient(180deg, hsl(var(--primary) / ${strong ? '0.20' : '0.12'}) 0%, hsl(var(--card) / ${strong ? '0.18' : '0.10'}) 56%, transparent 100%);
          border-top: 1px solid hsl(var(--primary) / ${strong ? '0.28' : '0.18'});
          border-radius: 52% 48% 0 0 / 26% 30% 0 0;
          filter: saturate(1.22);
          box-shadow: 0 -24px 80px hsl(var(--primary) / ${strong ? '0.18' : '0.11'});
          animation: twb-drift 12s ease-in-out infinite;
        }
        .twb-bw {
          ${isRainbow ? `
            background: ${RAINBOW_GRADIENT};
            background-size: 220% 220%;
            animation: twb-rainbow-shift 13s ease-in-out infinite alternate;
            filter: grayscale(1) contrast(1.05) brightness(0.88);
            mask-image: radial-gradient(
              circle 280px at var(--cursor-x) var(--cursor-y),
              black 10%,
              rgba(0,0,0,0.88) 32%,
              rgba(0,0,0,0.45) 58%,
              transparent 88%
            );
            -webkit-mask-image: radial-gradient(
              circle 280px at var(--cursor-x) var(--cursor-y),
              black 10%,
              rgba(0,0,0,0.88) 32%,
              rgba(0,0,0,0.45) 58%,
              transparent 88%
            );
          ` : `
            background:
              radial-gradient(ellipse at var(--wave-x) 110%, hsl(var(--primary) / 0.35) 0%, transparent 55%),
              radial-gradient(ellipse at calc(var(--wave-x) - 20%) 115%, hsl(var(--ring) / 0.20) 0%, transparent 45%),
              radial-gradient(ellipse at calc(var(--wave-x) + 22%) 115%, hsl(var(--accent) / 0.18) 0%, transparent 45%);
            filter: grayscale(1) contrast(0.9) brightness(0.85);
            mask-image: radial-gradient(circle 180px at var(--cursor-x) var(--cursor-y), black 30%, transparent 100%);
            -webkit-mask-image: radial-gradient(circle 180px at var(--cursor-x) var(--cursor-y), black 30%, transparent 100%);
          `}
        }
        @keyframes twb-rainbow-shift {
          0%   { background-position: 0% 0%; }
          100% { background-position: 100% 100%; }
        }
        @keyframes twb-drift {
          0%, 100% { border-radius: 52% 48% 0 0 / 26% 30% 0 0; }
          45%       { border-radius: 44% 56% 0 0 / 34% 22% 0 0; }
          70%       { border-radius: 58% 42% 0 0 / 22% 36% 0 0; }
        }
        @keyframes twb-dot-breathe {
          0%, 100% { opacity: 0.78; }
          50%       { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .twb-surface, .twb-field, .twb-bw { animation: none; }
          svg[aria-hidden] { animation: none; }
        }
      `}</style>
    </div>
  );
}
