import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/lib/ThemeContext';

// ── Login page bumper-car floater seed ────────────────────────────────────
const LOGIN_FLOATERS = [
  { x:  8, y: 18, size:  28, speed: 28, phase: 0.0, baseOp: 0.22, breathPeriod:  7200 },
  { x: 18, y: 72, size:  56, speed: 14, phase: 1.1, baseOp: 0.18, breathPeriod: 10400 },
  { x: 28, y: 35, size:  90, speed:  8, phase: 2.3, baseOp: 0.15, breathPeriod: 14000 },
  { x: 38, y: 82, size:  38, speed: 22, phase: 0.6, baseOp: 0.21, breathPeriod:  8600 },
  { x: 50, y: 22, size:  70, speed: 11, phase: 3.0, baseOp: 0.17, breathPeriod: 12200 },
  { x: 62, y: 65, size:  44, speed: 19, phase: 1.7, baseOp: 0.22, breathPeriod:  9000 },
  { x: 72, y: 12, size: 110, speed:  6, phase: 0.4, baseOp: 0.13, breathPeriod: 16000 },
  { x: 80, y: 55, size:  32, speed: 32, phase: 2.1, baseOp: 0.25, breathPeriod:  6800 },
  { x: 90, y: 30, size:  62, speed: 15, phase: 1.4, baseOp: 0.18, breathPeriod: 11600 },
  { x: 14, y: 50, size:  48, speed: 20, phase: 3.4, baseOp: 0.20, breathPeriod:  9800 },
  { x: 45, y: 45, size:  88, speed:  9, phase: 0.9, baseOp: 0.14, breathPeriod: 15000 },
  { x: 85, y: 78, size:  24, speed: 36, phase: 2.6, baseOp: 0.27, breathPeriod:  6000 },
  { x: 55, y: 88, size:  74, speed: 12, phase: 1.2, baseOp: 0.16, breathPeriod: 13400 },
  { x: 25, y: 60, size:  36, speed: 26, phase: 3.8, baseOp: 0.24, breathPeriod:  7600 },
  { x: 70, y: 42, size:  52, speed: 17, phase: 0.2, baseOp: 0.19, breathPeriod: 10800 },
  { x:  4, y: 85, size: 120, speed:  5, phase: 2.8, baseOp: 0.12, breathPeriod: 18000 },
  { x: 92, y: 62, size:  40, speed: 24, phase: 1.5, baseOp: 0.23, breathPeriod:  8000 },
  { x: 34, y: 15, size:  66, speed: 13, phase: 0.8, baseOp: 0.17, breathPeriod: 12800 },
  { x: 58, y: 72, size:  80, speed: 10, phase: 3.2, baseOp: 0.15, breathPeriod: 14600 },
  { x: 78, y: 90, size:  30, speed: 30, phase: 1.9, baseOp: 0.26, breathPeriod:  6400 },
  { x: 10, y: 38, size: 100, speed:  7, phase: 0.5, baseOp: 0.13, breathPeriod: 16800 },
  { x: 48, y: 62, size:  46, speed: 21, phase: 2.4, baseOp: 0.21, breathPeriod:  9400 },
  { x: 22, y: 90, size:  58, speed: 16, phase: 3.6, baseOp: 0.18, breathPeriod: 11200 },
  { x: 65, y: 25, size:  34, speed: 28, phase: 0.7, baseOp: 0.24, breathPeriod:  7400 },
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

// ── Floating wheel logos (Feature 8) ──────────────────────────────────────
const FLOATER_SEED = [
  { x: 12, y: 22, size: 32, speed: 22, phase: 0.0, baseOp: 0.06, breathPeriod: 8200 },
  { x: 88, y: 15, size: 52, speed: 14, phase: 1.2, baseOp: 0.05, breathPeriod: 11000 },
  { x: 35, y: 72, size: 24, speed: 30, phase: 2.4, baseOp: 0.08, breathPeriod: 7100 },
  { x: 76, y: 68, size: 44, speed: 18, phase: 0.7, baseOp: 0.05, breathPeriod: 9400 },
  { x: 55, y: 38, size: 70, speed: 10, phase: 3.1, baseOp: 0.04, breathPeriod: 13000 },
  { x: 18, y: 55, size: 38, speed: 26, phase: 1.8, baseOp: 0.07, breathPeriod: 8800 },
  { x: 92, y: 48, size: 28, speed: 34, phase: 0.3, baseOp: 0.06, breathPeriod: 6200 },
  { x: 42, y: 88, size: 60, speed: 12, phase: 2.0, baseOp: 0.04, breathPeriod: 12400 },
  { x: 68, y: 28, size: 20, speed: 38, phase: 1.5, baseOp: 0.09, breathPeriod: 7800 },
  { x: 25, y: 42, size: 48, speed: 16, phase: 3.5, baseOp: 0.05, breathPeriod: 10200 },
];

const N_W = 12;
const CX_W = 14;
const CY_W = 14;
const R_W = 11;
const WHEEL_DOTS = Array.from({ length: N_W }, (_, i) => {
  const a = (i / N_W) * Math.PI * 2;
  return { x: CX_W + R_W * Math.cos(a), y: CY_W + R_W * Math.sin(a) };
});

function FloatingWheels({ chartColors, cursorRef }) {
  const floaterRefs = useRef([]);
  const groupRefs = useRef([]);
  const physicsRef = useRef(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    physicsRef.current = FLOATER_SEED.map((f, i) => ({
      ...f,
      px: (f.x / 100) * vw,
      py: (f.y / 100) * vh,
      vx: (Math.random() - 0.5) * 70,
      vy: (Math.random() - 0.5) * 70,
      rot: (i * 37) % 360,
    }));

    const cursorVel = { x: 0, y: 0 };
    let lastCx = -999, lastCy = -999;
    let raf = null;
    let lastTime = null;

    const MAX_SPEED = 750;
    const DAMPING_60FPS = 0.975;
    const DRIFT_ACCEL = 28;
    const CURSOR_SPRING = 3800;
    const CURSOR_XFER = 1.6;
    const HIT_MULT = 1.8;

    const tick = (now) => {
      if (!lastTime) lastTime = now;
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const cx = cursorRef.current.x;
      const cy = cursorRef.current.y;

      if (lastCx > -990) {
        cursorVel.x = (cx - lastCx) / dt;
        cursorVel.y = (cy - lastCy) / dt;
      }
      lastCx = cx; lastCy = cy;

      const cvw = window.innerWidth;
      const cvh = window.innerHeight;
      const damp = Math.pow(DAMPING_60FPS, dt * 60);

      physicsRef.current.forEach((f, i) => {
        const el = floaterRefs.current[i];
        const g = groupRefs.current[i];
        if (!el || !g) return;

        // Autonomous drift (sinusoidal acceleration — snowglobe feel)
        f.vx += Math.sin(now / 8000 + f.phase) * DRIFT_ACCEL * dt;
        f.vy += Math.cos(now / 11000 + f.phase * 1.3) * DRIFT_ACCEL * dt;

        // Cursor soft-body collision
        const dx = f.px - cx;
        const dy = f.py - cy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
        const hitR = f.size * HIT_MULT;

        if (dist < hitR && cx > -990) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = (hitR - dist) / hitR;

          // Spring repulsion (proportional to overlap depth)
          f.vx += nx * CURSOR_SPRING * overlap * dt;
          f.vy += ny * CURSOR_SPRING * overlap * dt;

          // Billiard: transfer cursor velocity toward floater
          const approach = -(cursorVel.x * nx + cursorVel.y * ny);
          if (approach > 0) {
            f.vx -= nx * approach * CURSOR_XFER;
            f.vy -= ny * approach * CURSOR_XFER;
          }
        }

        // Air resistance damping
        f.vx *= damp;
        f.vy *= damp;

        // Speed cap
        const speed = Math.sqrt(f.vx * f.vx + f.vy * f.vy);
        if (speed > MAX_SPEED) { f.vx *= MAX_SPEED / speed; f.vy *= MAX_SPEED / speed; }

        // Integrate
        f.px += f.vx * dt;
        f.py += f.vy * dt;

        // Elastic boundary bounce
        const m = f.size * 0.5;
        if (f.px < m)       { f.px = m;       f.vx =  Math.abs(f.vx) * 0.72; }
        if (f.px > cvw - m) { f.px = cvw - m; f.vx = -Math.abs(f.vx) * 0.72; }
        if (f.py < m)       { f.py = m;       f.vy =  Math.abs(f.vy) * 0.72; }
        if (f.py > cvh - m) { f.py = cvh - m; f.vy = -Math.abs(f.vy) * 0.72; }

        // Rotation
        f.rot = (f.rot + f.speed * dt) % 360;

        // Breathing opacity
        const breathe = Math.sin(now / f.breathPeriod + f.phase) * 0.02;
        const opacity = Math.max(0, f.baseOp + breathe).toFixed(4);

        el.style.transform = `translate(${(f.px - f.size / 2).toFixed(1)}px, ${(f.py - f.size / 2).toFixed(1)}px)`;
        el.style.opacity = opacity;
        g.style.transform = `rotate(${f.rot.toFixed(2)}deg)`;
      });

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <>
      {FLOATER_SEED.map((f, i) => (
        <div
          key={i}
          ref={el => { floaterRefs.current[i] = el; }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: f.size,
            height: f.size,
            willChange: 'transform, opacity',
            opacity: 0,
            pointerEvents: 'none',
          }}
          aria-hidden="true"
        >
          <svg viewBox="0 0 28 28" width={f.size} height={f.size}>
            <g
              ref={el => { groupRefs.current[i] = el; }}
              style={{ transformOrigin: `${CX_W}px ${CY_W}px`, transformBox: 'view-box' }}
            >
              {WHEEL_DOTS.map((dot, di) => (
                <circle
                  key={di}
                  cx={dot.x}
                  cy={dot.y}
                  r={2.5}
                  fill={chartColors[(i * 3 + di) % chartColors.length] || 'hsl(var(--primary))'}
                />
              ))}
            </g>
          </svg>
        </div>
      ))}
    </>
  );
}

// ── Login page bumper-cars background ──────────────────────────────────────
function RibbonBackground({ className }) {
  const { chartColors } = useTheme();
  const floaterRefs = useRef([]);
  const groupRefs = useRef([]);
  const physicsRef = useRef(null);
  const cursorRef = useRef({ x: -999, y: -999 });

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    physicsRef.current = LOGIN_FLOATERS.map((f, i) => ({
      ...f,
      px: (f.x / 100) * vw,
      py: (f.y / 100) * vh,
      vx: (Math.random() - 0.5) * 90,
      vy: (Math.random() - 0.5) * 90,
      rot: (i * 29) % 360,
    }));

    const cursorVel = { x: 0, y: 0 };
    let lastCx = -999, lastCy = -999;
    let raf = null;
    let lastTime = null;

    const MAX_SPEED = 900;
    const DAMPING_60FPS = 0.970;
    const DRIFT_ACCEL = 38;
    const CURSOR_SPRING = 4200;
    const CURSOR_XFER = 1.8;
    const HIT_MULT = 1.6;

    const onPointer = (e) => {
      cursorRef.current.x = e.clientX;
      cursorRef.current.y = e.clientY;
    };
    window.addEventListener('pointermove', onPointer, { passive: true });

    // Logo wrap zone — sampled once per second to avoid layout thrash
    const logoZone = { x: window.innerWidth / 2, y: window.innerHeight * 0.22, r: 80, speed: 34 };
    let lastLogoSample = 0;
    const LOGO_SPRING = 4200;    // radial repulsion
    const LOGO_TANGENTIAL = 3600; // sideways deflection (creates wrap-around)

    const tick = (now) => {
      if (!lastTime) lastTime = now;
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const cx = cursorRef.current.x;
      const cy = cursorRef.current.y;

      if (lastCx > -990) {
        cursorVel.x = (cx - lastCx) / dt;
        cursorVel.y = (cy - lastCy) / dt;
      }
      lastCx = cx; lastCy = cy;

      // Resample logo position and spin speed once per second
      if (now - lastLogoSample > 1000) {
        lastLogoSample = now;
        const logoEl = document.querySelector('.unifolio-wheel-logo');
        if (logoEl) {
          const r = logoEl.getBoundingClientRect();
          logoZone.x = r.left + r.width / 2;
          logoZone.y = r.top + r.height / 2;
          logoZone.r = r.width * 0.72;
          logoZone.speed = parseFloat(logoEl.dataset.speed || '34');
        }
      }

      const cvw = window.innerWidth;
      const cvh = window.innerHeight;
      const damp = Math.pow(DAMPING_60FPS, dt * 60);

      physicsRef.current.forEach((f, i) => {
        const el = floaterRefs.current[i];
        const g = groupRefs.current[i];
        if (!el || !g) return;

        f.vx += Math.sin(now / 8000 + f.phase) * DRIFT_ACCEL * dt;
        f.vy += Math.cos(now / 11000 + f.phase * 1.3) * DRIFT_ACCEL * dt;

        const dx = f.px - cx;
        const dy = f.py - cy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
        const hitR = f.size * HIT_MULT;

        if (dist < hitR && cx > -990) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = (hitR - dist) / hitR;
          f.vx += nx * CURSOR_SPRING * overlap * dt;
          f.vy += ny * CURSOR_SPRING * overlap * dt;
          const approach = -(cursorVel.x * nx + cursorVel.y * ny);
          if (approach > 0) {
            f.vx -= nx * approach * CURSOR_XFER;
            f.vy -= ny * approach * CURSOR_XFER;
          }
        }

        // Logo spin-wrap: radial push + tangential deflection (makes floaters curve around)
        const ldx = f.px - logoZone.x;
        const ldy = f.py - logoZone.y;
        const ldist = Math.sqrt(ldx * ldx + ldy * ldy) || 0.001;
        // Influence zone is wider than hard-contact zone so floaters start curving early
        const lhitR = logoZone.r + f.size * 0.5;
        const lInfluenceR = lhitR * 2.2;
        if (ldist < lInfluenceR) {
          const lnx = ldx / ldist;
          const lny = ldy / ldist;
          // Soft influence falloff (1 at contact, 0 at edge of influence zone)
          const softFall = Math.max(0, 1 - ldist / lInfluenceR);
          const hardOverlap = ldist < lhitR ? (lhitR - ldist) / lhitR : 0;

          // Radial repulsion (hard contact only)
          f.vx += lnx * LOGO_SPRING * hardOverlap * dt;
          f.vy += lny * LOGO_SPRING * hardOverlap * dt;

          // Tangential deflection — 90° clockwise from radial, matching logo spin direction
          // Scales with logo speed (idle ~34 deg/s → hover ~390 deg/s → fling ~2400)
          const spinNorm = Math.min(logoZone.speed / 390, 3.0); // cap at fling
          const tx = lny;   // tangential = 90° CW from outward radial
          const ty = -lnx;
          f.vx += tx * LOGO_TANGENTIAL * softFall * spinNorm * dt;
          f.vy += ty * LOGO_TANGENTIAL * softFall * spinNorm * dt;
        }

        f.vx *= damp;
        f.vy *= damp;

        const speed = Math.sqrt(f.vx * f.vx + f.vy * f.vy);
        if (speed > MAX_SPEED) { f.vx *= MAX_SPEED / speed; f.vy *= MAX_SPEED / speed; }

        f.px += f.vx * dt;
        f.py += f.vy * dt;

        const m = f.size * 0.5;
        if (f.px < m)       { f.px = m;       f.vx =  Math.abs(f.vx) * 0.72; }
        if (f.px > cvw - m) { f.px = cvw - m; f.vx = -Math.abs(f.vx) * 0.72; }
        if (f.py < m)       { f.py = m;       f.vy =  Math.abs(f.vy) * 0.72; }
        if (f.py > cvh - m) { f.py = cvh - m; f.vy = -Math.abs(f.vy) * 0.72; }

        f.rot = (f.rot + f.speed * dt) % 360;

        const breathe = Math.sin(now / f.breathPeriod + f.phase) * 0.04;
        const opacity = Math.max(0, f.baseOp + breathe).toFixed(4);

        el.style.transform = `translate(${(f.px - f.size / 2).toFixed(1)}px, ${(f.py - f.size / 2).toFixed(1)}px)`;
        el.style.opacity = opacity;
        g.style.transform = `rotate(${f.rot.toFixed(2)}deg)`;
      });

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onPointer);
    };
  }, []);

  return (
    <div
      className={cn('pointer-events-none fixed inset-0 overflow-hidden', className)}
      style={{ background: 'hsl(var(--background))' }}
      aria-hidden="true"
    >
      {LOGIN_FLOATERS.map((f, i) => (
        <div
          key={i}
          ref={el => { floaterRefs.current[i] = el; }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: f.size,
            height: f.size,
            willChange: 'transform, opacity',
            opacity: 0,
            pointerEvents: 'none',
          }}
        >
          <svg viewBox="0 0 28 28" width={f.size} height={f.size}>
            <g
              ref={el => { groupRefs.current[i] = el; }}
              style={{ transformOrigin: `${CX_W}px ${CY_W}px`, transformBox: 'view-box' }}
            >
              {WHEEL_DOTS.map((dot, di) => (
                <circle
                  key={di}
                  cx={dot.x}
                  cy={dot.y}
                  r={2.5}
                  fill={chartColors[(i * 3 + di) % chartColors.length] || 'hsl(var(--primary))'}
                />
              ))}
            </g>
          </svg>
        </div>
      ))}

      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse 80% 70% at 50% 50%, transparent 20%, hsl(var(--background) / 0.55) 100%)',
        pointerEvents: 'none',
      }} />
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────
export default function ThemedWaveBackground({ className = '', intensity = 'default', variant = 'waves' }) {
  const { selectedTheme, chartColors } = useTheme();
  const isRainbow = selectedTheme === 'rainbow';
  const strong = intensity === 'strong';

  if (variant === 'ribbon') {
    return <RibbonBackground className={className} />;
  }

  // ── Wave / dot-ring mode ────────────────────────────────────────────────
  const ref = useRef(null);
  const [dims, setDims] = useState({
    w: typeof window !== 'undefined' ? window.innerWidth  : 1440,
    h: typeof window !== 'undefined' ? window.innerHeight : 900,
  });
  const animState = useRef({ targetX: 50, targetY: 85, currentX: 50, currentY: 85, frame: 0, frameCount: 0 });
  const cursorPx = useRef({ x: -999, y: -999 });
  const clickPulse = useRef({ x: 0, y: 0, t: -99999 });
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
      cursorPx.current.x = e.clientX;
      cursorPx.current.y = e.clientY;
    };
    window.addEventListener('pointermove', onMove, { passive: true });

    const onDown = (e) => {
      clickPulse.current = { x: e.clientX, y: e.clientY, t: performance.now() };
    };
    document.addEventListener('mousedown', onDown);

    if (reducedMotion) {
      el.style.setProperty('--wave-x', '50%');
      el.style.setProperty('--wave-y', '85%');
      el.style.setProperty('--wave-lift', '0px');
      return () => {
        window.removeEventListener('pointermove', onMove);
        document.removeEventListener('mousedown', onDown);
        ro.disconnect();
      };
    }

    const tick = () => {
      const s = animState.current;
      s.currentX += (s.targetX - s.currentX) * 0.09;
      s.currentY += (s.targetY - s.currentY) * 0.09;

      // Autonomous sinusoidal drift (works even without cursor movement)
      const now = performance.now();
      const driftX = Math.sin(now / 9000) * 6;
      const driftY = Math.cos(now / 11000) * 4;

      // Click pulse: smoothstep decay pulls the wave origin toward the click, then springs back
      const p = clickPulse.current;
      const pAge = now - p.t;
      let pulseOffX = 0, pulseOffY = 0;
      if (pAge < 1100) {
        const t = Math.max(0, 1 - pAge / 1100);
        const pStr = t * t * (3 - 2 * t); // smoothstep — peaks at t=1, eases to 0
        pulseOffX = ((p.x / window.innerWidth)  * 100 - s.currentX) * pStr * 0.28;
        pulseOffY = ((p.y / window.innerHeight) * 100 - s.currentY) * pStr * 0.28;
      }

      el.style.setProperty('--wave-x', `${(s.currentX + driftX + pulseOffX).toFixed(2)}%`);
      el.style.setProperty('--wave-y', `${(s.currentY + driftY + pulseOffY).toFixed(2)}%`);
      el.style.setProperty('--wave-lift', `${Math.max(0, 90 - s.currentY).toFixed(2)}px`);
      s.frameCount++;
      if (s.frameCount % 4 === 0) setRenderKey(k => k + 1);
      s.frame = requestAnimationFrame(tick);
    };
    animState.current.frame = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('mousedown', onDown);
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

      {/* Dot rings */}
      <DotRingSVG key={`a-${renderKey}`} w={w} h={h} originX={originX} originY={originY} isRainbow={isRainbow} offsetX={0}   colorVar="--primary" opacityMult={isRainbow ? 0.28 : 1} />
      <DotRingSVG key={`b-${renderKey}`} w={w} h={h} originX={originX} originY={originY} isRainbow={false}    offsetX={-20}  colorVar="--ring"    opacityMult={isRainbow ? 0.18 : 0.55} />
      <DotRingSVG key={`c-${renderKey}`} w={w} h={h} originX={originX} originY={originY} isRainbow={false}    offsetX={20}   colorVar="--accent"  opacityMult={isRainbow ? 0.18 : 0.55} />

      {!isRainbow && <div className="twb-surface absolute inset-x-0 bottom-0" />}

      {/* B&W cursor bubble */}
      <div className="twb-bw absolute inset-0" />

      {/* Floating wheel logos */}
      <FloatingWheels chartColors={chartColors} cursorRef={cursorPx} />

      <style>{`
        .twb-field {
          ${isRainbow ? `
            background: ${RAINBOW_GRADIENT};
            background-size: 220% 220%;
            animation: twb-rainbow-shift 13s ease-in-out infinite alternate;
          ` : `
            background:
              radial-gradient(circle at var(--wave-x) var(--wave-y), hsl(var(--primary) / ${strong ? '0.30' : '0.18'}) 0%, transparent 36%),
              radial-gradient(circle at calc(var(--wave-x) + 18%) calc(var(--wave-y) + 8%), hsl(var(--ring) / ${strong ? '0.18' : '0.12'}) 0%, transparent 38%),
              radial-gradient(circle at calc(var(--wave-x) - 16%) calc(var(--wave-y) + 10%), hsl(var(--wave-color-2, var(--accent)) / ${strong ? '0.22' : '0.14'}) 0%, transparent 42%),
              linear-gradient(180deg, hsl(var(--background)) 0%, hsl(var(--background)) 55%, hsl(var(--primary) / ${strong ? '0.10' : '0.07'}) 100%);
          `}
        }
        .twb-surface {
          height: ${strong ? '28vh' : '22vh'};
          min-height: ${strong ? '190px' : '150px'};
          transform: translateY(calc(36% - var(--wave-lift) * 0.16));
          background:
            radial-gradient(ellipse at var(--wave-x) -10%, hsl(var(--primary) / ${strong ? '0.42' : '0.28'}) 0%, transparent 34%),
            radial-gradient(ellipse at calc(var(--wave-x) - 22%) 8%, hsl(var(--wave-color-2, var(--accent)) / ${strong ? '0.30' : '0.20'}) 0%, transparent 38%),
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
              radial-gradient(ellipse at calc(var(--wave-x) + 22%) 115%, hsl(var(--wave-color-2, var(--accent)) / 0.22) 0%, transparent 47%);
            filter: grayscale(1) contrast(0.9) brightness(0.85);
            mask-image: radial-gradient(circle 300px at var(--cursor-x) var(--cursor-y), black 0%, rgba(0,0,0,0.7) 35%, rgba(0,0,0,0.25) 65%, transparent 100%);
            -webkit-mask-image: radial-gradient(circle 300px at var(--cursor-x) var(--cursor-y), black 0%, rgba(0,0,0,0.7) 35%, rgba(0,0,0,0.25) 65%, transparent 100%);
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
