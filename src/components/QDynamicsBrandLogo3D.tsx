import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

interface QDynamicsBrandLogo3DProps {
  accentHex?: string;
  secondaryHex?: string;
  brandTitle?: string;
  brandSubtitle?: string;
  logoStyle?: "reactor" | "tesseract" | "crystal" | "singularity";
}

export const QDynamicsBrandLogo3D: React.FC<QDynamicsBrandLogo3DProps> = ({
  accentHex = "#00f0ff",
  secondaryHex = "#8b5cf6",
  brandTitle = "WASU'S JARVIS",
  brandSubtitle = "MOBILE QUANTUM OS",
  logoStyle = "reactor",
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

    const w = 74;
    const h = 74;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 30);
    camera.position.z = 4.3;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    } catch {
      return;
    }

    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envRT = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envRT.texture;

    const group = new THREE.Group();
    scene.add(group);

    // Studio Lighting for Jewel & Ring Depth
    const amb = new THREE.AmbientLight(0xffffff, 0.5);
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(3, 4, 5);
    const rimLight = new THREE.PointLight(new THREE.Color(accentHex), 3.5, 12);
    rimLight.position.set(-2.5, -2, 3);
    scene.add(amb, keyLight, rimLight);

    // Core Geometry Switchable by logoStyle
    const coreGeo: THREE.BufferGeometry =
      logoStyle === "tesseract"
        ? new THREE.BoxGeometry(0.76, 0.76, 0.76)
        : logoStyle === "crystal"
        ? new THREE.OctahedronGeometry(0.66, 0)
        : logoStyle === "singularity"
        ? new THREE.TorusKnotGeometry(0.42, 0.13, 64, 12)
        : new THREE.IcosahedronGeometry(0.56, 0);

    const coreMat = new THREE.MeshPhysicalMaterial({
      color: 0x0b162c,
      emissive: new THREE.Color(accentHex),
      emissiveIntensity: 0.65,
      metalness: 0.75,
      roughness: 0.12,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      ior: 1.65,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    group.add(coreMesh);

    const innerWireGeo =
      logoStyle === "tesseract"
        ? new THREE.BoxGeometry(1.06, 1.06, 1.06)
        : new THREE.IcosahedronGeometry(0.78, 0);
    const innerWireMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(secondaryHex),
      wireframe: true,
      transparent: true,
      opacity: 0.55,
    });
    const innerWire = new THREE.Mesh(innerWireGeo, innerWireMat);
    group.add(innerWire);

    // Triple Precision Gyroscope Rings
    const ringGeo1 = new THREE.TorusGeometry(1.02, 0.052, 16, 64);
    const ringGeo2 = new THREE.TorusGeometry(1.24, 0.038, 16, 64);
    const ringGeo3 = new THREE.TorusGeometry(1.42, 0.025, 14, 64);
    const ringMat1 = new THREE.MeshStandardMaterial({
      color: new THREE.Color(accentHex),
      emissive: new THREE.Color(accentHex),
      emissiveIntensity: 0.85,
      metalness: 0.9,
      roughness: 0.14,
    });
    const ringMat2 = new THREE.MeshStandardMaterial({
      color: new THREE.Color(secondaryHex),
      emissive: new THREE.Color(secondaryHex),
      emissiveIntensity: 0.75,
      metalness: 0.9,
      roughness: 0.14,
    });
    const ringMat3 = new THREE.MeshBasicMaterial({
      color: 0xe2e8f0,
      transparent: true,
      opacity: 0.5,
    });
    const ring1 = new THREE.Mesh(ringGeo1, ringMat1);
    const ring2 = new THREE.Mesh(ringGeo2, ringMat2);
    const ring3 = new THREE.Mesh(ringGeo3, ringMat3);
    ring2.rotation.x = Math.PI / 2.2;
    ring3.rotation.y = Math.PI / 3;
    group.add(ring1, ring2, ring3);

    // Twin Orbiting Satellites
    const satGeo = new THREE.SphereGeometry(0.095, 14, 14);
    const satMatA = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const satMatB = new THREE.MeshBasicMaterial({ color: new THREE.Color(accentHex) });
    const satA = new THREE.Mesh(satGeo, satMatA);
    const satB = new THREE.Mesh(satGeo, satMatB);
    group.add(satA, satB);

    const timer = new THREE.Timer();
    timer.connect(document);
    const liveA = new THREE.Color(accentHex);
    const liveB = new THREE.Color(secondaryHex);
    let rafId = 0;

    const animate = (timestamp?: number) => {
      rafId = requestAnimationFrame(animate);
      timer.update(timestamp);
      const dt = Math.min(timer.getDelta(), 0.05);
      const t = timer.getElapsed();

      liveA.lerp(accentRef.current, 1 - Math.exp(-3.2 * dt));
      liveB.lerp(secondaryRef.current, 1 - Math.exp(-3.2 * dt));
      coreMat.emissive.copy(liveA);
      innerWireMat.color.copy(liveB);
      rimLight.color.copy(liveA);
      ringMat1.color.copy(liveA);
      ringMat1.emissive.copy(liveA);
      ringMat2.color.copy(liveB);
      ringMat2.emissive.copy(liveB);
      satMatB.color.copy(liveA);

      group.position.set(0, Math.sin(t * 2.1) * 0.07, 0);
      group.rotation.set(Math.sin(t * 1.1) * 0.28, t * 0.85, Math.cos(t * 0.9) * 0.16);

      coreMesh.rotation.y -= dt * 2.1;
      coreMesh.rotation.x += dt * 0.7;
      innerWire.rotation.y += dt * 1.3;
      innerWire.rotation.z -= dt * 0.9;

      ring1.rotation.x += dt * 1.9;
      ring1.rotation.y += dt * 1.2;
      ring2.rotation.y -= dt * 2.2;
      ring2.rotation.z += dt * 1.4;
      ring3.rotation.z -= dt * 1.1;

      satA.position.set(Math.cos(t * 3.8) * 1.24, Math.sin(t * 2.9) * 0.48, Math.sin(t * 3.8) * 1.24);
      satB.position.set(Math.cos(-t * 3.2 + 2) * 1.38, Math.cos(t * 2.5) * 0.55, Math.sin(-t * 3.2 + 2) * 1.38);

      renderer.render(scene, camera);
    };

    const canvas = renderer.domElement;
    const onLost = (e: Event) => {
      e.preventDefault();
    };
    canvas.addEventListener("webglcontextlost", onLost);

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      canvas.removeEventListener("webglcontextlost", onLost);
      timer.disconnect();
      timer.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      innerWireGeo.dispose();
      innerWireMat.dispose();
      ringGeo1.dispose();
      ringGeo2.dispose();
      ringGeo3.dispose();
      ringMat1.dispose();
      ringMat2.dispose();
      ringMat3.dispose();
      satGeo.dispose();
      satMatA.dispose();
      satMatB.dispose();
      envRT.dispose();
      roomEnv.dispose();
      pmrem.dispose();
      renderer.dispose();
      if (container.contains(canvas)) {
        container.removeChild(canvas);
      }
    };
  }, [logoStyle]);

  const words = (brandTitle || "WASU'S JARVIS").trim().split(/\s+/);
  const firstWord = words[0] || "WASU'S";
  const restWords = words.slice(1).join(" ") || "JARVIS";

  return (
    <div className="pointer-events-none select-none flex items-center gap-2">
      <div ref={mountRef} className="w-[58px] h-[58px] sm:w-[70px] sm:h-[70px] shrink-0" />
      <div className="flex flex-col leading-tight">
        <span
          className="font-orbitron font-black text-xs sm:text-sm tracking-[0.16em] text-white"
          style={{ textShadow: `0 0 16px ${accentHex}85` }}
        >
          {firstWord}{" "}
          <span
            style={{
              backgroundImage: `linear-gradient(90deg, ${accentHex}, ${secondaryHex})`,
              WebkitBackgroundClip: "text",
              color: "transparent",
            }}
          >
            {restWords}
          </span>
        </span>
        <span className="font-mono text-[9px] tracking-[0.2em] text-slate-300/85 uppercase">
          {brandSubtitle}
        </span>
      </div>
    </div>
  );
};
