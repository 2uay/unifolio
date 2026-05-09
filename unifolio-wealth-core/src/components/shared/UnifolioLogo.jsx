import React, { useEffect, useRef } from 'react';

export default function UnifolioLogo({ className = '' }) {
  const logoRef = useRef(null);

  useEffect(() => {
    const el = logoRef.current;
    if (!el || typeof window === 'undefined') return undefined;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return undefined;

    let raf = null;
    let glintTimer = null;
    let glintFrame = null;
    const baseEnergy = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--logo-energy') || '1') - 1;
    const idleEnergy = Math.max(0, Math.min(0.85, baseEnergy * 0.55));
    const target = { x: 50, y: 48, energy: idleEnergy };
    const current = { x: 50, y: 48, energy: idleEnergy };

    const applyFlood = ({ x, y, energy }) => {
      el.style.setProperty('--logo-energy', energy.toFixed(2));
      el.style.setProperty('--logo-x', `${x.toFixed(1)}%`);
      el.style.setProperty('--logo-y', `${y.toFixed(1)}%`);
      el.style.setProperty('--logo-ripple-x', `${(x * 0.7).toFixed(1)}%`);
      el.style.setProperty('--logo-lift', `${(energy * 12).toFixed(1)}%`);
      el.style.setProperty('--logo-glow', (0.08 + energy * 0.18).toFixed(3));
      el.style.setProperty('--logo-spark', (0.22 + energy * 0.24).toFixed(3));
      el.style.setProperty('--logo-ring', (0.52 + energy * 0.3).toFixed(3));
      el.style.setProperty('--logo-highlight', (0.18 + energy * 0.3).toFixed(3));
      el.style.setProperty('--logo-ripple', (0.12 + energy * 0.2).toFixed(3));
      el.style.setProperty('--logo-slosh-speed', `${(5.8 - energy * 2.2).toFixed(2)}s`);
      el.style.setProperty('--logo-saturate', (1 + energy * 0.42).toFixed(3));
      el.style.setProperty('--logo-contrast', (1 + energy * 0.18).toFixed(3));
    };

    const settle = () => {
      current.x += (target.x - current.x) * 0.16;
      current.y += (target.y - current.y) * 0.16;
      current.energy += (target.energy - current.energy) * 0.12;
      applyFlood(current);
      raf = window.requestAnimationFrame(settle);
    };
    raf = window.requestAnimationFrame(settle);

    const handleMove = (event) => {
      const rect = el.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
      const centerDistance = Math.abs(x - 0.5) + Math.abs(y - 0.5);
      target.x = x * 100;
      target.y = y * 100;
      target.energy = Math.min(1, 0.56 + centerDistance * 0.72);
    };

    const handleEnter = () => {
      target.energy = 0.64;
      el.classList.remove('unifolio-logo-hover-glint');
      if (glintTimer) window.clearTimeout(glintTimer);
      if (glintFrame) window.cancelAnimationFrame(glintFrame);
      glintFrame = window.requestAnimationFrame(() => {
        el.classList.add('unifolio-logo-hover-glint');
        glintTimer = window.setTimeout(() => {
          el.classList.remove('unifolio-logo-hover-glint');
          glintTimer = null;
        }, 900);
        glintFrame = null;
      });
    };

    const handleLeave = () => {
      target.x = 50;
      target.y = 48;
      target.energy = idleEnergy;
    };

    el.addEventListener('pointerenter', handleEnter);
    el.addEventListener('pointermove', handleMove);
    el.addEventListener('pointerleave', handleLeave);

    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      if (glintTimer) window.clearTimeout(glintTimer);
      if (glintFrame) window.cancelAnimationFrame(glintFrame);
      el.removeEventListener('pointerenter', handleEnter);
      el.removeEventListener('pointermove', handleMove);
      el.removeEventListener('pointerleave', handleLeave);
    };
  }, []);

  return (
    <>
      <span
        ref={logoRef}
        className={`unifolio-logo ${className}`}
        aria-label="Unifolio"
        role="img"
      >
        <span className="unifolio-liquid-shell" aria-hidden="true">
          <span className="unifolio-liquid-word" data-text="unifolio">
            unifolio
          </span>
        </span>
      </span>

      <style>{`
        .unifolio-logo {
          --logo-x: 50%;
          --logo-y: 48%;
          --logo-energy: 0;
          --logo-lift: 0%;
          --logo-glow: 0.08;
          --logo-spark: 0.22;
          --logo-ring: 0.52;
          --logo-highlight: 0.18;
          --logo-ripple: 0.12;
          --logo-ripple-x: 35%;
          --logo-slosh-speed: 5.8s;
          --logo-saturate: 1;
          --logo-contrast: 1;
          position: relative;
          display: inline-grid;
          place-items: center;
          line-height: 1;
          cursor: inherit;
        }

        .unifolio-liquid-shell {
          position: relative;
          display: inline-block;
          line-height: 1;
          filter:
            saturate(var(--logo-saturate))
            contrast(var(--logo-contrast))
            drop-shadow(0 0 0.5px hsl(var(--foreground) / 0.34))
            drop-shadow(0 8px 18px hsl(var(--primary) / var(--logo-glow)));
        }

        .unifolio-liquid-word {
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

        .unifolio-liquid-word::before,
        .unifolio-liquid-word::after {
          content: attr(data-text);
          position: absolute;
          inset: 0;
          pointer-events: none;
          white-space: nowrap;
        }

        .unifolio-liquid-word::before {
          z-index: -1;
          color: hsl(var(--foreground) / 0.16);
          -webkit-text-fill-color: hsl(var(--foreground) / 0.16);
          text-shadow:
            0 0 0.045em hsl(var(--foreground) / 0.42),
            0 0.06em 0.18em hsl(var(--background) / 0.8);
        }

        .unifolio-liquid-word::after {
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

        .unifolio-logo-hover-glint .unifolio-liquid-word::after {
          animation: unifolio-logo-glint-hover 0.86s ease-out 1;
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
          0%, 88% {
            opacity: 0;
            background-position: -190% 0, -145% 50%;
          }
          89% {
            opacity: 0;
            background-position: -120% 0, -75% 50%;
          }
          91% {
            opacity: 0.96;
          }
          94% {
            opacity: 0.98;
            background-position: 118% 0, 120% 50%;
          }
          96% {
            opacity: 0;
            background-position: 190% 0, 165% 50%;
          }
          100% {
            opacity: 0;
            background-position: 190% 0, 165% 50%;
          }
        }

        @keyframes unifolio-logo-glint-hover {
          0% {
            opacity: 0;
            background-position: -190% 0, -145% 50%;
          }
          12% {
            opacity: 0;
            background-position: -120% 0, -75% 50%;
          }
          34% {
            opacity: 0.96;
          }
          68% {
            opacity: 0.98;
            background-position: 118% 0, 120% 50%;
          }
          100% {
            opacity: 0;
            background-position: 190% 0, 165% 50%;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .unifolio-liquid-shell {
            filter:
              drop-shadow(0 0 0.5px hsl(var(--foreground) / 0.34))
              drop-shadow(0 8px 18px hsl(var(--primary) / 0.08));
          }

          .unifolio-liquid-word {
            animation: none;
          }

          .unifolio-liquid-word::after {
            animation: none;
            opacity: 0.16;
            background-position: 50% 0, 50% 50%;
          }

          .unifolio-liquid-word {
            background-position:
              50% 48%,
              50% 82%,
              44% 54%,
              50% 96%;
          }
        }
      `}</style>
    </>
  );
}
