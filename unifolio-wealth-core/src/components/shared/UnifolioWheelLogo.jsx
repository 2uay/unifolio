import React, { useEffect, useMemo, useRef } from 'react';
import { useTheme } from '@/lib/ThemeContext';

const N_DOTS = 12;
const CX = 14;
const CY = 14;
const R = 11;
const IDLE_DEG_PER_SECOND = 34;
const HOVER_DEG_PER_SECOND = 390;
const ACCELERATION_EASE = 0.035;
const DECELERATION_EASE = 0.022;

export default function UnifolioWheelLogo({ className = '', size = 28 }) {
  const { chartColors } = useTheme();
  const dotsRef = useRef(null);
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
      onPointerEnter={() => { stateRef.current.targetSpeed = HOVER_DEG_PER_SECOND; }}
      onPointerLeave={() => { stateRef.current.targetSpeed = IDLE_DEG_PER_SECOND; }}
    >
      <g ref={dotsRef} className="unifolio-wheel-logo__dots">
        {dots.map((dot, i) => (
          <circle key={i} cx={dot.x} cy={dot.y} r={2.5} fill={dot.color} />
        ))}
      </g>
    </svg>
  );
}
