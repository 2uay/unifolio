import React from 'react';
import { useTheme } from '@/lib/ThemeContext';
import { useSecondaryColors } from '@/lib/SecondaryColorsContext';
import { useAccentBars } from '@/lib/AccentBarsContext';
import { cn } from '@/lib/utils';

export default function AccentBars() {
  const { accentBarsEnabled } = useAccentBars();
  const { currentTheme } = useTheme();
  const { palette } = useSecondaryColors();

  if (!accentBarsEnabled) return null;

  // Determine accent color based on theme
  let accentColor = 'hsl(217 91% 60%)'; // Default primary blue

  if (currentTheme === 'bloomberg') {
    // Bloomberg Black: refined yellow/amber accent
    accentColor = 'hsl(42 98% 52%)'; // Bloomberg-style yellow
  } else if (palette?.accentColor) {
    // Use secondary palette accent if available
    accentColor = palette.accentColor;
  }

  return (
    <>
      {/* Top Accent Bar */}
      <div
        className="fixed top-0 left-0 right-0 h-[3px] z-50 pointer-events-none"
        style={{
          background: `linear-gradient(90deg, ${accentColor}, ${accentColor}, ${accentColor})`,
          opacity: 0.8,
          boxShadow: `0 2px 8px ${accentColor}40`,
          animation: 'accent-shimmer 4s ease-in-out infinite',
        }}
      />

      {/* Bottom Accent Bar */}
      <div
        className="fixed bottom-0 left-0 right-0 h-[3px] z-50 pointer-events-none"
        style={{
          background: `linear-gradient(90deg, ${accentColor}, ${accentColor}, ${accentColor})`,
          opacity: 0.8,
          boxShadow: `0 -2px 8px ${accentColor}40`,
          animation: 'accent-shimmer 4s ease-in-out infinite 0.2s',
        }}
      />

      {/* Keyframe animation for subtle shimmer */}
      <style>{`
        @keyframes accent-shimmer {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 0.95; }
        }
      `}</style>
    </>
  );
}