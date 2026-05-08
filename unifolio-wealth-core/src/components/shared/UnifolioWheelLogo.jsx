import React, { useRef, useEffect, useState } from 'react';

const IDLE_SPEED  = 0.09;
const HOVER_SPEED = 2.0;
const N_DOTS = 12;

export default function UnifolioWheelLogo({ className = '', size = 28 }) {
  const state = useRef({
    angle: 0,
    speed: IDLE_SPEED,
    hovering: false,
    frame: null,
    frameCount: 0,
    reducedMotion: false,
  });

  const [, setTick] = useState(0);

  useEffect(() => {
    state.current.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const tick = () => {
      const s = state.current;
      s.speed += ((s.hovering ? HOVER_SPEED : IDLE_SPEED) - s.speed) * 0.05;
      if (!s.reducedMotion) s.angle += s.speed;
      s.frameCount++;
      if (s.frameCount % 2 === 0) setTick(v => v + 1);
      s.frame = requestAnimationFrame(tick);
    };
    state.current.frame = requestAnimationFrame(tick);
    return () => { if (state.current.frame) cancelAnimationFrame(state.current.frame); };
  }, []);

  const { angle } = state.current;
  const toRad = d => (d * Math.PI) / 180;
  const CX = 14, CY = 14, R = 11;

  const dots = Array.from({ length: N_DOTS }, (_, i) => {
    const deg = i * (360 / N_DOTS) + angle;
    return {
      x: CX + R * Math.cos(toRad(deg)),
      y: CY + R * Math.sin(toRad(deg)),
      color: `hsl(${(i * 30 + Math.floor(angle * 0.8)) % 360}, 82%, 62%)`,
    };
  });

  return (
    <svg
      viewBox="0 0 28 28"
      width={size}
      height={size}
      aria-label="Unifolio"
      className={className}
      style={{ flexShrink: 0, display: 'block', cursor: 'pointer', filter: 'hue-rotate(var(--logo-hue-base, 0deg))' }}
      onMouseEnter={() => { state.current.hovering = true; }}
      onMouseLeave={() => { state.current.hovering = false; }}
    >
      {dots.map((dot, i) => (
        <circle key={i} cx={dot.x} cy={dot.y} r={2.5} fill={dot.color} />
      ))}
    </svg>
  );
}
