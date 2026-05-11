import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useTheme } from '@/lib/ThemeContext';
import { themes } from '@/lib/themes';

const N_DOTS = 12;
const CX = 14;
const CY = 14;
const R = 11;
const IDLE_DEG_PER_SECOND = 34;
const HOVER_DEG_PER_SECOND = 390;
const ACCELERATION_EASE = 0.035;
const DECELERATION_EASE = 0.022;
const DOT_RECOLOR_IDLE_MS = 2000;
const DOT_RECOLOR_HOVER_MS = 110;

// Hold-and-fling constants
const FLING_MAX_SPEED = 2400;          // deg/sec at peak spin
const FLING_ACCEL_MS = 3000;           // ms to reach peak
const EJECT_TIMES_MS = [500, 900, 1350, 1850]; // sequential eject schedule
const FLING_SPEED_BASE = 500;          // screen px/sec base ejection speed
const POST_BURST_DELAY_MS = 550;       // pause before regen
const REGEN_STAGGER_MS = 140;          // ms between dot regen

const GOLD_PALETTE = [
  '#FFD700', '#FFBE0B', '#FFD43B', '#FFC200',
  '#FFEC6E', '#FF9900', '#FFF0A0', '#E5AC00',
  '#FFD700', '#FFBE0B', '#FFD43B', '#FFC200',
];

function randomColor() {
  return `hsl(${Math.floor(Math.random() * 360)} 88% 58%)`;
}

export default function UnifolioWheelLogo({ className = '', size = 28, onHoverChange = null, onFlingChange = null }) {
  const { chartColors, selectedTheme } = useTheme();
  const goldWheel = !!themes[selectedTheme]?.goldWheel;
  const svgRef = useRef(null);          // main SVG element (for getBoundingClientRect)
  const rotGroupRef = useRef(null);     // rotating <g>
  const lastRecoloredRef = useRef(-1);
  const [hovered, setHovered] = useState(false);
  const [dotOverrides, setDotOverrides] = useState({});
  const [mounted, setMounted] = useState(false);

  // Direct refs to DOM elements
  const circleRefs = useRef([]);  // circles in rotating group
  const flyRefs = useRef([]);     // circles in full-screen portal

  useEffect(() => { setMounted(true); }, []);

  const homeAngles = useMemo(
    () => Array.from({ length: N_DOTS }, (_, i) => (i / N_DOTS) * Math.PI * 2),
    []
  );

  const baseColors = useMemo(
    () => goldWheel
      ? Array.from({ length: N_DOTS }, (_, i) => GOLD_PALETTE[i % GOLD_PALETTE.length])
      : Array.from({ length: N_DOTS }, (_, i) => chartColors[i % chartColors.length] || '#888'),
    [chartColors, goldWheel]
  );
  const baseColorsRef = useRef(baseColors);
  useEffect(() => { baseColorsRef.current = baseColors; }, [baseColors]);

  const dotOverridesRef = useRef(dotOverrides);
  useEffect(() => { dotOverridesRef.current = dotOverrides; }, [dotOverrides]);

  const onFlingChangeRef = useRef(onFlingChange);
  useEffect(() => { onFlingChangeRef.current = onFlingChange; }, [onFlingChange]);

  const stateRef = useRef({
    angle: 0,
    speed: IDLE_DEG_PER_SECOND,
    targetSpeed: IDLE_DEG_PER_SECOND,
    frame: null,
    lastTime: null,
    reducedMotion: false,
    hovering: false,
  });

  const flingRef = useRef({
    active: false,
    startTime: null,
    ejected: new Set(),
    allGone: false,
    burstTime: null,
    regenStartTime: null,
    regenOrder: [],
    regenIndex: 0,
    flyX: new Float32Array(N_DOTS),
    flyY: new Float32Array(N_DOTS),
    flyVx: new Float32Array(N_DOTS),
    flyVy: new Float32Array(N_DOTS),
    flyActive: new Uint8Array(N_DOTS),
  });

  // Color recoloring — gold mode cycles through gold shades only
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (media.matches) return undefined;
    const recolor = () => {
      setDotOverrides(prev => {
        let index = Math.floor(Math.random() * N_DOTS);
        if (N_DOTS > 1 && index === lastRecoloredRef.current) {
          index = (index + 1 + Math.floor(Math.random() * (N_DOTS - 1))) % N_DOTS;
        }
        lastRecoloredRef.current = index;
        const color = goldWheel
          ? GOLD_PALETTE[Math.floor(Math.random() * GOLD_PALETTE.length)]
          : randomColor();
        return { ...prev, [index]: color };
      });
    };
    const timer = window.setInterval(recolor, hovered ? DOT_RECOLOR_HOVER_MS : DOT_RECOLOR_IDLE_MS);
    return () => window.clearInterval(timer);
  }, [hovered, goldWheel]);

  // Main RAF loop
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const state = stateRef.current;
    const fl = flingRef.current;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    state.reducedMotion = media.matches;

    const onMotionPref = () => { state.reducedMotion = media.matches; };
    media.addEventListener?.('change', onMotionPref);

    function getSvgMetrics() {
      const el = svgRef.current;
      if (!el) return { centerX: CX, centerY: CY, scale: 1, rect: null };
      const rect = el.getBoundingClientRect();
      const scale = rect.width / 28;
      return { centerX: rect.left + CX * scale, centerY: rect.top + CY * scale, scale, rect };
    }

    function ejectDot(dotIdx, speedMult) {
      if (fl.ejected.has(dotIdx)) return;
      fl.ejected.add(dotIdx);

      // Dot world angle accounting for current rotation
      const totalAngle = homeAngles[dotIdx] + state.angle * (Math.PI / 180);
      const wx_local = CX + R * Math.cos(totalAngle);
      const wy_local = CY + R * Math.sin(totalAngle);

      // Convert SVG local coords to screen pixels
      const { centerX, centerY, scale, rect } = getSvgMetrics();
      const screenX = rect ? rect.left + wx_local * scale : wx_local;
      const screenY = rect ? rect.top + wy_local * scale : wy_local;

      // Outward radial velocity in screen px/sec
      const dx = screenX - centerX;
      const dy = screenY - centerY;
      const len = Math.hypot(dx, dy) || 1;
      const spd = FLING_SPEED_BASE * (1 + speedMult);

      fl.flyX[dotIdx] = screenX;
      fl.flyY[dotIdx] = screenY;
      fl.flyVx[dotIdx] = (dx / len) * spd;
      fl.flyVy[dotIdx] = (dy / len) * spd;
      fl.flyActive[dotIdx] = 1;

      // Hide in rotating group
      const rotEl = circleRefs.current[dotIdx];
      if (rotEl) rotEl.style.opacity = '0';

      // Show in full-screen portal
      const flyEl = flyRefs.current[dotIdx];
      if (flyEl) {
        const color = dotOverridesRef.current[dotIdx] || baseColorsRef.current[dotIdx];
        flyEl.setAttribute('fill', color);
        flyEl.setAttribute('cx', screenX.toFixed(1));
        flyEl.setAttribute('cy', screenY.toFixed(1));
        flyEl.setAttribute('r', Math.max(3, (2.5 * scale)).toFixed(1));
        flyEl.style.opacity = '1';
        flyEl.style.transition = 'none';
      }
    }

    function regenDot(dotIdx) {
      fl.flyActive[dotIdx] = 0;
      const flyEl = flyRefs.current[dotIdx];
      if (flyEl) {
        flyEl.style.transition = 'opacity 250ms ease';
        flyEl.style.opacity = '0';
      }
      const rotEl = circleRefs.current[dotIdx];
      if (rotEl) {
        rotEl.setAttribute('fill', baseColorsRef.current[dotIdx]);
        rotEl.style.transition = 'none';
        rotEl.style.opacity = '0';
        // Fade in only — no scale, which would collapse the circle toward SVG origin
        requestAnimationFrame(() => requestAnimationFrame(() => {
          if (rotEl) {
            rotEl.style.transition = 'opacity 400ms ease';
            rotEl.style.opacity = '1';
          }
        }));
      }
    }

    function resetAll() {
      fl.active = false;
      fl.startTime = null;
      fl.ejected.clear();
      fl.allGone = false;
      fl.burstTime = null;
      fl.regenStartTime = null;
      fl.regenIndex = 0;
      fl.regenOrder = [];
      fl.flyActive.fill(0);
      state.targetSpeed = state.hovering ? HOVER_DEG_PER_SECOND : IDLE_DEG_PER_SECOND;
      onFlingChangeRef.current?.(false);
      // Clear random color overrides so dots render in theme colors
      setDotOverrides({});
      circleRefs.current.forEach(el => {
        if (el) {
          el.style.transition = 'fill 220ms ease';
          el.style.opacity = '1';
        }
      });
      flyRefs.current.forEach(el => {
        if (el) { el.style.opacity = '0'; el.style.transition = 'none'; }
      });
    }

    const tick = (time) => {
      if (state.lastTime == null) state.lastTime = time;
      const dt = Math.min(0.05, Math.max(0, (time - state.lastTime) / 1000));
      state.lastTime = time;

      if (!state.reducedMotion) {
        let targetSpeed = state.targetSpeed;

        // Fling charging phase
        if (fl.active && fl.startTime != null && !fl.allGone) {
          const elapsed = time - fl.startTime;
          const t = Math.min(elapsed / FLING_ACCEL_MS, 1);
          const ease = 1 - Math.pow(1 - t, 2);
          targetSpeed = IDLE_DEG_PER_SECOND + (FLING_MAX_SPEED - IDLE_DEG_PER_SECOND) * ease;

          EJECT_TIMES_MS.forEach((schedMs, schedIdx) => {
            if (elapsed >= schedMs && fl.ejected.size === schedIdx) {
              const available = Array.from({ length: N_DOTS }, (_, i) => i).filter(i => !fl.ejected.has(i));
              if (available.length > 0) {
                const pick = available[Math.floor(Math.random() * available.length)];
                ejectDot(pick, t * 0.9);
              }
            }
          });

          if (fl.ejected.size >= EJECT_TIMES_MS.length && !fl.allGone) {
            const remaining = Array.from({ length: N_DOTS }, (_, i) => i).filter(i => !fl.ejected.has(i));
            remaining.forEach(i => ejectDot(i, t * 1.6 + 0.4));
            fl.allGone = true;
            fl.burstTime = time;
            onFlingChangeRef.current?.(true);
          }
        }

        // Post-burst regen phase
        if (fl.allGone) {
          targetSpeed += (IDLE_DEG_PER_SECOND - targetSpeed) * 0.05;
          state.targetSpeed = targetSpeed;

          if (!fl.regenStartTime && fl.burstTime && time - fl.burstTime >= POST_BURST_DELAY_MS) {
            fl.regenStartTime = time;
            fl.regenOrder = Array.from({ length: N_DOTS }, (_, i) => i).sort(() => Math.random() - 0.5);
            fl.regenIndex = 0;
          }

          if (fl.regenStartTime && fl.regenIndex < N_DOTS) {
            const regenElapsed = time - fl.regenStartTime;
            const toRegen = Math.min(Math.floor(regenElapsed / REGEN_STAGGER_MS) + 1, N_DOTS);
            while (fl.regenIndex < toRegen) {
              regenDot(fl.regenOrder[fl.regenIndex]);
              fl.regenIndex++;
            }
            if (fl.regenIndex >= N_DOTS) {
              setTimeout(resetAll, REGEN_STAGGER_MS * 3);
            }
          }
        }

        const ease = targetSpeed > state.speed ? ACCELERATION_EASE : DECELERATION_EASE;
        state.speed += (targetSpeed - state.speed) * ease;
        state.angle = (state.angle + state.speed * dt) % 360;

        if (rotGroupRef.current) {
          rotGroupRef.current.style.transform = `rotate(${state.angle.toFixed(3)}deg)`;
        }
        if (svgRef.current) {
          svgRef.current.dataset.speed = Math.round(state.speed);
        }

        // Update flying dot positions (screen pixels)
        const W = window.innerWidth;
        const H = window.innerHeight;
        for (let i = 0; i < N_DOTS; i++) {
          if (!fl.flyActive[i]) continue;
          fl.flyX[i] += fl.flyVx[i] * dt;
          fl.flyY[i] += fl.flyVy[i] * dt;
          const flyEl = flyRefs.current[i];
          if (flyEl) {
            flyEl.setAttribute('cx', fl.flyX[i].toFixed(1));
            flyEl.setAttribute('cy', fl.flyY[i].toFixed(1));
            // Fade out once off-screen
            if (fl.flyX[i] < -80 || fl.flyX[i] > W + 80 || fl.flyY[i] < -80 || fl.flyY[i] > H + 80) {
              fl.flyActive[i] = 0;
              flyEl.style.transition = 'opacity 150ms ease';
              flyEl.style.opacity = '0';
            }
          }
        }
      }

      state.frame = window.requestAnimationFrame(tick);
    };

    state.frame = window.requestAnimationFrame(tick);

    return () => {
      if (state.frame) window.cancelAnimationFrame(state.frame);
      media.removeEventListener?.('change', onMotionPref);
      state.frame = null;
      state.lastTime = null;
    };
  }, [homeAngles]);

  const handlePointerDown = () => {
    const fl = flingRef.current;
    if (fl.active) return;
    fl.active = true;
    fl.startTime = performance.now();
    fl.ejected.clear();
    fl.allGone = false;
    fl.burstTime = null;
    fl.regenStartTime = null;
    fl.regenIndex = 0;
    fl.regenOrder = [];
    fl.flyActive.fill(0);
    stateRef.current.targetSpeed = IDLE_DEG_PER_SECOND;
    circleRefs.current.forEach(el => {
      if (el) { el.style.opacity = '1'; el.style.transition = 'fill 220ms ease'; }
    });
    flyRefs.current.forEach(el => {
      if (el) { el.style.opacity = '0'; el.style.transition = 'none'; }
    });
  };

  const handlePointerUp = () => {
    const fl = flingRef.current;
    if (!fl.active || fl.allGone) return;
    fl.active = false;
    fl.startTime = null;
    fl.ejected.clear();
    fl.flyActive.fill(0);
    stateRef.current.targetSpeed = stateRef.current.hovering ? HOVER_DEG_PER_SECOND : IDLE_DEG_PER_SECOND;
    circleRefs.current.forEach(el => {
      if (el) { el.style.opacity = '1'; el.style.transition = 'fill 220ms ease, opacity 300ms ease'; }
    });
    flyRefs.current.forEach(el => {
      if (el) { el.style.opacity = '0'; el.style.transition = 'none'; }
    });
  };

  const dots = useMemo(() =>
    homeAngles.map((angle, i) => ({
      cx: CX + R * Math.cos(angle),
      cy: CY + R * Math.sin(angle),
      color: baseColors[i],
    })),
    [homeAngles, baseColors]
  );

  // Full-screen portal for flying dots — no SVG clipping
  const flyingDotsPortal = mounted && ReactDOM.createPortal(
    <svg
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 99999,
        overflow: 'visible',
      }}
    >
      {Array.from({ length: N_DOTS }, (_, i) => (
        <circle
          key={`fly-${i}`}
          ref={el => { flyRefs.current[i] = el; }}
          cx={0}
          cy={0}
          r={2.5}
          fill="transparent"
          style={{ opacity: 0, transition: 'none' }}
        />
      ))}
    </svg>,
    document.body
  );

  return (
    <>
      <svg
        ref={svgRef}
        viewBox="0 0 28 28"
        width={size}
        height={size}
        aria-label="Unifolio"
        className={`unifolio-wheel-logo ${className}`}
        style={{ flexShrink: 0, display: 'block', cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none', overflow: 'visible' }}
        onPointerEnter={() => {
          stateRef.current.targetSpeed = HOVER_DEG_PER_SECOND;
          stateRef.current.hovering = true;
          setHovered(true);
          onHoverChange?.(true);
        }}
        onPointerLeave={() => {
          stateRef.current.targetSpeed = IDLE_DEG_PER_SECOND;
          stateRef.current.hovering = false;
          setHovered(false);
          onHoverChange?.(false);
          handlePointerUp();
        }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        {/* transformOrigin in SVG viewport % = (14,14) in all browsers; no fill-box needed */}
        <g
          ref={rotGroupRef}
          className="unifolio-wheel-logo__dots"
          style={{
            transformOrigin: '50% 50%',
            filter: goldWheel ? 'drop-shadow(0 0 0.6px rgba(255,200,0,0.9))' : undefined,
          }}
        >
          {dots.map((dot, i) => (
            <circle
              key={i}
              ref={el => { circleRefs.current[i] = el; }}
              cx={dot.cx}
              cy={dot.cy}
              r={2.5}
              fill={dotOverrides[i] || dot.color}
              style={{ transition: 'fill 220ms ease' }}
            />
          ))}
        </g>
      </svg>
      {flyingDotsPortal}
    </>
  );
}
