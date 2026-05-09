import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '@/lib/ThemeContext';

const N_DOTS = 12;
const CX = 14;
const CY = 14;
const R = 11;
const IDLE_DEG_PER_SECOND = 34;
const HOVER_DEG_PER_SECOND = 390;
const ACCELERATION_EASE = 0.035;
const DECELERATION_EASE = 0.022;
const DOT_RECOLOR_IDLE_MS = 2000;
const DOT_RECOLOR_HOVER_MS = 500;

function randomColor() {
  return `hsl(${Math.floor(Math.random() * 360)} 88% 58%)`;
}

export default function UnifolioWheelLogo({ className = '', size = 28 }) {
  const { chartColors } = useTheme();
  const dotsRef = useRef(null);
  const lastRecoloredRef = useRef(-1);
  const [hovered, setHovered] = useState(false);
  const [dotOverrides, setDotOverrides] = useState({});
  const stateRef = useRef({
    angle: 0,
    speed: IDLE_DEG_PER_SECOND,
    targetSpeed: IDLE_DEG_PER_SECOND,
    frame: null,
    lastTime: null,
    reducedMotion: false,
  });

  const dots = useMemo(() => (
    Array.from({ length: N_DOTS }, (_, i) => {
      const angle = (i / N_DOTS) * Math.PI * 2;
      return {
        x: CX + R * Math.cos(angle),
        y: CY + R * Math.sin(angle),
        color: chartColors[i % chartColors.length] || `var(--logo-dot-${i + 1})`,
      };
    })
  ), [chartColors]);

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
        return { ...prev, [index]: randomColor() };
      });
    };
    const timer = window.setInterval(recolor, hovered ? DOT_RECOLOR_HOVER_MS : DOT_RECOLOR_IDLE_MS);
    return () => window.clearInterval(timer);
  }, [hovered]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const state = stateRef.current;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    state.reducedMotion = media.matches;

    const handleMotionPreference = () => {
      state.reducedMotion = media.matches;
      if (state.reducedMotion && dotsRef.current) {
        dotsRef.current.style.transform = `rotate(${state.angle}deg)`;
      }
    };

    media.addEventListener?.('change', handleMotionPreference);

    const tick = (time) => {
      if (state.lastTime == null) state.lastTime = time;
      const deltaSeconds = Math.min(0.05, Math.max(0, (time - state.lastTime) / 1000));
      state.lastTime = time;

      if (!state.reducedMotion) {
        const ease = state.targetSpeed > state.speed ? ACCELERATION_EASE : DECELERATION_EASE;
        state.speed += (state.targetSpeed - state.speed) * ease;
        state.angle = (state.angle + state.speed * deltaSeconds) % 360;
        if (dotsRef.current) dotsRef.current.style.transform = `rotate(${state.angle}deg)`;
      }

      state.frame = window.requestAnimationFrame(tick);
    };

    state.frame = window.requestAnimationFrame(tick);

    return () => {
      if (state.frame) window.cancelAnimationFrame(state.frame);
      media.removeEventListener?.('change', handleMotionPreference);
      state.frame = null;
      state.lastTime = null;
    };
  }, []);

  return (
    <svg
      viewBox="0 0 28 28"
      width={size}
      height={size}
      aria-label="Unifolio"
      className={`unifolio-wheel-logo ${className}`}
      style={{ flexShrink: 0, display: 'block', cursor: 'pointer' }}
      onPointerEnter={() => { stateRef.current.targetSpeed = HOVER_DEG_PER_SECOND; setHovered(true); }}
      onPointerLeave={() => { stateRef.current.targetSpeed = IDLE_DEG_PER_SECOND; setHovered(false); }}
    >
      <g ref={dotsRef} className="unifolio-wheel-logo__dots">
        {dots.map((dot, i) => (
          <circle
            key={i}
            cx={dot.x}
            cy={dot.y}
            r={2.5}
            fill={dotOverrides[i] || dot.color}
            style={{ transition: 'fill 220ms ease' }}
          />
        ))}
      </g>
    </svg>
  );
}
