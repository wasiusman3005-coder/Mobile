import React, { useEffect, useRef } from "react";
import * as THREE from "three";

interface QuantumBackground3DProps {
  intensity?: number;
  customAccentHex?: string;
  customSecondaryHex?: string;
  energySurge?: boolean;
  show3D?: boolean;
  customBgUrl?: string;
}

const QUANTUM_EQUATIONS = [
  { title: "SCHRÖDINGER EQUATION", formula: "iℏ ∂Ψ/∂t = [ -ℏ²/(2m)∇² + V(r,t) ] Ψ" },
  { title: "DIRAC RELATIVISTIC EQUATION", formula: "( iγᵘ ∂ᵤ - mc/ℏ ) ψ = 0" },
  { title: "HEISENBERG UNCERTAINTY", formula: "σₓ · σₚ ≥ ℏ / 2" },
  { title: "QED LAGRANGIAN DENSITY", formula: "ℒ = ψ̄(iγᵘDᵤ - m)ψ - ¼ F_μν F^μν" },
  { title: "FEYNMAN PATH INTEGRAL", formula: "K(b,a) = ∫ 𝒟[x(t)] exp( i S[x] / ℏ )" },
];

function createGlowSpriteTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0.0, "rgba(255, 255, 255, 1.0)");
  grad.addColorStop(0.18, "rgba(210, 240, 255, 0.85)");
  grad.addColorStop(0.45, "rgba(96, 165, 250, 0.25)");
  grad.addColorStop(1.0, "rgba(0, 0, 0, 0.0)");

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createEquationTexture(
  title: string,
  formula: string,
  accentHex: string,
  maxAniso: number
): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 192;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(148, 163, 184, 0.22)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);

  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(8, 30);
  ctx.lineTo(8, 8);
  ctx.lineTo(36, 8);
  ctx.moveTo(canvas.width - 36, 8);
  ctx.lineTo(canvas.width - 8, 8);
  ctx.lineTo(canvas.width - 8, 30);
  ctx.moveTo(8, canvas.height - 30);
  ctx.lineTo(8, canvas.height - 8);
  ctx.lineTo(36, canvas.height - 8);
  ctx.moveTo(canvas.width - 36, canvas.height - 8);
  ctx.lineTo(canvas.width - 8, canvas.height - 8);
  ctx.lineTo(canvas.width - 8, canvas.height - 30);
  ctx.stroke();

  ctx.font = "600 18px 'JetBrains Mono', monospace";
  ctx.fillStyle = "rgba(148, 163, 184, 0.85)";
  ctx.fillText(title, 32, 48);

  ctx.font = "700 30px 'JetBrains Mono', monospace";
  ctx.shadowColor = accentHex;
  ctx.shadowBlur = 14;
  ctx.fillStyle = "#f8fafc";
  ctx.fillText(formula, 32, 122);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

function createSpiralGalaxy(
  starCount: number,
  radius: number,
  branches: number,
  spinFactor: number,
  coreColorHex: number,
  armColorHex: number,
  spriteTex: THREE.CanvasTexture | null
): { points: THREE.Points; geo: THREE.BufferGeometry; mat: THREE.PointsMaterial } {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);

  const coreColor = new THREE.Color(coreColorHex);
  const armColor = new THREE.Color(armColorHex);
  const mixed = new THREE.Color();

  for (let i = 0; i < starCount; i++) {
    const i3 = i * 3;
    const r = Math.pow(Math.random(), 1.55) * radius;
    const branchAngle = ((i % branches) / branches) * Math.PI * 2;
    const spinAngle = r * spinFactor;

    const scatter = Math.pow(Math.random(), 2.2) * (Math.random() < 0.5 ? 1 : -1) * (0.28 * r + 0.55);
    const scatterY = (Math.random() - 0.5) * (0.14 * r + 0.35);
    const scatterZ = Math.pow(Math.random(), 2.2) * (Math.random() < 0.5 ? 1 : -1) * (0.28 * r + 0.55);

    positions[i3] = Math.cos(branchAngle + spinAngle) * r + scatter;
    positions[i3 + 1] = scatterY;
    positions[i3 + 2] = Math.sin(branchAngle + spinAngle) * r + scatterZ;

    mixed.copy(coreColor).lerp(armColor, Math.min(1, r / radius));
    colors[i3] = mixed.r;
    colors[i3 + 1] = mixed.g;
    colors[i3 + 2] = mixed.b;
  }

  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: 0.55,
    map: spriteTex || undefined,
    alphaTest: 0.001,
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
  });

  return { points: new THREE.Points(geo, mat), geo, mat };
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
    const container = mountRef.current;
    if (!container) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x01030b, 0.0085);

    const camera = new THREE.PerspectiveCamera(58, width / height, 0.1, 400);
    camera.position.z = 26;

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
    renderer.toneMappingExposure = 1.2;
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    container.innerHTML = "";
    container.appendChild(canvas);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const glowSprite = createGlowSpriteTexture();

    // =========================================================================
    // 1. DEEP COSMOS MULTI-SPECTRAL STARFIELD
    // =========================================================================
    const starCount = isSoftwareGl ? 1200 : 2400;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    const starSpeeds = new Float32Array(starCount);

    const spectralPalette = [
      new THREE.Color(0xe0f2fe),
      new THREE.Color(0x93c5fd),
      new THREE.Color(0xfef3c7),
      new THREE.Color(0xc4b5fd),
      new THREE.Color(0xfda4af),
      new THREE.Color(0x67e8f9),
    ];

    for (let i = 0; i < starCount; i++) {
      const i3 = i * 3;
      starPos[i3] = (Math.random() - 0.5) * 180;
      starPos[i3 + 1] = (Math.random() - 0.5) * 130;
      starPos[i3 + 2] = (Math.random() - 0.5) * 140 - 20;
      starSpeeds[i] = 0.015 + Math.random() * 0.045;

      const c = spectralPalette[Math.floor(Math.random() * spectralPalette.length)];
      const brightness = 0.55 + Math.random() * 0.45;
      starColors[i3] = c.r * brightness;
      starColors[i3 + 1] = c.g * brightness;
      starColors[i3 + 2] = c.b * brightness;
    }

    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute("color", new THREE.BufferAttribute(starColors, 3));

    const starMat = new THREE.PointsMaterial({
      size: 0.42,
      map: glowSprite || undefined,
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const deepStars = new THREE.Points(starGeo, starMat);
    scene.add(deepStars);

    // =========================================================================
    // 2. DISTANT GRAND SPIRAL GALAXIES
    // =========================================================================
    const galaxyPrimary = createSpiralGalaxy(
      isSoftwareGl ? 700 : 1450,
      26,
      4,
      0.34,
      0xfef08a,
      0x38bdf8,
      glowSprite
    );
    galaxyPrimary.points.position.set(-22, 13, -46);
    galaxyPrimary.points.rotation.set(0.95, 0.28, -0.35);
    scene.add(galaxyPrimary.points);

    const galaxySecondary = createSpiralGalaxy(
      isSoftwareGl ? 500 : 950,
      20,
      3,
      0.42,
      0xf5d0fe,
      0x818cf8,
      glowSprite
    );
    galaxySecondary.points.position.set(24, -14, -56);
    galaxySecondary.points.rotation.set(1.12, -0.45, 0.42);
    scene.add(galaxySecondary.points);

    const milkyWay = createSpiralGalaxy(
      isSoftwareGl ? 600 : 1100,
      58,
      2,
      0.16,
      0x38bdf8,
      0x6366f1,
      glowSprite
    );
    milkyWay.points.position.set(2, -4, -75);
    milkyWay.points.rotation.set(1.32, 0.1, 0.65);
    milkyWay.mat.opacity = 0.42;
    scene.add(milkyWay.points);

    // =========================================================================
    // 3. DRIFTING 3D QUANTUM PHYSICS FORMULAS WITH PARALLAX DEPTH (Q-DYNAMICS)
    // =========================================================================
    const formulaGroup = new THREE.Group();
    scene.add(formulaGroup);
    const formulaPlaneGeo = new THREE.PlaneGeometry(8.6, 2.15);
    const formulaTextures: THREE.CanvasTexture[] = [];
    const formulaMats: THREE.MeshBasicMaterial[] = [];
    const formulaCards: {
      mesh: THREE.Mesh;
      mat: THREE.MeshBasicMaterial;
      baseY: number;
      speedX: number;
      bobAmp: number;
      bobFreq: number;
      phase: number;
    }[] = [];

    for (let i = 0; i < 15; i++) {
      const eq = QUANTUM_EQUATIONS[i % QUANTUM_EQUATIONS.length];
      const tex = createEquationTexture(eq.title, eq.formula, "#00f0ff", maxAniso);
      if (!tex) continue;
      formulaTextures.push(tex);
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity: 0.34 + (i % 3) * 0.1,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        color: new THREE.Color("#ffffff"),
      });
      formulaMats.push(mat);

      const mesh = new THREE.Mesh(formulaPlaneGeo, mat);
      const depthLayer = -2 - (i % 5) * 6.5;
      const spreadX = (Math.random() - 0.5) * 52;
      const spreadY = (Math.random() - 0.5) * 26;
      mesh.position.set(spreadX, spreadY, depthLayer);
      mesh.rotation.y = (Math.random() - 0.5) * 0.24;
      const scale = 0.68 + (1 - Math.abs(depthLayer) / 36) * 0.52;
      mesh.scale.setScalar(scale);

      formulaGroup.add(mesh);
      formulaCards.push({
        mesh,
        mat,
        baseY: spreadY,
        speedX: (0.65 + Math.random() * 0.85) * (i % 2 === 0 ? 1 : -1),
        bobAmp: 0.35 + Math.random() * 0.4,
        bobFreq: 0.45 + Math.random() * 0.45,
        phase: Math.random() * Math.PI * 2,
      });
    }

    // =========================================================================
    // 4. LUMINOUS COSMIC NEBULA CLOUDS
    // =========================================================================
    const nebulaColors = [0x1d4ed8, 0x7e22ce, 0x0e7490, 0xbe185d, 0x4338ca];
    const nebulaSprites: { sprite: THREE.Sprite; baseX: number; baseY: number; speed: number; phase: number }[] = [];
    const nebulaMats: THREE.SpriteMaterial[] = [];

    if (glowSprite) {
      for (let i = 0; i < 10; i++) {
        const mat = new THREE.SpriteMaterial({
          map: glowSprite,
          color: nebulaColors[i % nebulaColors.length],
          transparent: true,
          opacity: 0.14 + (i % 3) * 0.04,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        nebulaMats.push(mat);
        const sprite = new THREE.Sprite(mat);
        const bx = (Math.random() - 0.5) * 70;
        const by = (Math.random() - 0.5) * 44;
        const bz = -35 - Math.random() * 45;
        const scale = 22 + Math.random() * 24;
        sprite.position.set(bx, by, bz);
        sprite.scale.set(scale, scale * 0.72, 1);
        scene.add(sprite);
        nebulaSprites.push({
          sprite,
          baseX: bx,
          baseY: by,
          speed: 0.08 + Math.random() * 0.08,
          phase: Math.random() * Math.PI * 2,
        });
      }
    }

    // =========================================================================
    // 5. OCCASIONAL SHOOTING STARS
    // =========================================================================
    interface MeteorItem {
      line: THREE.Line;
      geo: THREE.BufferGeometry;
      mat: THREE.LineBasicMaterial;
      active: boolean;
      vx: number;
      vy: number;
      vz: number;
      life: number;
      cooldown: number;
    }

    const meteors: MeteorItem[] = [];
    for (let i = 0; i < 4; i++) {
      const mGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(2.4, 1.3, 0),
      ]);
      const mMat = new THREE.LineBasicMaterial({
        color: i % 2 === 0 ? 0xe0f2fe : 0xa5f3fc,
        transparent: true,
        opacity: 0,
      });
      const mLine = new THREE.Line(mGeo, mMat);
      scene.add(mLine);
      meteors.push({
        line: mLine,
        geo: mGeo,
        mat: mMat,
        active: false,
        vx: -0.65,
        vy: -0.35,
        vz: 0.08,
        life: 0,
        cooldown: 1.5 + i * 2.4,
      });
    }

    let targetMouseX = 0;
    let targetMouseY = 0;
    let mouseX = 0;
    let mouseY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      targetMouseX = (e.clientX / window.innerWidth - 0.5) * 3.4;
      targetMouseY = -(e.clientY / window.innerHeight - 0.5) * 2.4;
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

    const clock = new THREE.Clock();
    const liveAccent = new THREE.Color(customAccentHex);
    const liveSecondary = new THREE.Color(customSecondaryHex);

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.05);
      const t = clock.getElapsedTime();
      const surgeMult = surgeRef.current ? 1.85 : 1.0;

      const cDamp = 1 - Math.exp(-2.4 * delta);
      liveAccent.lerp(accentRef.current, cDamp);
      liveSecondary.lerp(secondaryRef.current, cDamp);

      galaxyPrimary.points.rotation.y = 0.28 + t * 0.032 * surgeMult;
      galaxySecondary.points.rotation.y = -0.45 - t * 0.038 * surgeMult;
      milkyWay.points.rotation.y = 0.1 + t * 0.012;

      const posArr = starGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < starCount; i++) {
        posArr[i * 3 + 2] += starSpeeds[i] * 0.85 * surgeMult;
        if (posArr[i * 3 + 2] > 28) {
          posArr[i * 3 + 2] = -110;
          posArr[i * 3] = (Math.random() - 0.5) * 180;
          posArr[i * 3 + 1] = (Math.random() - 0.5) * 130;
        }
      }
      starGeo.attributes.position.needsUpdate = true;
      deepStars.rotation.z = t * 0.008;

      // Drifting 3D Background Quantum Physics Formulas with Parallax
      formulaGroup.position.x = THREE.MathUtils.damp(formulaGroup.position.x, -targetMouseX * 0.85, 3.2, delta);
      formulaGroup.position.y = THREE.MathUtils.damp(formulaGroup.position.y, -targetMouseY * 0.55, 3.2, delta);
      for (let i = 0; i < formulaCards.length; i++) {
        const fc = formulaCards[i];
        fc.mesh.position.x += fc.speedX * delta * surgeMult;
        fc.mesh.position.y = fc.baseY + Math.sin(t * fc.bobFreq + fc.phase) * fc.bobAmp;
        fc.mat.color.copy(i % 2 === 0 ? liveAccent : liveSecondary);
        if (fc.mesh.position.x > 30) fc.mesh.position.x = -30;
        if (fc.mesh.position.x < -30) fc.mesh.position.x = 30;
      }

      nebulaSprites.forEach((n) => {
        n.sprite.position.x = n.baseX + Math.sin(t * n.speed + n.phase) * 2.2;
        n.sprite.position.y = n.baseY + Math.cos(t * n.speed + n.phase) * 1.4;
      });

      meteors.forEach((m) => {
        if (!m.active) {
          m.cooldown -= delta;
          if (m.cooldown <= 0) {
            m.active = true;
            m.life = 0;
            m.line.position.set(
              (Math.random() - 0.1) * 44,
              10 + Math.random() * 18,
              -12 - Math.random() * 25
            );
            m.vx = -0.6 - Math.random() * 0.45;
            m.vy = -0.32 - Math.random() * 0.25;
            m.vz = 0.1;
          }
        } else {
          m.life += delta;
          m.line.position.x += m.vx;
          m.line.position.y += m.vy;
          m.line.position.z += m.vz;
          const progress = m.life / 0.85;
          m.mat.opacity = Math.sin(Math.min(1, progress) * Math.PI) * 0.85;
          if (progress >= 1) {
            m.active = false;
            m.mat.opacity = 0;
            m.cooldown = 3.5 + Math.random() * 5.5;
          }
        }
      });

      mouseX += (targetMouseX - mouseX) * 0.035;
      mouseY += (targetMouseY - mouseY) * 0.035;
      camera.position.x = mouseX;
      camera.position.y = mouseY;
      camera.lookAt(0, 0, -25);

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      canvas.removeEventListener("webglcontextlost", onLost);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();

      starGeo.dispose();
      starMat.dispose();
      galaxyPrimary.geo.dispose();
      galaxyPrimary.mat.dispose();
      galaxySecondary.geo.dispose();
      galaxySecondary.mat.dispose();
      milkyWay.geo.dispose();
      milkyWay.mat.dispose();
      formulaPlaneGeo.dispose();
      formulaTextures.forEach((tx) => tx.dispose());
      formulaMats.forEach((m) => m.dispose());
      nebulaMats.forEach((m) => m.dispose());
      meteors.forEach((m) => {
        m.geo.dispose();
        m.mat.dispose();
      });
      glowSprite?.dispose();

      if (container.contains(canvas)) {
        container.removeChild(canvas);
      }
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at 22% 18%, rgba(29, 78, 216, 0.22) 0%, transparent 52%), radial-gradient(ellipse at 78% 76%, rgba(109, 40, 217, 0.18) 0%, transparent 52%), radial-gradient(circle at 50% 48%, rgba(14, 116, 144, 0.12) 0%, #02040a 78%)",
      }}
    >
      {customBgUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30 transition-opacity duration-1000"
          style={{ backgroundImage: `url(${customBgUrl})` }}
        />
      )}
      {show3D && <div ref={mountRef} className="absolute inset-0 opacity-95" />}
    </div>
  );
};
