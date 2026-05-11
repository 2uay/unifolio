import React from 'react';
import { useTheme } from '@/lib/ThemeContext';

const N = 12;

export default function SpinningLogo({ size = 80 }) {
  const { chartColors } = useTheme();
  return (
    <div style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 28 28"
        width={size}
        height={size}
        style={{ overflow: 'visible' }}
      >
        <g
          style={{
            transformOrigin: '14px 14px',
            transformBox: 'fill-box',
            animation: 'unifolio-spin 5s linear infinite',
          }}
        >
          {Array.from({ length: N }, (_, i) => {
            const a = (i / N) * Math.PI * 2;
            const color = chartColors[i % chartColors.length] ?? '#a78bfa';
            return (
              <circle
                key={i}
                cx={14 + 11 * Math.cos(a)}
                cy={14 + 11 * Math.sin(a)}
                r={2.5}
                fill={color}
              />
            );
          })}
        </g>
      </svg>
      <style>{`@keyframes unifolio-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
