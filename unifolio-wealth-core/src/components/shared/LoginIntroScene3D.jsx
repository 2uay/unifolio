import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

const SPHERE_COUNT = 28;

function colorAt(colors, index, fallback = '#38bdf8') {
  return colors?.[index % colors.length] || fallback;
}

function normalizeColor(value, fallback = '#38bdf8') {
  const raw = String(value || fallback).trim();
  const spaceSeparatedHsl = raw.match(/^hsl\(\s*([0-9.]+)\s+([0-9.]+%)\s+([0-9.]+%)\s*\)$/i);
  if (spaceSeparatedHsl) return `hsl(${spaceSeparatedHsl[1]}, ${spaceSeparatedHsl[2]}, ${spaceSeparatedHsl[3]})`;
  return raw;
}

function setColor(color, value, fallback = '#38bdf8') {
  try {
    color.setStyle(normalizeColor(value, fallback));
  } catch {
    color.setStyle(fallback);
  }
}

function createColor(value, fallback = '#38bdf8') {
  const color = new THREE.Color();
  setColor(color, value, fallback);
  return color;
}

export default function LoginIntroScene3D({ colors = [] }) {
  const hostRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !hostRef.current) return undefined;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) return undefined;

    const host = hostRef.current;
    const scene = new THREE.Scene();
    const primary = new THREE.Color();
    const accent = new THREE.Color();
    const water = new THREE.Color();
    setColor(primary, colorAt(colors, 0));
    setColor(accent, colorAt(colors, 3));
    setColor(water, colorAt(colors, 6, colorAt(colors, 1)));

    scene.background = new THREE.Color(0x03040a);
    scene.fog = new THREE.FogExp2(0x03040a, 0.032);

    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 120);
    camera.position.set(0.2, 2.4, 9.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x03040a, 1);
    renderer.domElement.className = 'login-intro-3d-canvas';
    host.appendChild(renderer.domElement);

    const ambient = new THREE.HemisphereLight(0xffffff, 0x0b1020, 1.1);
    scene.add(ambient);

    const sunLight = new THREE.DirectionalLight(0xffffff, 1.9);
    sunLight.position.set(-3, 8, 6);
    scene.add(sunLight);

    const world = new THREE.Group();
    scene.add(world);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(28, 20, 1, 1),
      new THREE.MeshStandardMaterial({
        color: 0xf5f7fb,
        roughness: 0.82,
        metalness: 0.02,
      })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -1.04, -1.6);
    world.add(ground);

    const pool = new THREE.Mesh(
      new THREE.CircleGeometry(4.8, 96),
      new THREE.MeshPhysicalMaterial({
        color: water,
        roughness: 0.16,
        metalness: 0.02,
        transparent: true,
        opacity: 0.58,
        transmission: 0.18,
      })
    );
    pool.rotation.x = -Math.PI / 2;
    pool.scale.set(1.65, 0.68, 1);
    pool.position.set(-2.3, -0.99, -0.9);
    world.add(pool);

    const poolRim = new THREE.Mesh(
      new THREE.TorusGeometry(4.8, 0.045, 8, 128),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72 })
    );
    poolRim.rotation.x = Math.PI / 2;
    poolRim.scale.set(1.65, 0.68, 1);
    poolRim.position.copy(pool.position);
    poolRim.position.y += 0.02;
    world.add(poolRim);

    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(1.18, 48, 32),
      new THREE.MeshBasicMaterial({ color: accent })
    );
    sun.position.set(-3.8, 2.35, -8.4);
    world.add(sun);

    const sunBands = new THREE.Group();
    Array.from({ length: 8 }, (_, i) => {
      const band = new THREE.Mesh(
        new THREE.BoxGeometry(2.65, 0.04, 0.018),
        new THREE.MeshBasicMaterial({ color: 0x03040a, transparent: true, opacity: 0.74 })
      );
      band.position.set(-3.8, 1.68 + i * 0.13, -7.18);
      sunBands.add(band);
      return band;
    });
    world.add(sunBands);

    const palmMaterial = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.8 });
    const frondMaterial = new THREE.MeshStandardMaterial({ color: primary, roughness: 0.65, transparent: true, opacity: 0.82 });
    [
      [2.9, -0.18, -5.1, 2.6],
      [4.6, -0.12, -4.2, 2.1],
      [5.8, -0.08, -6.0, 2.9],
    ].forEach(([x, y, z, height], palmIndex) => {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.06, height, 8), palmMaterial);
      trunk.position.set(x, y + height / 2 - 0.98, z);
      trunk.rotation.z = 0.08 + palmIndex * 0.04;
      world.add(trunk);

      const crown = new THREE.Group();
      crown.position.set(x, y + height - 0.82, z);
      Array.from({ length: 7 }, (_, i) => {
        const frond = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.95, 5), frondMaterial);
        frond.rotation.z = (i / 7) * Math.PI * 2;
        frond.rotation.x = Math.PI / 2.7;
        frond.position.set(Math.cos(frond.rotation.z) * 0.26, 0, Math.sin(frond.rotation.z) * 0.26);
        crown.add(frond);
        return frond;
      });
      world.add(crown);
    });

    const chairMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.66 });
    const chairAccentMaterial = new THREE.MeshStandardMaterial({ color: createColor(colorAt(colors, 5, colorAt(colors, 2))), roughness: 0.7 });
    [
      [3.3, -0.82, -1.0, -0.18],
      [4.55, -0.82, -1.35, -0.08],
      [-5.0, -0.84, -2.4, 0.08],
    ].forEach(([x, y, z, rotation]) => {
      const chair = new THREE.Group();
      chair.position.set(x, y, z);
      chair.rotation.y = rotation;
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.055, 0.38), chairMaterial);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.055, 0.44), chairMaterial);
      back.position.set(0, 0.24, -0.28);
      back.rotation.x = -0.55;
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.065, 0.08), chairAccentMaterial);
      stripe.position.set(0, 0.03, 0.02);
      chair.add(base, back, stripe);
      world.add(chair);
    });

    const sphereGeometry = new THREE.SphereGeometry(0.105, 18, 14);
    const spheres = Array.from({ length: SPHERE_COUNT }, (_, i) => {
      const material = new THREE.MeshStandardMaterial({
        color: createColor(colorAt(colors, i)),
        roughness: 0.28,
        metalness: 0.12,
        emissive: createColor(colorAt(colors, i)),
        emissiveIntensity: 0.18,
      });
      const sphere = new THREE.Mesh(sphereGeometry, material);
      const lane = (i % 7) - 3;
      sphere.userData = {
        start: 0.15 + ((i * 0.137) % 2.35),
        baseX: lane * 0.92 + Math.sin(i * 1.9) * 0.25,
        baseZ: -4.2 + (i % 4) * 1.15,
        height: 0.55 + ((i * 0.23) % 1.05),
        phase: i * 0.73,
      };
      sphere.scale.setScalar(0.001);
      world.add(sphere);
      return sphere;
    });

    const clock = new THREE.Clock();
    let frame = null;

    const resize = () => {
      const { clientWidth, clientHeight } = host;
      renderer.setSize(clientWidth || window.innerWidth, clientHeight || window.innerHeight, false);
      camera.aspect = (clientWidth || window.innerWidth) / (clientHeight || window.innerHeight);
      camera.updateProjectionMatrix();
    };

    const animate = () => {
      const t = clock.getElapsedTime();
      camera.position.x = Math.sin(t * 0.48) * 1.2;
      camera.position.y = 2.15 + Math.sin(t * 0.32) * 0.22;
      camera.position.z = 8.4 + Math.cos(t * 0.35) * 0.42;
      camera.lookAt(Math.sin(t * 0.25) * 0.55, 0.1, -3.4);

      world.rotation.y = Math.sin(t * 0.18) * 0.055;
      pool.material.opacity = 0.5 + Math.sin(t * 1.8) * 0.06;
      pool.rotation.z = Math.sin(t * 0.35) * 0.02;

      spheres.forEach((sphere, i) => {
        const local = Math.max(0, Math.min(1, (t - sphere.userData.start) / 0.34));
        const ease = 1 - Math.pow(1 - local, 3);
        sphere.scale.setScalar(ease);
        sphere.position.set(
          sphere.userData.baseX + Math.sin(t * 1.8 + sphere.userData.phase) * 0.08,
          -0.78 + ease * sphere.userData.height + Math.sin(t * 2.2 + i) * 0.035,
          sphere.userData.baseZ + Math.cos(t * 1.1 + sphere.userData.phase) * 0.08
        );
      });

      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(animate);
    };

    resize();
    window.addEventListener('resize', resize);
    frame = window.requestAnimationFrame(animate);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      host.removeChild(renderer.domElement);
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
    };
  }, [colors]);

  return <div ref={hostRef} className="login-intro-3d" aria-hidden="true" />;
}
