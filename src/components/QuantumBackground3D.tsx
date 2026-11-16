import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

interface QuantumBackground3DProps {
  intensity?: number;
  customAccentHex?: string;
  customSecondaryHex?: string;
  energySurge?: boolean;
  show3D?: boolean;
  customBgUrl?: string;
}

function createGlowSpriteTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0.0, "rgba(255, 255, 255, 1.0)");
  grad.addColorStop(0.2, "rgba(186, 230, 253, 0.82)");
  grad.addColorStop(0.5, "rgba(56, 189, 248, 0.24)");
  grad.addColorStop(1.0, "rgba(0, 0, 0, 0.0)");

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function drawPanoramicLedScreen(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  phase: number,
  accentHex: string,
  secondaryHex: string
) {
  ctx.clearRect(0, 0, w, h);

  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#020b1c");
  bg.addColorStop(0.5, "#041229");
  bg.addColorStop(1, "#020714");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Clean subtle tech grid (zero formulas!)
  ctx.strokeStyle = "rgba(56, 189, 248, 0.09)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= w; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y <= h; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Outer LED bezel glow
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 3;
  ctx.strokeRect(10, 10, w - 20, h - 20);

  // Header bar
  ctx.fillStyle = "rgba(0, 240, 255, 0.14)";
  ctx.fillRect(18, 18, w - 36, 46);
  ctx.font = "700 22px 'Orbitron', sans-serif";
  ctx.fillStyle = "#e0f2fe";
  ctx.fillText("WASU'S JARVIS • MOBILE OS TELEMETRY", 36, 49);

  // Left Panel: Live Radar Sweep Circle
  const rx = 185;
  const ry = 255;
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 2;
  [120, 82, 44].forEach((r) => {
    ctx.beginPath();
    ctx.arc(rx, ry, r, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.save();
  ctx.translate(rx, ry);
  ctx.rotate(phase * 1.3);
  const sweepGrad = ctx.createLinearGradient(0, 0, 120, 0);
  sweepGrad.addColorStop(0, "rgba(0,240,255,0.45)");
  sweepGrad.addColorStop(1, "rgba(0,240,255,0.0)");
  ctx.fillStyle = sweepGrad;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, 118, -0.32, 0.32);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Center Panel: Network Matrix Arc & Bars
  ctx.strokeStyle = secondaryHex;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(350, 96, 330, 340);
  ctx.font = "600 16px 'JetBrains Mono', monospace";
  ctx.fillStyle = "#cbd5e1";
  ctx.fillText("ACTIVE HUB NODES", 374, 132);
  ctx.fillText("VOICE // URDU NEURAL LINK", 374, 162);
  ctx.fillText("STUDY / BUSINESS / MOBILE", 374, 192);

  for (let i = 0; i < 16; i++) {
    const bh = 28 + Math.round((Math.sin(phase * 3 + i * 0.65) * 0.5 + 0.5) * 145);
    ctx.fillStyle = i % 2 === 0 ? accentHex : secondaryHex;
    ctx.fillRect(374 + i * 18, 405 - bh, 11, bh);
  }

  // Right Panel: Dual System Load Gauges
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 2;
  ctx.strokeRect(710, 96, 278, 340);
  const metrics = [
    { label: "STUDY VAULTS & LABS", pct: 0.86 },
    { label: "FINANCE GUARD", pct: 0.74 },
    { label: "BUSINESS TELEMETRY", pct: 0.91 },
    { label: "MOBILE BRIDGE LINK", pct: 0.96 },
  ];
  metrics.forEach((m, idx) => {
    const my = 148 + idx * 70;
    ctx.font = "600 14px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(m.label, 730, my);
    ctx.fillStyle = "rgba(15, 23, 42, 0.95)";
    ctx.fillRect(730, my + 10, 236, 14);
    const waveOffset = Math.sin(phase * 1.8 + idx) * 0.04;
    ctx.fillStyle = idx % 2 === 0 ? accentHex : secondaryHex;
    ctx.fillRect(730, my + 10, Math.round(236 * Math.min(1, m.pct + waveOffset)), 14);
  });
}

function drawSideHologramScreen(
  ctx: CanvasRenderingContext2D,
  title: string,
  accentHex: string,
  phase: number
) {
  ctx.clearRect(0, 0, 512, 320);
  ctx.fillStyle = "rgba(4, 12, 28, 0.92)";
  ctx.fillRect(0, 0, 512, 320);
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 3;
  ctx.strokeRect(6, 6, 500, 308);
  ctx.font = "700 20px 'Orbitron', sans-serif";
  ctx.fillStyle = "#f1f5f9";
  ctx.fillText(title, 24, 42);

  for (let row = 0; row < 5; row++) {
    const y = 78 + row * 44;
    ctx.fillStyle = "rgba(30, 41, 59, 0.85)";
    ctx.fillRect(24, y, 464, 24);
    const fillW = 180 + Math.round((Math.sin(phase * 2.1 + row) * 0.5 + 0.5) * 260);
    ctx.fillStyle = accentHex;
    ctx.fillRect(24, y, fillW, 24);
  }
}

function buildExecutiveChair(accentMat: THREE.Material, seatMat: THREE.Material, metalMat: THREE.Material): THREE.Group {
  const chair = new THREE.Group();

  // Star base & pneumatic piston
  const baseGeo = new THREE.CylinderGeometry(0.95, 1.15, 0.14, 5);
  const base = new THREE.Mesh(baseGeo, metalMat);
  base.position.y = 0.08;
  chair.add(base);

  const pistonGeo = new THREE.CylinderGeometry(0.14, 0.16, 0.9, 10);
  const piston = new THREE.Mesh(pistonGeo, metalMat);
  piston.position.y = 0.56;
  chair.add(piston);

  // Seat cushion + trim
  const seatGeo = new THREE.BoxGeometry(1.55, 0.24, 1.45);
  const seat = new THREE.Mesh(seatGeo, seatMat);
  seat.position.y = 1.05;
  chair.add(seat);

  // Contoured high backrest + glowing cyan/amber strip
  const backGeo = new THREE.BoxGeometry(1.38, 2.35, 0.24);
  const back = new THREE.Mesh(backGeo, seatMat);
  back.position.set(0, 2.22, -0.62);
  back.rotation.x = -0.08;
  chair.add(back);

  const trimGeo = new THREE.BoxGeometry(1.44, 2.25, 0.06);
  const trim = new THREE.Mesh(trimGeo, accentMat);
  trim.position.set(0, 2.24, -0.74);
  trim.rotation.x = -0.08;
  chair.add(trim);

  // Armrests
  const armGeo = new THREE.BoxGeometry(0.18, 0.12, 1.05);
  [-0.86, 0.86].forEach((ax) => {
    const arm = new THREE.Mesh(armGeo, metalMat);
    arm.position.set(ax, 1.48, -0.1);
    chair.add(arm);
  });

  return chair;
}

export const QuantumBackground3D: React.FC<QuantumBackground3DProps> = ({
  show3D = true,
  customBgUrl,
  customAccentHex = "#00f0ff",
  customSecondaryHex = "#8b5cf6",
  energySurge = false,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const accentRef = useRef(new THREE.Color(customAccentHex));
  const secondaryRef = useRef(new THREE.Color(customSecondaryHex));
  const surgeRef = useRef(energySurge);

  useEffect(() => {
    accentRef.current.set(customAccentHex);
  }, [customAccentHex]);

  useEffect(() => {
    secondaryRef.current.set(customSecondaryHex);
  }, [customSecondaryHex]);

  useEffect(() => {
    surgeRef.current = energySurge;
  }, [energySurge]);

  useEffect(() => {
    if (!show3D) return;
    const container = mountRef.current;
    if (!container) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020614, 0.015);

    const camera = new THREE.PerspectiveCamera(56, width / height, 0.1, 220);
    camera.position.set(0, 1.5, 13.5);

    const isSoftwareGl =
      typeof navigator !== "undefined" && (navigator.hardwareConcurrency || 4) <= 2;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: !isSoftwareGl,
        powerPreference: "high-performance",
      });
    } catch {
      return;
    }

    const canvas = renderer.domElement;
    const onLost = (e: Event) => {
      e.preventDefault();
    };
    canvas.addEventListener("webglcontextlost", onLost);

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 1.5));
    container.innerHTML = "";
    container.appendChild(canvas);

    let pmrem: THREE.PMREMGenerator | null = null;
    let roomEnv: RoomEnvironment | null = null;
    let envRT: THREE.WebGLRenderTarget | null = null;
    try {
      pmrem = new THREE.PMREMGenerator(renderer);
      roomEnv = new RoomEnvironment();
      envRT = pmrem.fromScene(roomEnv, 0.04);
      scene.environment = envRT.texture;
    } catch {
      scene.environment = null;
    }

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const glowSprite = createGlowSpriteTexture();

    // Lighting for Technology Hub Chamber
    const ambient = new THREE.AmbientLight(0x93c5fd, 0.7);
    scene.add(ambient);
    const keyLight = new THREE.DirectionalLight(0xe0f2fe, 1.8);
    keyLight.position.set(6, 14, 12);
    scene.add(keyLight);
    const hubCyanLight = new THREE.PointLight(0x00f0ff, 18, 42);
    hubCyanLight.position.set(-6, 4, 2);
    scene.add(hubCyanLight);
    const hubVioletLight = new THREE.PointLight(0x8b5cf6, 16, 42);
    hubVioletLight.position.set(6, 3, 2);
    scene.add(hubVioletLight);

    // 1. Subtle Orbital Skylight Starfield (upper dome only, no formulas)
    const starCount = isSoftwareGl ? 500 : 1050;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * 140;
      starPos[i * 3 + 1] = 2 + Math.random() * 55;
      starPos[i * 3 + 2] = -25 - Math.random() * 80;
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({
      size: 0.35,
      map: glowSprite || undefined,
      color: 0xbae6fd,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const skylightStars = new THREE.Points(starGeo, starMat);
    scene.add(skylightStars);

    // 2. Technology Hub Chamber Deck Floor & Hex Rings
    const floorGeo = new THREE.CircleGeometry(28, 48);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x050b18,
      metalness: 0.82,
      roughness: 0.24,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.y = -4.0;
    scene.add(floorMesh);

    const floorRingGeo = new THREE.RingGeometry(4.4, 4.55, 64);
    floorRingGeo.rotateX(-Math.PI / 2);
    const floorRingMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.48,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const floorRingMesh = new THREE.Mesh(floorRingGeo, floorRingMat);
    floorRingMesh.position.set(0, -3.98, -2.5);
    scene.add(floorRingMesh);

    // 3. Arched Structural Steel Bay Ribs
    const ribMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.88,
      roughness: 0.28,
    });
    const ribGeo = new THREE.TorusGeometry(13.5, 0.24, 10, 48, Math.PI);
    const ribZPositions = [-14, -8.5, -3];
    ribZPositions.forEach((rz) => {
      const rib = new THREE.Mesh(ribGeo, ribMat);
      rib.position.set(0, -4.0, rz);
      scene.add(rib);
    });

    // 4. Giant Panoramic Curved LED Wall Panel at Center-Back (ZERO math formulas!)
    const ledCanvas = document.createElement("canvas");
    ledCanvas.width = 1024;
    ledCanvas.height = 512;
    const ledCtx = ledCanvas.getContext("2d");
    if (ledCtx) {
      drawPanoramicLedScreen(ledCtx, 1024, 512, 0, customAccentHex, customSecondaryHex);
    }
    const ledTex = new THREE.CanvasTexture(ledCanvas);
    ledTex.colorSpace = THREE.SRGBColorSpace;
    ledTex.anisotropy = maxAniso;

    const ledGeo = new THREE.CylinderGeometry(16, 16, 7.6, 40, 1, true, Math.PI * 0.72, Math.PI * 0.56);
    const ledMat = new THREE.MeshBasicMaterial({
      map: ledTex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.88,
    });
    const ledWallMesh = new THREE.Mesh(ledGeo, ledMat);
    ledWallMesh.position.set(0, 1.5, 2.2);
    scene.add(ledWallMesh);

    // 5. Left & Right Backside Angled Terminal Panels
    const sideCanvasA = document.createElement("canvas");
    sideCanvasA.width = 512;
    sideCanvasA.height = 320;
    const sideCtxA = sideCanvasA.getContext("2d");
    if (sideCtxA) drawSideHologramScreen(sideCtxA, "MOBILE & ALERT MATRIX", customAccentHex, 0);
    const sideTexA = new THREE.CanvasTexture(sideCanvasA);
    sideTexA.colorSpace = THREE.SRGBColorSpace;

    const sideCanvasB = document.createElement("canvas");
    sideCanvasB.width = 512;
    sideCanvasB.height = 320;
    const sideCtxB = sideCanvasB.getContext("2d");
    if (sideCtxB) drawSideHologramScreen(sideCtxB, "STUDY & BUSINESS SYNC", customSecondaryHex, 0);
    const sideTexB = new THREE.CanvasTexture(sideCanvasB);
    sideTexB.colorSpace = THREE.SRGBColorSpace;

    const sidePlaneGeo = new THREE.PlaneGeometry(5.6, 3.5);
    const sideMatA = new THREE.MeshBasicMaterial({
      map: sideTexA,
      transparent: true,
      opacity: 0.76,
      side: THREE.DoubleSide,
    });
    const sideMatB = new THREE.MeshBasicMaterial({
      map: sideTexB,
      transparent: true,
      opacity: 0.76,
      side: THREE.DoubleSide,
    });
    const sidePanelA = new THREE.Mesh(sidePlaneGeo, sideMatA);
    sidePanelA.position.set(-9.2, 0.8, -8.5);
    sidePanelA.rotation.y = 0.52;
    const sidePanelB = new THREE.Mesh(sidePlaneGeo, sideMatB);
    sidePanelB.position.set(9.2, 0.8, -8.5);
    sidePanelB.rotation.y = -0.52;
    scene.add(sidePanelA, sidePanelB);

    // 6. Dual Ergonomic 3D Command Chairs + Curved Holographic Desk Consoles
    const seatLeatherMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.35,
      roughness: 0.45,
    });
    const cyanTrimMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 1.3,
    });
    const amberTrimMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.3,
    });

    const leftChair = buildExecutiveChair(cyanTrimMat, seatLeatherMat, ribMat);
    leftChair.position.set(-3.2, -3.98, -4.6);
    leftChair.rotation.y = 0.26;
    const rightChair = buildExecutiveChair(amberTrimMat, seatLeatherMat, ribMat);
    rightChair.position.set(3.2, -3.98, -4.6);
    rightChair.rotation.y = -0.26;
    scene.add(leftChair, rightChair);

    // Curved glass desk front rim
    const deskGeo = new THREE.TorusGeometry(4.2, 0.14, 10, 40, Math.PI * 0.55);
    deskGeo.rotateX(Math.PI / 2);
    const deskMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      metalness: 0.25,
      roughness: 0.12,
      transparent: true,
      opacity: 0.48,
    });
    const deskMesh = new THREE.Mesh(deskGeo, deskMat);
    deskMesh.position.set(0, -2.55, -2.6);
    deskMesh.rotation.z = Math.PI * 0.22;
    scene.add(deskMesh);

    let targetMouseX = 0;
    let targetMouseY = 0;
    let mouseX = 0;
    let mouseY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      targetMouseX = (e.clientX / window.innerWidth - 0.5) * 2.2;
      targetMouseY = -(e.clientY / window.innerHeight - 0.5) * 1.1;
    };
    window.addEventListener("mousemove", handleMouseMove);

    const handleResize = () => {
      if (!container) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    const timer = new THREE.Timer();
    timer.connect(document);
    const liveAccent = new THREE.Color(customAccentHex);
    const liveSecondary = new THREE.Color(customSecondaryHex);
    let lastRedraw = 0;

    const animate = (timestamp?: number) => {
      animFrameRef.current = requestAnimationFrame(animate);
      timer.update(timestamp);
      const delta = Math.min(timer.getDelta(), 0.05);
      const t = timer.getElapsed();
      const surgeMult = surgeRef.current ? 1.85 : 1.0;

      const cDamp = 1 - Math.exp(-2.4 * delta);
      liveAccent.lerp(accentRef.current, cDamp);
      liveSecondary.lerp(secondaryRef.current, cDamp);

      hubCyanLight.color.copy(liveAccent);
      hubVioletLight.color.copy(liveSecondary);
      floorRingMat.color.copy(liveAccent);
      floorRingMesh.rotation.z = t * 0.08 * surgeMult;

      // Refresh live LED panels smoothly ~6fps so telemetry bars & radar sweep move without heavy CPU use
      if (t - lastRedraw > 0.16) {
        lastRedraw = t;
        const aHex = `#${liveAccent.getHexString()}`;
        const sHex = `#${liveSecondary.getHexString()}`;
        if (ledCtx) {
          drawPanoramicLedScreen(ledCtx, 1024, 512, t * surgeMult, aHex, sHex);
          ledTex.needsUpdate = true;
        }
        if (sideCtxA) {
          drawSideHologramScreen(sideCtxA, "MOBILE & ALERT MATRIX", aHex, t * surgeMult);
          sideTexA.needsUpdate = true;
        }
        if (sideCtxB) {
          drawSideHologramScreen(sideCtxB, "STUDY & TASKS SYNC", sHex, t * surgeMult);
          sideTexB.needsUpdate = true;
        }
      }

      skylightStars.rotation.z = t * 0.005;

      // Gentle swivel idle motion on background chairs
      leftChair.rotation.y = 0.26 + Math.sin(t * 0.35) * 0.06;
      rightChair.rotation.y = -0.26 - Math.sin(t * 0.35 + 1.2) * 0.06;

      mouseX = THREE.MathUtils.damp(mouseX, targetMouseX, 3.0, delta);
      mouseY = THREE.MathUtils.damp(mouseY, targetMouseY, 3.0, delta);
      camera.position.x = mouseX;
      camera.position.y = 1.5 + mouseY;
      camera.lookAt(0, 0.2, -10);

      renderer.render(scene, camera);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      timer.disconnect();
      timer.dispose();
      canvas.removeEventListener("webglcontextlost", onLost);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);

      starGeo.dispose();
      starMat.dispose();
      floorGeo.dispose();
      floorMat.dispose();
      floorRingGeo.dispose();
      floorRingMat.dispose();
      ribGeo.dispose();
      ribMat.dispose();
      ledGeo.dispose();
      ledMat.dispose();
      ledTex.dispose();
      sidePlaneGeo.dispose();
      sideMatA.dispose();
      sideMatB.dispose();
      sideTexA.dispose();
      sideTexB.dispose();
      seatLeatherMat.dispose();
      cyanTrimMat.dispose();
      amberTrimMat.dispose();
      deskGeo.dispose();
      deskMat.dispose();
      glowSprite?.dispose();
      [leftChair, rightChair].forEach((grp) => {
        grp.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry?.dispose();
          }
        });
      });
      envRT?.dispose();
      roomEnv?.dispose();
      pmrem?.dispose();
      renderer.dispose();

      if (container.contains(canvas)) {
        container.removeChild(canvas);
      }
    };
  }, [show3D]);

  return (
    <div
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at 50% 35%, rgba(6, 182, 212, 0.14) 0%, rgba(2, 6, 20, 0.96) 75%)",
      }}
    >
      {customBgUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-25 transition-opacity duration-1000"
          style={{ backgroundImage: `url(${customBgUrl})` }}
        />
      )}
      {show3D && <div ref={mountRef} className="absolute inset-0 opacity-95" />}
    </div>
  );
};
