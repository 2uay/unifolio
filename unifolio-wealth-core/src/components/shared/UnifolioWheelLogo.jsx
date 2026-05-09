import React, { useMemo } from 'react';
import { useTheme } from '@/lib/ThemeContext';

const N_DOTS = 12;
const CX = 14;
const CY = 14;
const R = 11;

export default function UnifolioWheelLogo({ className = '', size = 28 }) {
  const { chartColors } = useTheme();
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

  return (
    <svg
      viewBox="0 0 28 28"
      width={size}
      height={size}
      aria-label="Unifolio"
      className={`unifolio-wheel-logo ${className}`}
      style={{ flexShrink: 0, display: 'block', cursor: 'pointer' }}
    >
      <g className="unifolio-wheel-logo__dots">
        {dots.map((dot, i) => (
          <circle key={i} cx={dot.x} cy={dot.y} r={2.5} fill={dot.color} />
        ))}
      </g>
    </svg>
  );
}
