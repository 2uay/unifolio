import React from 'react';

/**
 * Unifolio logo with a living-blob hover animation.
 * The overlay layer uses background-clip:text with a gradient that sweeps from
 * right → left on hover, with elastic easing + a glow pulse once settled.
 * Trigger fires on self-hover OR when a parent has class "group" (hover:group).
 */
export default function UnifolioLogo({ className = '' }) {
  return (
    <>
      <span className={`unifolio-logo ${className}`}>
        {/* Resting state: amber "Uni" + foreground "folio" */}
        <span className="unifolio-base">
          <span className="text-primary">Uni</span>folio
        </span>
        {/* Blob overlay — hidden until hover, sweeps in from right */}
        <span className="unifolio-blob" aria-hidden="true">Unifolio</span>
      </span>

      <style>{`
        .unifolio-logo {
          position: relative;
          display: inline-block;
        }

        .unifolio-base {
          display: inline-block;
        }

        .unifolio-blob {
          position: absolute;
          inset: 0;
          opacity: 0;
          transition: opacity 0.25s ease;
          white-space: nowrap;
          pointer-events: none;

          /* Gradient: amber (left) → bright-amber soft edge → white (right) */
          background: linear-gradient(
            90deg,
            hsl(38, 92%, 50%)  0%,
            hsl(38, 92%, 50%)  36%,
            hsl(38, 97%, 68%)  50%,
            hsl(0,  0%,  92%)  64%,
            hsl(0,  0%,  92%)  100%
          );
          background-size: 260% 100%;
          background-position: 100% 0%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
        }

        /* Trigger on self-hover or parent group-hover */
        .unifolio-logo:hover .unifolio-blob,
        .group:hover .unifolio-blob {
          opacity: 1;
          animation:
            unifolio-swallow 0.65s cubic-bezier(0.22, 1.42, 0.36, 1) forwards,
            unifolio-pulse   2.4s ease-in-out 0.65s infinite;
        }

        /* Blob sweeps right-to-left with an elastic overshoot */
        @keyframes unifolio-swallow {
          0%   { background-position: 100% 0%; }
          45%  { background-position: 10%  0%; }
          65%  { background-position: -7%  0%; }
          82%  { background-position: 4%   0%; }
          100% { background-position: 0%   0%; }
        }

        /* Subtle amber glow breathe after settling */
        @keyframes unifolio-pulse {
          0%, 100% {
            filter: brightness(1) drop-shadow(0 0 0px hsl(38 92% 50% / 0));
          }
          50% {
            filter: brightness(1.14) drop-shadow(0 0 7px hsl(38 92% 50% / 0.45));
          }
        }
      `}</style>
    </>
  );
}
