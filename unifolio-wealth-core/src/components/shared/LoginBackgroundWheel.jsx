import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState, useMemo } from 'react';
import { useTheme } from '@/lib/ThemeContext';

const N_DOTS = 24;
const CX = 50;
const CY = 50;
const R = 46;
const DOT_R = 1.8;
const BASE_SPEED = 6;

function randomColor() {
  return `hsl(${Math.floor(Math.random() * 360)} ${70 + Math.floor(Math.random() * 25)}% ${52 + Math.floor(Math.random() * 16)}%)`;
}

const LoginBackgroundWheel = forwardRef(function LoginBackgroundWheel({ hovered = false }, ref) {
  const { chartColors } = useTheme();
  const dotsRef = useRef(null);
  const stateRef = useRef({
    angle: 0, speed: BASE_SPEED, lastTime: null, frame: null, reducedMotion: false,
  });
  useImperativeHandle(ref, () => ({ getAngle: () => stateRef.current.angle }));

  const [clickColors, setClickColors] = useState({});
  const [breathePhases] = useState(() =>
    Array.from({ length: N_DOTS }, (_, i) => (i / N_DOTS) * Math.PI * 2)
  );

  const dots = useMemo(() => (
    Array.from({ length: N_DOTS }, (_, i) => {
      const angle = (i / N_DOTS) * Math.PI * 2;
      return {
        x: CX + R * Math.cos(angle),
        y: CY + R * Math.sin(angle),
        color: chartColors[i % chartColors.length] || `hsl(${(i * 360 / N_DOTS)} 70% 60%)`,
        phase: breathePhases[i],
      };
    })
  ), [chartColors, breathePhases]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const state = stateRef.current;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    state.reducedMotion = media.matches;
    if (state.reducedMotion) return undefined;

    const tick = (time) => {
      if (state.lastTime == null) state.lastTime = time;
      const dt = Math.min(0.05, (time - state.lastTime) / 1000);
      state.lastTime = time;

      const wobble = Math.sin(time / 3800) * 2.5;
      state.angle = (state.angle + (BASE_SPEED + wobble) * dt) % 360;

      if (dotsRef.current) {
        dotsRef.current.style.transform = `rotate(${state.angle}deg)`;
      }

      const circles = dotsRef.current?.querySelectorAll('circle');
      if (circles) {
        circles.forEach((c, i) => {
          const phase = breathePhases[i] + time / 4200;
          c.style.opacity = (0.65 + Math.sin(phase) * 0.28).toFixed(3);
        });
      }

      state.frame = window.requestAnimationFrame(tick);
    };

    state.frame = window.requestAnimationFrame(tick);
    return () => {
      if (state.frame) window.cancelAnimationFrame(state.frame);
      state.frame = null;
      state.lastTime = null;
    };
  }, [breathePhases]);

  const handleDotClick = (i, e) => {
    e.stopPropagation();
    setClickColors(prev => ({ ...prev, [i]: randomColor() }));
  };

  return (
    <div
      aria-hidden="true"
      // Constrain the wheel container to exactly one viewport height anchored
      // at the top of the parent. On a tall page like /plans, `inset: 0` would
      // stretch this to the full page height — moving the wheel's center far
      // below the viewport and clipping its top edge just under the hero logo.
      // Pinning to 100vh at the top keeps the circle's center on the first
      // visible screen, so all edges of the 180vw circle fall outside the
      // viewport (haziness extends past every border, no clipping visible).
      style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '100vh', pointerEvents: 'none', overflow: 'hidden', zIndex: 1 }}
    >
      {/* Background rotating ring — 180vw decorative element, centered on
          the 100vh container so its center sits at viewport center. */}
      <div
        style={{
          position: 'absolute',
          width: '180vw', height: '180vw',
          left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      >
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid meet"
          style={{ width: '100%', height: '100%', opacity: 0.72, pointerEvents: 'none' }}
        >
          <circle cx={CX} cy={CY} r={R + DOT_R + 0.8}
            fill="none" stroke="url(#lgw-ring-grad)" strokeWidth="0.3" opacity="0.5" />
          <circle cx={CX} cy={CY} r={R - DOT_R - 0.8}
            fill="none" stroke="url(#lgw-ring-grad)" strokeWidth="0.15" opacity="0.3" />
          <defs>
            <radialGradient id="lgw-ring-grad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.9" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
            </radialGradient>
          </defs>
          <g ref={dotsRef} style={{ transformOrigin: `${CX}px ${CY}px`, transformBox: 'view-box' }}>
            {dots.map((dot, i) => (
              <circle
                key={i}
                cx={dot.x} cy={dot.y} r={DOT_R}
                fill={clickColors[i] || dot.color}
                style={{
                  transition: 'fill 320ms ease',
                  filter: `blur(0.1px) drop-shadow(0 0 1.8px ${clickColors[i] || dot.color})`,
                  pointerEvents: 'auto',
                  cursor: 'pointer',
                }}
                onClick={(e) => handleDotClick(i, e)}
              />
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
});

export default LoginBackgroundWheel;
