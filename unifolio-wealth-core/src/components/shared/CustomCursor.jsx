import React, { useEffect, useRef, useState } from 'react';
import UnifolioWheelLogo from '@/components/shared/UnifolioWheelLogo';

const SIZE = 12;
const HALF = SIZE / 2;
const CURSOR_PREF_KEY = 'unifolio_custom_cursor_enabled';

function readCursorPref() {
  if (typeof window === 'undefined') return true;
  const v = localStorage.getItem(CURSOR_PREF_KEY);
  return v === null ? true : v === 'true';
}

export default function CustomCursor() {
  const cursorRef = useRef(null);
  const [enabled, setEnabled] = useState(readCursorPref);

  useEffect(() => {
    const onPrefChange = () => setEnabled(readCursorPref());
    window.addEventListener('unifolio:cursor-pref-changed', onPrefChange);
    window.addEventListener('storage', (e) => { if (e.key === CURSOR_PREF_KEY) onPrefChange(); });
    return () => window.removeEventListener('unifolio:cursor-pref-changed', onPrefChange);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;

    const cursor = cursorRef.current;
    if (!cursor) return;

    const state = {
      px: -200, py: -200,
      mx: -200, my: -200,
      active: false,
      raf: null,
    };

    const tick = () => {
      state.px += (state.mx - state.px) * 0.22;
      state.py += (state.my - state.py) * 0.22;
      cursor.style.transform = `translate3d(${(state.px - HALF).toFixed(1)}px, ${(state.py - HALF).toFixed(1)}px, 0)`;
      state.raf = requestAnimationFrame(tick);
    };
    state.raf = requestAnimationFrame(tick);

    const onMove = (e) => {
      state.mx = e.clientX;
      state.my = e.clientY;

      if (!state.active) {
        state.active = true;
        document.documentElement.classList.add('custom-cursor-active');
        cursor.style.opacity = '1';
      }

      const el = document.elementFromPoint(e.clientX, e.clientY);
      const isPointer = el && (
        el.closest('button, a, [role="button"], input, select, textarea, label, [tabindex]') !== null ||
        window.getComputedStyle(el).cursor === 'pointer'
      );
      cursor.dataset.pointer = isPointer ? '1' : '0';
    };

    let clickTimer = null;
    const onDown = () => {
      cursor.dataset.clicking = '1';
      if (clickTimer) clearTimeout(clickTimer);
      clickTimer = setTimeout(() => {
        cursor.dataset.clicking = '0';
        clickTimer = null;
      }, 160);
    };

    const onLeave = () => {
      cursor.style.opacity = '0';
      state.active = false;
    };

    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('blur', onLeave);

    return () => {
      if (state.raf) cancelAnimationFrame(state.raf);
      if (clickTimer) clearTimeout(clickTimer);
      document.documentElement.classList.remove('custom-cursor-active');
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('blur', onLeave);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      ref={cursorRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 99999,
        pointerEvents: 'none',
        willChange: 'transform',
        opacity: 0,
        transform: 'translate(-200px, -200px)',
      }}
      className="unifolio-custom-cursor"
    >
      <UnifolioWheelLogo size={SIZE} className="unifolio-cursor-wheel" />
    </div>
  );
}
