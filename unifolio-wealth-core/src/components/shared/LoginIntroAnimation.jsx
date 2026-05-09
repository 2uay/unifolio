import React, { useEffect } from 'react';
import { ChevronRight } from 'lucide-react';

const INTRO_DURATION_MS = 7200;
const N_DOTS = 12;
const LOGO_SIZE = 144;
const DOT_RADIUS = (2.5 / 28) * LOGO_SIZE;
const RING_RADIUS = (11 / 28) * LOGO_SIZE;

const RIBBONS = [
  { id: 'a', top: '44%', h: '46px', rotZ: -38, alpha: 0.58, delay: '0.08s', from: '-132vw', to: '132vw' },
  { id: 'b', top: '58%', h: '26px', rotZ: 42, alpha: 0.44, delay: '0.18s', from: '132vw', to: '-132vw' },
  { id: 'c', top: '31%', h: '62px', rotZ: -14, alpha: 0.5, delay: '0.28s', from: '-132vw', to: '132vw' },
  { id: 'd', top: '66%', h: '20px', rotZ: 70, alpha: 0.32, delay: '0.38s', from: '132vw', to: '-132vw' },
  { id: 'e', top: '50%', h: '34px', rotZ: -58, alpha: 0.38, delay: '0.48s', from: '-132vw', to: '132vw' },
];

const SCATTER_DOTS = [
  { x: 12, y: 24 },
  { x: 22, y: 68 },
  { x: 34, y: 18 },
  { x: 46, y: 76 },
  { x: 57, y: 31 },
  { x: 66, y: 61 },
  { x: 77, y: 20 },
  { x: 86, y: 72 },
  { x: 18, y: 48 },
  { x: 39, y: 52 },
  { x: 61, y: 43 },
  { x: 82, y: 41 },
];

function dotKeyframes(index, popAtMs) {
  const popStart = (popAtMs / INTRO_DURATION_MS) * 100;
  const popPeak = ((popAtMs + 260) / INTRO_DURATION_MS) * 100;
  return `
    @keyframes login-intro-dot-${index} {
      0%, ${popStart.toFixed(2)}% {
        opacity: 0;
        transform: translate(var(--scatter-x), var(--scatter-y)) translate(-50%, -50%) scale(0.18);
      }
      ${popPeak.toFixed(2)}%, 61% {
        opacity: 1;
        transform: translate(var(--scatter-x), var(--scatter-y)) translate(-50%, -50%) scale(1);
      }
      78% {
        opacity: 1;
        transform: translate(var(--ring-x), var(--ring-y)) translate(-50%, -50%) scale(1);
      }
      82%, 100% {
        opacity: 0;
        transform: translate(var(--ring-x), var(--ring-y)) translate(-50%, -50%) scale(1);
      }
    }
  `;
}

export default function LoginIntroAnimation({ onComplete }) {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      onComplete?.();
      return undefined;
    }

    const timer = window.setTimeout(() => onComplete?.(), INTRO_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [onComplete]);

  const dots = Array.from({ length: N_DOTS }, (_, i) => {
    const angle = (i / N_DOTS) * Math.PI * 2;
    const ringX = Math.cos(angle) * RING_RADIUS;
    const ringY = Math.sin(angle) * RING_RADIUS;
    const scatter = SCATTER_DOTS[i];

    return {
      id: i,
      color: `hsl(${i * 30}, 82%, 62%)`,
      scatterX: `${scatter.x}vw`,
      scatterY: `${scatter.y}vh`,
      ringX: `calc(var(--intro-logo-x) + ${ringX.toFixed(2)}px)`,
      ringY: `calc(var(--intro-logo-y) + ${ringY.toFixed(2)}px)`,
      popAtMs: 400 + i * 330,
    };
  });

  return (
    <div className="login-intro fixed inset-0 z-50 overflow-hidden bg-black">
      <div className="login-intro-rods" aria-hidden="true">
        {RIBBONS.map((ribbon) => (
          <span
            key={ribbon.id}
            className="login-intro-rod"
            style={{
              '--rod-top': ribbon.top,
              '--rod-height': ribbon.h,
              '--rod-rotation': `${ribbon.rotZ}deg`,
              '--rod-alpha': ribbon.alpha,
              '--rod-delay': ribbon.delay,
              '--rod-from': ribbon.from,
              '--rod-to': ribbon.to,
            }}
          />
        ))}
      </div>

      <div aria-hidden="true">
        {dots.map((dot) => (
          <span
            key={dot.id}
            className="login-intro-dot"
            style={{
              '--scatter-x': dot.scatterX,
              '--scatter-y': dot.scatterY,
              '--ring-x': dot.ringX,
              '--ring-y': dot.ringY,
              '--dot-color': dot.color,
              '--dot-keyframe': `login-intro-dot-${dot.id}`,
            }}
          />
        ))}
      </div>

      <svg
        className="login-intro-wheel"
        viewBox="0 0 28 28"
        width={LOGO_SIZE}
        height={LOGO_SIZE}
        aria-hidden="true"
      >
        {Array.from({ length: N_DOTS }, (_, i) => {
          const angle = (i / N_DOTS) * Math.PI * 2;
          const x = 14 + 11 * Math.cos(angle);
          const y = 14 + 11 * Math.sin(angle);
          return <circle key={i} cx={x} cy={y} r={2.5} fill={`hsl(${i * 30}, 82%, 62%)`} />;
        })}
      </svg>

      <button
        type="button"
        className="login-intro-skip"
        aria-label="Skip intro"
        onClick={onComplete}
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>

      <style>{`
        .login-intro {
          --intro-logo-x: 50vw;
          --intro-logo-y: clamp(104px, 30vh, 250px);
          animation: login-intro-fade-out 0.42s ease 6.86s forwards;
        }

        .login-intro::after {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at var(--intro-logo-x) var(--intro-logo-y), hsl(var(--primary) / 0.2), transparent 22%),
            radial-gradient(ellipse 90% 75% at 50% 50%, transparent 18%, rgb(0 0 0 / 0.72) 100%);
          pointer-events: none;
        }

        .login-intro-rod {
          position: absolute;
          left: 50%;
          top: var(--rod-top);
          width: 190vw;
          height: var(--rod-height);
          border-radius: 3px;
          opacity: 0;
          transform: translate(-50%, -50%) rotateZ(var(--rod-rotation)) translateX(var(--rod-from));
          background: linear-gradient(
            to right,
            transparent 0%,
            hsl(var(--primary) / calc(var(--rod-alpha) * 0.52)) 8%,
            hsl(var(--primary) / var(--rod-alpha)) 26%,
            hsl(var(--primary) / var(--rod-alpha)) 74%,
            hsl(var(--primary) / calc(var(--rod-alpha) * 0.52)) 92%,
            transparent 100%
          );
          box-shadow: 0 0 90px hsl(var(--primary) / calc(var(--rod-alpha) * 0.46));
          animation: login-intro-rod-shoot 0.82s cubic-bezier(0.17, 0.84, 0.38, 1) var(--rod-delay) forwards;
        }

        .login-intro-rod::before,
        .login-intro-rod::after {
          content: '';
          position: absolute;
          left: 8%;
          right: 8%;
          border-radius: 3px;
          pointer-events: none;
        }

        .login-intro-rod::before {
          inset-block-start: 0;
          height: 34%;
          background: rgb(255 255 255 / 0.28);
          filter: blur(1.5px);
        }

        .login-intro-rod::after {
          inset: 0;
          background: linear-gradient(to bottom, rgb(255 255 255 / 0.36), rgb(255 255 255 / 0.08) 42%, transparent 70%);
        }

        .login-intro-dot {
          position: absolute;
          left: 0;
          top: 0;
          width: ${DOT_RADIUS * 2}px;
          height: ${DOT_RADIUS * 2}px;
          border-radius: 999px;
          background: var(--dot-color);
          box-shadow:
            0 0 18px color-mix(in srgb, var(--dot-color), white 18%),
            0 0 36px color-mix(in srgb, var(--dot-color), transparent 30%);
          opacity: 0;
          animation: var(--dot-keyframe) ${INTRO_DURATION_MS}ms ease-in-out forwards;
          z-index: 2;
        }

        .login-intro-wheel {
          position: absolute;
          left: var(--intro-logo-x);
          top: var(--intro-logo-y);
          z-index: 3;
          opacity: 0;
          transform: translate(-50%, -50%) rotate(-1080deg) scale(1);
          filter: drop-shadow(0 0 34px hsl(var(--primary) / 0.38));
          animation: login-intro-wheel-resolve 1.24s cubic-bezier(0.13, 0.88, 0.22, 1) 5.55s forwards;
        }

        .login-intro-skip {
          position: fixed;
          right: max(14px, env(safe-area-inset-right));
          bottom: max(14px, env(safe-area-inset-bottom));
          z-index: 5;
          display: grid;
          place-items: center;
          width: 28px;
          height: 28px;
          border-radius: 999px;
          color: rgb(255 255 255 / 0.72);
          background: rgb(255 255 255 / 0.06);
          border: 1px solid rgb(255 255 255 / 0.12);
          backdrop-filter: blur(8px);
          transition: color 140ms ease, background 140ms ease, transform 140ms ease;
        }

        .login-intro-skip:hover {
          color: white;
          background: rgb(255 255 255 / 0.12);
          transform: translateX(1px);
        }

        @keyframes login-intro-rod-shoot {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) rotateZ(var(--rod-rotation)) translateX(var(--rod-from));
          }
          16%, 72% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) rotateZ(var(--rod-rotation)) translateX(var(--rod-to));
          }
        }

        ${dots.map(dot => dotKeyframes(dot.id, dot.popAtMs)).join('\n')}

        @keyframes login-intro-wheel-resolve {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) rotate(-1080deg) scale(1.08);
          }
          6% {
            opacity: 1;
          }
          78% {
            opacity: 1;
          }
          100% {
            opacity: 1;
            transform: translate(-50%, -50%) rotate(0deg) scale(1);
          }
        }

        @keyframes login-intro-fade-out {
          to {
            opacity: 0;
            visibility: hidden;
          }
        }

        @media (max-width: 640px) {
          .login-intro {
            --intro-logo-y: 104px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .login-intro {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
