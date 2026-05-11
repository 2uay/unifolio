import React, { useEffect, useRef } from 'react';

const N_LINES = 36;
const BASE_CURSOR_R = 500;
const STEP = 3;
const MOUSE_REPEL_R = 260;
const MOUSE_REPEL_MAX = 110;

export default function LoginIridescentBackground({ lineColors = [] }) {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const animRef = useRef(null);
  const ripplesRef = useRef([]);
  const offscreenRef = useRef(null);
  const lineColorsRef = useRef(lineColors);

  useEffect(() => { lineColorsRef.current = lineColors; }, [lineColors]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof window === 'undefined') return;
    const ctx = canvas.getContext('2d');

    const offscreen = document.createElement('canvas');
    const offCtx = offscreen.getContext('2d');
    offscreenRef.current = offscreen;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      offscreen.width = window.innerWidth;
      offscreen.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const onMouse = (e) => { mouseRef.current = { x: e.clientX, y: e.clientY }; };
    const onTouch = (e) => {
      if (e.touches[0]) mouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };
    const onClick = (e) => {
      ripplesRef.current.push({
        cx: e.clientX, cy: e.clientY,
        t0: performance.now() / 1000,
        lifetime: 2.6, speed: 400, maxDeflect: 160,
      });
      if (ripplesRef.current.length > 6) ripplesRef.current.shift();
    };

    window.addEventListener('mousemove', onMouse);
    window.addEventListener('touchmove', onTouch, { passive: true });
    window.addEventListener('click', onClick);

    const startTime = performance.now();

    const lineParams = Array.from({ length: N_LINES }, (_, li) => ({
      ph:      (li / N_LINES) * Math.PI * 5.1,
      ampBase: 18 + 24 * Math.abs(Math.sin(li * 0.73)),
      f1: 0.006  + 0.0018 * Math.sin(li * 1.3),
      f2: 0.013  + 0.003  * Math.cos(li * 0.9),
      f3: 0.026  + 0.005  * Math.sin(li * 0.5),
      s1: 0.36   + 0.07   * Math.sin(li * 0.4),
      s2: -0.23  + 0.05   * Math.cos(li * 0.7),
      s3: 0.56   + 0.11   * Math.sin(li * 1.1),
    }));

    function deflection(x, waveY, mx, my, ripples, t) {
      let dy = 0;

      if (mx > -1000) {
        const dm = Math.hypot(x - mx, waveY - my);
        if (dm < MOUSE_REPEL_R && dm > 0.5) {
          const inf = (1 - dm / MOUSE_REPEL_R) ** 2;
          dy += ((waveY - my) / dm) * MOUSE_REPEL_MAX * inf;
          // Also add a horizontal nudge for more lively feel
          dy += ((waveY - my) / dm) * MOUSE_REPEL_MAX * 0.25 * inf * Math.sin(t * 2.1 + dm * 0.01);
        }
      }

      for (const rip of ripples) {
        const age = t - rip.t0;
        if (age < 0 || age > rip.lifetime) continue;
        const ringR = rip.speed * age;
        const distPt = Math.hypot(x - rip.cx, waveY - rip.cy);
        const distFromRing = Math.abs(distPt - ringR);
        const ringWidth = 90 + ringR * 0.06;
        if (distFromRing < ringWidth && distPt > 0.5) {
          const inf = (1 - distFromRing / ringWidth) ** 1.5;
          const decay = (1 - age / rip.lifetime) ** 1.5;
          dy += ((waveY - rip.cy) / distPt) * rip.maxDeflect * inf * decay;
        }
      }

      return dy;
    }

    function buildIriGrad(offCtx, t, W) {
      const colors = lineColorsRef.current;
      if (colors && colors.length >= 3) {
        // Smoothly oscillate the gradient window using sine — no discrete jumps
        // phase goes 0→1→0 over ~21s, shifting the visible colour region
        const phase = (Math.sin(t * 0.30) + 1) / 2;
        // Lay out 2 cycles of theme colours so we can slide the window
        const n = colors.length;
        const totalStops = n * 2 + 1;
        const gStart = -W * phase;
        const gEnd   =  W * (2 - phase);
        const iriGrad = offCtx.createLinearGradient(gStart, 0, gEnd, 0);
        for (let s = 0; s < totalStops; s++) {
          iriGrad.addColorStop(s / (totalStops - 1), colors[s % n]);
        }
        return iriGrad;
      }
      // Rainbow fallback — smooth continuous hue rotation
      const hueShift = t * 26;
      const iriGrad = offCtx.createLinearGradient(0, 0, W, 0);
      for (let s = 0; s <= 8; s++) {
        iriGrad.addColorStop(s / 8, `hsl(${(hueShift + s * 45) % 360}, 90%, 64%)`);
      }
      return iriGrad;
    }

    function drawLines(tCtx, t, W, H, mx, my, ripples, strokeFn) {
      for (let li = 0; li < N_LINES; li++) {
        const { ph, ampBase, f1, f2, f3, s1, s2, s3 } = lineParams[li];
        const baseLineY = H * 0.03 + (li / (N_LINES - 1)) * H * 0.94;
        const breathe = 1 + 0.2 * Math.sin(t * 0.16 + ph * 0.38);
        const amp = ampBase * breathe;

        tCtx.beginPath();
        let first = true;
        for (let x = 0; x <= W; x += STEP) {
          const wY = baseLineY
            + amp * Math.sin(x * f1 + t * s1 + ph)
            + amp * 0.4  * Math.sin(x * f2 + t * s2 + ph * 1.4)
            + amp * 0.18 * Math.sin(x * f3 + t * s3 + ph * 0.6);
          const y = wY + deflection(x, wY, mx, my, ripples, t);
          if (first) { tCtx.moveTo(x, y); first = false; }
          else tCtx.lineTo(x, y);
        }
        strokeFn(tCtx, li);
        tCtx.stroke();
      }
    }

    function frame(now) {
      const t = (now - startTime) / 1000;
      const W = canvas.width;
      const H = canvas.height;
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const hasCursor = mx > -1000;

      const ripples = ripplesRef.current.filter(r => t - r.t0 < r.lifetime);
      ripplesRef.current = ripples;

      ctx.fillStyle = '#060609';
      ctx.fillRect(0, 0, W, H);

      drawLines(ctx, t, W, H, mx, my, ripples, (c) => {
        c.strokeStyle = 'rgba(22, 22, 32, 0.95)';
        c.lineWidth = 0.9;
      });

      if (hasCursor) {
        offCtx.clearRect(0, 0, W, H);

        const iriGrad = buildIriGrad(offCtx, t, W);

        drawLines(offCtx, t, W, H, mx, my, ripples, (c) => {
          c.strokeStyle = iriGrad;
          c.lineWidth = 2.2;
        });

        // Wobbly soft mask — 7 sine harmonics for intense undulation
        offCtx.globalCompositeOperation = 'destination-in';
        const N_VERT = 96;
        offCtx.beginPath();
        for (let i = 0; i <= N_VERT; i++) {
          const a = (i / N_VERT) * Math.PI * 2;
          const wobble =
            58 * Math.sin(a * 2  + t * 1.7)  +
            42 * Math.sin(a * 3  - t * 2.3)  +
            30 * Math.sin(a * 4  + t * 3.1)  +
            20 * Math.sin(a * 5  - t * 1.4)  +
            14 * Math.sin(a * 7  + t * 2.7)  +
             9 * Math.cos(a * 9  - t * 3.8)  +
             5 * Math.sin(a * 11 + t * 1.1);
          const r = BASE_CURSOR_R + wobble;
          const x = mx + r * Math.cos(a);
          const y = my + r * Math.sin(a);
          if (i === 0) offCtx.moveTo(x, y);
          else offCtx.lineTo(x, y);
        }
        offCtx.closePath();

        const edgeGrad = offCtx.createRadialGradient(mx, my, 0, mx, my, BASE_CURSOR_R * 1.35);
        edgeGrad.addColorStop(0,    'rgba(0,0,0,1)');
        edgeGrad.addColorStop(0.68, 'rgba(0,0,0,1)');
        edgeGrad.addColorStop(1,    'rgba(0,0,0,0)');
        offCtx.fillStyle = edgeGrad;
        offCtx.fill();
        offCtx.globalCompositeOperation = 'source-over';

        ctx.drawImage(offscreen, 0, 0);

        const glow = ctx.createRadialGradient(mx, my, 0, mx, my, BASE_CURSOR_R * 0.55);
        glow.addColorStop(0, 'rgba(90,55,190,0.11)');
        glow.addColorStop(0.6, 'rgba(40,20,110,0.05)');
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, H);
      }

      animRef.current = requestAnimationFrame(frame);
    }

    animRef.current = requestAnimationFrame(frame);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('touchmove', onTouch);
      window.removeEventListener('click', onClick);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
        display: 'block',
      }}
    />
  );
}
