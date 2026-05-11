import React from 'react';

// Scatter vectors [vw-x, vw-y, rot-deg] per letter when flung
const SCATTER = [
  [-22, -18, -120],
  [-13, -22,  -80],
  [-3,  -24,   30],
  [7,   -20,   60],
  [18,  -10,   90],
  [24,    2,  110],
  [22,   14,   80],
  [12,   20,   45],
];

const LETTERS = ['u', 'n', 'i', 'f', 'o', 'l', 'i', 'o'];

export default function LoginBrandReveal({ hovered = false, flung = false }) {
  return (
    <>
      <div aria-hidden="true" className="lbr-wordmark">
        {LETTERS.map((letter, i) => {
          const [sx, sy, sr] = SCATTER[i];
          const revealDelay = `${i * 70}ms`;
          const flingDelay  = `${i * 18}ms`;

          const motionStyle = flung ? {
            opacity: 0,
            transform: `translate(${sx}vw, ${sy}vw) scale(0.06) rotate(${sr}deg)`,
            transition: `opacity 250ms cubic-bezier(0.4,0,1,1) ${flingDelay}, transform 370ms cubic-bezier(0.2,0,0.9,1) ${flingDelay}`,
          } : hovered ? {
            opacity: 1,
            transform: 'translate(0,0) scale(1)',
            transition: `opacity 280ms ease ${revealDelay}, transform 460ms cubic-bezier(0.2,0.9,0.2,1) ${revealDelay}`,
          } : {
            opacity: 0,
            transform: 'translate(0,0) scale(0.5)',
            transition: `opacity 280ms ease ${revealDelay}, transform 460ms cubic-bezier(0.2,0.9,0.2,1) ${revealDelay}`,
          };

          return (
            <span
              key={i}
              className="lbr-shell"
              style={{ '--li': i, ...motionStyle }}
            >
              <span className="lbr-word" data-text={letter}>{letter}</span>
            </span>
          );
        })}
      </div>

      <style>{`
        .lbr-wordmark {
          position: absolute;
          bottom: 1.4rem;
          right: 1.6rem;
          display: flex;
          align-items: center;
          pointer-events: none;
          z-index: 8;
          /* Slightly smaller than sidebar text-lg */
          font-size: 0.875rem;
          font-weight: 700;
          letter-spacing: -0.025em;
          line-height: 1;
          /* same CSS vars the top-bar logo uses */
          --logo-x: 50%;
          --logo-y: 48%;
          --logo-energy: 0;
          --logo-lift: 0%;
          --logo-spark: 0.22;
          --logo-ring: 0.52;
          --logo-highlight: 0.18;
          --logo-ripple: 0.12;
          --logo-ripple-x: 35%;
          --logo-slosh-speed: 5.8s;
          --logo-saturate: 1;
          --logo-contrast: 1;
          --logo-glow: 0.08;
        }

        .lbr-shell {
          display: inline-block;
          line-height: 1;
          filter:
            saturate(var(--logo-saturate))
            contrast(var(--logo-contrast))
            drop-shadow(0 0 0.5px hsl(var(--foreground) / 0.34))
            drop-shadow(0 8px 18px hsl(var(--primary) / var(--logo-glow)));
        }

        /* Identical to .unifolio-liquid-word in UnifolioLogo.jsx */
        .lbr-word {
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
          animation: lbr-slosh var(--logo-slosh-speed) ease-in-out infinite;
        }

        .lbr-word::before,
        .lbr-word::after {
          content: attr(data-text);
          position: absolute;
          inset: 0;
          pointer-events: none;
          white-space: nowrap;
        }

        .lbr-word::before {
          z-index: -1;
          color: hsl(var(--foreground) / 0.16);
          -webkit-text-fill-color: hsl(var(--foreground) / 0.16);
          text-shadow:
            0 0 0.045em hsl(var(--foreground) / 0.42),
            0 0.06em 0.18em hsl(var(--background) / 0.8);
        }

        .lbr-word::after {
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
          animation: lbr-glint 10s ease-in-out infinite;
          animation-delay: calc(var(--li, 0) * 0.4s);
        }

        @keyframes lbr-slosh {
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

        @keyframes lbr-glint {
          0%, 88% { opacity: 0; background-position: -190% 0, -145% 50%; }
          89%      { opacity: 0; background-position: -120% 0, -75% 50%; }
          91%      { opacity: 0.96; }
          94%      { opacity: 0.98; background-position: 118% 0, 120% 50%; }
          96%, 100%{ opacity: 0; background-position: 190% 0, 165% 50%; }
        }
      `}</style>
    </>
  );
}
