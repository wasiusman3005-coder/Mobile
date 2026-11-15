import React, { useEffect, useRef } from "react";
import * as THREE from "three";

interface QDynamicsBrandLogo3DProps {
  accentHex?: string;
  secondaryHex?: string;
}

export const QDynamicsBrandLogo3D: React.FC<QDynamicsBrandLogo3DProps> = ({
  accentHex = "#00f0ff",
  secondaryHex = "#8b5cf6",
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const accentRef = useRef(new THREE.Color(accentHex));
  const secondaryRef = useRef(new THREE.Color(secondaryHex));

  useEffect(() => {
    accentRef.current.set(accentHex);
  }, [accentHex]);

  useEffect(() => {
    secondaryRef.current.set(secondaryHex);
  }, [secondaryHex]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const w = 68;
    const h = 68;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 30);
    camera.position.z = 4.2;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    } catch {
      return;
    }

    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    // Lighting for 3D emblem depth
    const amb = new THREE.AmbientLight(0xffffff, 0.65);
    const dir = new THREE.DirectionalLight(0xffffff, 1.8);
    dir.position.set(3, 4, 5);
    scene.add(amb, dir);

    // Core Q-Prism
    const coreGeo = new THREE.OctahedronGeometry(0.55, 0);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      emissive: new THREE.Color(accentHex),
      emissiveIntensity: 0.85,
      metalness: 0.9,
      roughness: 0.18,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    group.add(coreMesh);

    // Twin Orthogonal Orbiting Rings
    const ringGeo1 = new THREE.TorusGeometry(0.95, 0.048, 10, 48);
    const ringGeo2 = new THREE.TorusGeometry(1.16, 0.036, 10, 48);
    const ringMat1 = new THREE.MeshStandardMaterial({
      color: new THREE.Color(accentHex),
      emissive: new THREE.Color(accentHex),
      emissiveIntensity: 0.75,
      metalness: 0.85,
      roughness: 0.2,
    });
    const ringMat2 = new THREE.MeshStandardMaterial({
      color: new THREE.Color(secondaryHex),
      emissive: new THREE.Color(secondaryHex),
      emissiveIntensity: 0.65,
      metalness: 0.85,
      roughness: 0.2,
    });
    const ring1 = new THREE.Mesh(ringGeo1, ringMat1);
    const ring2 = new THREE.Mesh(ringGeo2, ringMat2);
    ring2.rotation.x = Math.PI / 2.2;
    group.add(ring1, ring2);

    // Orbiting Electron Photon
    const satGeo = new THREE.SphereGeometry(0.11, 12, 12);
    const satMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const satMesh = new THREE.Mesh(satGeo, satMat);
    group.add(satMesh);

    const clock = new THREE.Clock();
    const liveA = new THREE.Color(accentHex);
    const liveB = new THREE.Color(secondaryHex);
    let rafId = 0;

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.getElapsedTime();

      liveA.lerp(accentRef.current, 1 - Math.exp(-3 * dt));
      liveB.lerp(secondaryRef.current, 1 - Math.exp(-3 * dt));
      coreMat.emissive.copy(liveA);
      ringMat1.color.copy(liveA);
      ringMat1.emissive.copy(liveA);
      ringMat2.color.copy(liveB);
      ringMat2.emissive.copy(liveB);

      // Cycle across 4 distinct 3D movement styles every 5 seconds
      const styleIdx = Math.floor(t / 5) % 4;
      if (styleIdx === 0) {
        // Style 1: Orbital Precession
        group.position.set(0, Math.sin(t * 2.2) * 0.1, 0);
        group.rotation.set(Math.sin(t * 1.4) * 0.4, t * 1.2, 0);
      } else if (styleIdx === 1) {
        // Style 2: Figure-8 Lissajous Warp
        group.position.set(Math.sin(t * 2.0) * 0.14, Math.sin(t * 4.0) * 0.08, 0);
        group.rotation.set(Math.cos(t * 2.0) * 0.55, t * 1.6, Math.sin(t * 2.0) * 0.35);
      } else if (styleIdx === 2) {
        // Style 3: Quantum Flip Inversion
        group.position.set(0, 0, Math.sin(t * 2.6) * 0.12);
        group.rotation.set(t * 1.5, t * 1.9, Math.sin(t * 1.2) * 0.4);
      } else {
        // Style 4: Harmonic Pendulum Drift
        group.position.set(Math.cos(t * 1.8) * 0.1, Math.sin(t * 1.8) * 0.1, 0);
        group.rotation.set(0.35 * Math.sin(t * 2.4), t * 0.9, 0.35 * Math.cos(t * 2.4));
      }

      coreMesh.rotation.y -= dt * 2.2;
      ring1.rotation.x += dt * 1.8;
      ring1.rotation.y += dt * 1.1;
      ring2.rotation.y -= dt * 2.1;
      ring2.rotation.z += dt * 1.4;

      satMesh.position.set(
        Math.cos(t * 3.8) * 1.12,
        Math.sin(t * 2.9) * 0.45,
        Math.sin(t * 3.8) * 1.12
      );

      renderer.render(scene, camera);
    };

    const canvas = renderer.domElement;
    const onLost = (e: Event) => {
      e.preventDefault();
    };
    canvas.addEventListener("webglcontextlost", onLost);

    animate();

    return () => {
      cancelAnimationFrame(rafId);
      canvas.removeEventListener("webglcontextlost", onLost);
      renderer.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      ringGeo1.dispose();
      ringGeo2.dispose();
      ringMat1.dispose();
      ringMat2.dispose();
      satGeo.dispose();
      satMat.dispose();
      if (container.contains(canvas)) {
        container.removeChild(canvas);
      }
    };
  }, []);

  return (
    <div className="pointer-events-none select-none flex items-center gap-1.5">
      <div ref={mountRef} className="w-[60px] h-[60px] sm:w-[68px] sm:h-[68px] shrink-0" />
      <div className="flex flex-col leading-none">
        <span
          className="font-orbitron font-extrabold text-xs sm:text-sm tracking-[0.22em] text-slate-100"
          style={{ textShadow: `0 0 14px ${accentHex}75` }}
        >
          Q-<span style={{ color: accentHex }}>DYNAMICS</span>
        </span>
      </div>
    </div>
  );
};
