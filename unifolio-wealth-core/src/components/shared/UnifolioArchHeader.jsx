import React, { useEffect, useRef, useState } from 'react';
import UnifolioWheelLogo from './UnifolioWheelLogo';

// 8 elements: u, n, i, f, [LOGO at apex], l, i, o
// `null` at index 4 → render the spinning wheel logo there (it represents
// the first 'o' of "folio").
const ELEMENTS = ['u', 'n', 'i', 'f', null, 'l', 'i', 'o'];
// Symmetric arc — apex (90°) lands exactly at the logo (index 4)
const ANGLES_DEG = [170, 150, 130, 110, 90, 70, 50, 30];

export default function UnifolioArchHeader() {
  const [active, setActive]   = useState(false);
  const [flash,  setFlash]    = useState(false);
  const flashTimerRef         = useRef(null);

  useEffect(() => () => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
  }, []);

  const handleEnter = () => {
    setActive(true);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    // Trigger flash slightly after the last letter has fully faded in
    flashTimerRef.current = setTimeout(() => setFlash(true), 1480);
  };

  const handleLeave = () => {
    setActive(false);
    setFlash(false);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
  };

  return (
    <div
      className={`unifolio-arch ${active ? 'active' : ''} ${flash ? 'flash' : ''}`}
      aria-label="Unifolio"
      role="img"
    >
      {ELEMENTS.map((letter, i) => {
        const angle = ANGLES_DEG[i];
        const rad   = angle * Math.PI / 180;
        // CSS variables consumed by .arch-letter selector
        const style = {
          '--cos':  Math.cos(rad).toFixed(4),
          '--sin':  Math.sin(rad).toFixed(4),
          '--rot':  `${(90 - angle).toFixed(2)}deg`,
        };
        return (
          <div
            key={i}
            data-i={i}
            className={`arch-letter ${letter ? '' : 'arch-logo'}`}
            style={style}
            onPointerEnter={letter ? undefined : handleEnter}
            onPointerLeave={letter ? undefined : handleLeave}
          >
            {letter ? (
              <span className="unifolio-logo">
                <span className="unifolio-liquid-shell" aria-hidden="true">
                  <span className="unifolio-liquid-word" data-text={letter}>{letter}</span>
                </span>
              </span>
            ) : (
              <UnifolioWheelLogo size={144} />
            )}
          </div>
        );
      })}

      <style>{`
        .unifolio-arch {
          --R: clamp(160px, 32vw, 320px);
          position: relative;
          width: 100%;
          /* Container height = arc radius (apex sits at top, baseline at bottom) */
          height: clamp(160px, 32vw, 320px);
          margin: 0 0 1.5rem;
          pointer-events: none; /* only the logo accepts pointer events */
        }

        .arch-letter {
          position: absolute;
          left: calc(50% + var(--cos) * var(--R));
          top:  calc(100% - var(--sin) * var(--R));
          transform: translate(-50%, -50%) rotate(var(--rot));
          transform-origin: center;
          font-size: clamp(2.25rem, 6.4vw, 4.5rem);
          font-weight: 800;
          line-height: 1;
          letter-spacing: -0.02em;
          opacity: 0;
          transition: opacity 0.4s ease;
          pointer-events: none;
          will-change: opacity;
        }

        /* Logo (index 4) is always visible and never rotated */
        .arch-letter.arch-logo {
          opacity: 1;
          transform: translate(-50%, -50%);
          pointer-events: auto;
          cursor: pointer;
        }

        /* Sequential fade-in on hover */
        .unifolio-arch.active .arch-letter[data-i="0"] { opacity: 1; transition-delay:    0ms; }
        .unifolio-arch.active .arch-letter[data-i="1"] { opacity: 1; transition-delay:  180ms; }
        .unifolio-arch.active .arch-letter[data-i="2"] { opacity: 1; transition-delay:  360ms; }
        .unifolio-arch.active .arch-letter[data-i="3"] { opacity: 1; transition-delay:  540ms; }
        /* index 4 = logo, always visible */
        .unifolio-arch.active .arch-letter[data-i="5"] { opacity: 1; transition-delay:  720ms; }
        .unifolio-arch.active .arch-letter[data-i="6"] { opacity: 1; transition-delay:  900ms; }
        .unifolio-arch.active .arch-letter[data-i="7"] { opacity: 1; transition-delay: 1080ms; }

        /* One-shot flash: re-trigger glint on every letter at once */
        .unifolio-arch.flash .arch-letter:not(.arch-logo) .unifolio-liquid-word::after {
          animation: unifolio-logo-glint-hover 0.86s ease-out 1;
        }

        /* ---- Wordmark styles (mirrored from UnifolioLogo.jsx) ---- */
        .unifolio-arch .unifolio-logo {
          --logo-x: 50%;
          --logo-y: 48%;
          --logo-energy: 0;
          --logo-lift: 0%;
          --logo-glow: 0.12;
          --logo-spark: 0.22;
          --logo-ring: 0.52;
          --logo-highlight: 0.18;
          --logo-ripple: 0.12;
          --logo-ripple-x: 35%;
          --logo-slosh-speed: 5.8s;
          --logo-saturate: 1.05;
          --logo-contrast: 1.05;
          position: relative;
          display: inline-grid;
          place-items: center;
          line-height: 1;
        }

        .unifolio-arch .unifolio-liquid-shell {
          position: relative;
          display: inline-block;
          line-height: 1;
          filter:
            saturate(var(--logo-saturate))
            contrast(var(--logo-contrast))
            drop-shadow(0 0 0.5px hsl(var(--foreground) / 0.34))
            drop-shadow(0 8px 18px hsl(var(--primary) / var(--logo-glow)));
        }

        .unifolio-arch .unifolio-liquid-word {
          position: relative;
          z-index: 1;
          display: inline-block;
          white-space: nowrap;
          color: transparent;
          -webkit-text-fill-color: transparent;
          background:
            radial-gradient(circle at var(--logo-x) var(--logo-y),
              hsl(var(--foreground) / var(--logo-spark)) 0 5%,
              transparent 18%),
            radial-gradient(110% 80% at calc(var(--logo-x) + 18%) calc(72% - var(--logo-lift)),
              hsl(var(--ring) / var(--logo-ring)) 0 12%,
              transparent 33%),
            linear-gradient(100deg,
              hsl(var(--primary) / 0.96),
              hsl(var(--chart-1) / 0.82) 34%,
              hsl(var(--ring) / 0.96) 68%,
              hsl(var(--primary) / 0.92)),
            repeating-radial-gradient(ellipse at calc(var(--logo-x) + 8%) calc(80% - var(--logo-lift)),
              hsl(var(--foreground) / 0.34) 0 1px,
              transparent 2px 9px);
          background-size: 160% 160%, 150% 130%, 230% 230%, 170% 120%;
          background-position:
            var(--logo-x) var(--logo-y),
            50% calc(86% - var(--logo-lift)),
            0% 54%,
            var(--logo-ripple-x) calc(98% - var(--logo-lift));
          -webkit-background-clip: text;
          background-clip: text;
          animation: unifolio-liquid-slosh var(--logo-slosh-speed) ease-in-out infinite;
        }

        .unifolio-arch .unifolio-liquid-word::before,
        .unifolio-arch .unifolio-liquid-word::after {
          content: attr(data-text);
          position: absolute;
          inset: 0;
          pointer-events: none;
          white-space: nowrap;
        }

        .unifolio-arch .unifolio-liquid-word::before {
          z-index: -1;
          color: hsl(var(--foreground) / 0.16);
          -webkit-text-fill-color: hsl(var(--foreground) / 0.16);
          text-shadow:
            0 0 0.045em hsl(var(--foreground) / 0.42),
            0 0.06em 0.18em hsl(var(--background) / 0.8);
        }

        .unifolio-arch .unifolio-liquid-word::after {
          z-index: 2;
          color: transparent;
          -webkit-text-fill-color: transparent;
          background:
            linear-gradient(108deg,
              transparent 0 39%,
              hsl(var(--foreground) / 0.18) 44%,
              hsl(var(--foreground) / 0.94) 49%,
              hsl(var(--primary-foreground) / 0.86) 51%,
              hsl(var(--foreground) / 0.28) 56%,
              transparent 63% 100%),
            radial-gradient(circle at 50% 52%,
              hsl(var(--foreground) / 0.54),
              transparent 32%);
          background-size: 240% 100%, 55% 120%;
          background-position: -190% 0, -145% 50%;
          -webkit-background-clip: text;
          background-clip: text;
          mix-blend-mode: screen;
          opacity: 0;
          animation: unifolio-logo-glint 10s ease-in-out infinite;
        }

        @keyframes unifolio-liquid-slosh {
          0%, 100% {
            background-position:
              var(--logo-x) var(--logo-y),
              42% calc(84% - var(--logo-lift)),
              0% 52%,
              0% calc(99% - var(--logo-lift));
          }
          28% {
            background-position:
              calc(var(--logo-x) + 8%) calc(var(--logo-y) + 4%),
              70% calc(76% - var(--logo-lift)),
              62% 46%,
              46% calc(88% - var(--logo-lift));
          }
          58% {
            background-position:
              calc(var(--logo-x) - 11%) calc(var(--logo-y) - 3%),
              22% calc(80% - var(--logo-lift)),
              100% 60%,
              100% calc(94% - var(--logo-lift));
          }
        }

        @keyframes unifolio-logo-glint {
          0%, 88% { opacity: 0; background-position: -190% 0, -145% 50%; }
          89%     { opacity: 0; background-position: -120% 0,  -75% 50%; }
          91%     { opacity: 0.96; }
          94%     { opacity: 0.98; background-position: 118% 0, 120% 50%; }
          96%     { opacity: 0; background-position: 190% 0, 165% 50%; }
          100%    { opacity: 0; background-position: 190% 0, 165% 50%; }
        }

        @keyframes unifolio-logo-glint-hover {
          0%   { opacity: 0;    background-position: -190% 0, -145% 50%; }
          12%  { opacity: 0;    background-position: -120% 0,  -75% 50%; }
          34%  { opacity: 0.96; }
          68%  { opacity: 0.98; background-position: 118% 0, 120% 50%; }
          100% { opacity: 0;    background-position: 190% 0, 165% 50%; }
        }

        @media (prefers-reduced-motion: reduce) {
          .arch-letter:not(.arch-logo) {
            transition: none;
          }
          .unifolio-arch.active .arch-letter:not(.arch-logo) {
            transition-delay: 0ms !important;
            opacity: 1;
          }
          .unifolio-arch.flash .arch-letter:not(.arch-logo) .unifolio-liquid-word::after {
            animation: none;
          }
          .unifolio-arch .unifolio-liquid-word { animation: none; }
          .unifolio-arch .unifolio-liquid-word::after {
            animation: none;
            opacity: 0.16;
            background-position: 50% 0, 50% 50%;
          }
        }
      `}</style>
    </div>
  );
}
