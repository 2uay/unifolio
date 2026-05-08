import React, { useRef, useEffect } from 'react';

// Diagonal rainbow paint stripes — same pattern for both "uni" and "folio" hover
const PAINT_GRADIENT = `repeating-linear-gradient(
  109deg,
  hsl(0,   92%, 57%)  0px,
  hsl(0,   92%, 57%)  9px,
  hsl(28,  95%, 56%)  9px,
  hsl(28,  95%, 56%) 20px,
  hsl(54,  95%, 53%) 20px,
  hsl(54,  95%, 53%) 28px,
  hsl(115, 88%, 48%) 28px,
  hsl(115, 88%, 48%) 41px,
  hsl(172, 90%, 47%) 41px,
  hsl(172, 90%, 47%) 49px,
  hsl(212, 92%, 60%) 49px,
  hsl(212, 92%, 60%) 62px,
  hsl(263, 88%, 63%) 62px,
  hsl(263, 88%, 63%) 70px,
  hsl(302, 88%, 57%) 70px,
  hsl(302, 88%, 57%) 82px
)`;

export default function UnifolioLogo({ className = '' }) {
  const logoRef = useRef(null);

  useEffect(() => {
    const el = logoRef.current;
    if (!el) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Hue tilt on horizontal cursor movement
    const move = (e) => {
      const r = el.getBoundingClientRect();
      const deg = (((e.clientX - r.left) / r.width - 0.5) * 40).toFixed(0);
      el.style.setProperty('--logo-hue', `${deg}deg`);
    };
    const logoLeave = () => el.style.setProperty('--logo-hue', '0deg');
    el.addEventListener('mousemove', move);
    el.addEventListener('mouseleave', logoLeave);

    if (reduced) {
      return () => {
        el.removeEventListener('mousemove', move);
        el.removeEventListener('mouseleave', logoLeave);
      };
    }

    // Radial bloom on "folio" hover — starts at cursor entry point
    const folioEl = el.querySelector('.unifolio-folio');
    const blobEl = el.querySelector('.unifolio-blob');
    if (!folioEl || !blobEl) return;

    let raf = null;
    let revealSize = 0;
    let velocity = 0;

    // Spring physics: low stiffness + damping gives the same fluid feel as the wheel
    const STIFFNESS = 0.028;
    const DAMPING   = 0.72;

    const animateTo = (target) => {
      if (raf) cancelAnimationFrame(raf);
      const step = () => {
        velocity = velocity * DAMPING + STIFFNESS * (target - revealSize);
        revealSize += velocity;
        blobEl.style.setProperty('--folio-reveal', `${Math.max(0, revealSize).toFixed(2)}%`);
        if (Math.abs(velocity) > 0.05 || Math.abs(target - revealSize) > 0.1) {
          raf = requestAnimationFrame(step);
        } else {
          revealSize = target;
          velocity = 0;
          blobEl.style.setProperty('--folio-reveal', `${target}%`);
        }
      };
      raf = requestAnimationFrame(step);
    };

    const folioEnter = (e) => {
      const r = folioEl.getBoundingClientRect();
      blobEl.style.setProperty('--folio-ox', `${((e.clientX - r.left) / r.width * 100).toFixed(1)}%`);
      blobEl.style.setProperty('--folio-oy', `${((e.clientY - r.top) / r.height * 100).toFixed(1)}%`);
      revealSize = 0;
      velocity = 0;
      blobEl.style.setProperty('--folio-reveal', '0%');
      animateTo(220);
    };

    const folioLeave = () => animateTo(0);

    folioEl.addEventListener('mouseenter', folioEnter);
    folioEl.addEventListener('mouseleave', folioLeave);

    return () => {
      el.removeEventListener('mousemove', move);
      el.removeEventListener('mouseleave', logoLeave);
      folioEl.removeEventListener('mouseenter', folioEnter);
      folioEl.removeEventListener('mouseleave', folioLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <span ref={logoRef} className={`unifolio-logo ${className}`}>
        <span className="unifolio-base">
          <span className="unifolio-uni" aria-label="uni">uni</span>
          <span className="unifolio-folio">
            folio
            <span className="unifolio-blob" aria-hidden="true">folio</span>
          </span>
        </span>
      </span>

      <style>{`
        .unifolio-logo {
          position: relative;
          display: inline-block;
          filter: hue-rotate(calc(var(--logo-hue-base, 0deg) + var(--logo-hue, 0deg)));
          transition: filter 0.08s linear;
        }

        .unifolio-base { display: inline-block; }

        /* ── "uni" — always-on rainbow cutout ─────────────────────── */
        .unifolio-uni {
          display: inline-block;
          background: ${PAINT_GRADIENT};
          background-size: 280% 280%;
          background-position: 0% 0%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
          animation: uni-paint-drift 7s ease-in-out infinite;
        }

        /* ── "folio" — plain at rest, radial rainbow bloom on hover ── */
        .unifolio-folio {
          position: relative;
          display: inline-block;
        }

        .unifolio-blob {
          position: absolute;
          inset: 0;
          white-space: nowrap;
          pointer-events: none;
          background: ${PAINT_GRADIENT};
          background-size: 280% 280%;
          background-position: 40% 40%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
          animation: uni-paint-drift 7s ease-in-out infinite;
          /* Radial mask driven by JS — expands from cursor entry point */
          -webkit-mask-image: radial-gradient(
            circle at var(--folio-ox, 50%) var(--folio-oy, 50%),
            black 0%,
            black var(--folio-reveal, 0%),
            transparent var(--folio-reveal, 0%)
          );
          mask-image: radial-gradient(
            circle at var(--folio-ox, 50%) var(--folio-oy, 50%),
            black 0%,
            black var(--folio-reveal, 0%),
            transparent var(--folio-reveal, 0%)
          );
        }

        @keyframes uni-paint-drift {
          0%   { background-position:   0%   0%; }
          18%  { background-position:  75%  30%; }
          41%  { background-position:  25%  85%; }
          67%  { background-position:  90%  55%; }
          83%  { background-position:  40%  10%; }
          100% { background-position:   0%   0%; }
        }

        @media (prefers-reduced-motion: reduce) {
          .unifolio-uni { animation: none; background-position: 30% 30%; }
          .unifolio-blob {
            animation: none;
            background-position: 30% 30%;
            -webkit-mask-image: none;
            mask-image: none;
            opacity: 0;
            transition: opacity 0.1s ease;
          }
          .unifolio-folio:hover .unifolio-blob { opacity: 1; }
        }
      `}</style>
    </>
  );
}
