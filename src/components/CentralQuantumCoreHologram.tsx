import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  Trash2,
  Send,
  Pencil,
  Check,
  X,
  AudioWaveform,
} from "lucide-react";
import { soundEffects } from "../services/soundEffects";
import { LanguageCode, VoiceGender, JarvisInterfaceThemeId } from "../types";

export interface QuantumCoreDesign {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: string;
}

export interface QuantumColorPalette {
  name: string;
  hex: string;
  secondaryHex: string;
  glow: string;
  cssGlowClass: string;
  borderClass: string;
  bgGlow: string;
}

export type CockpitCorePhase = "galaxy" | "recording" | "processing" | "speaking";

export const CORE_TOPOLOGIES = [
  { id: 0, shortLabel: "Bohr-Dirac", name: "Bohr-Dirac Atom" },
  { id: 1, shortLabel: "Tokamak Knot", name: "Tokamak Torus Knot" },
  { id: 2, shortLabel: "4D Tesseract", name: "4D Tesseract Hypercube" },
  { id: 3, shortLabel: "Calabi-Yau", name: "Calabi-Yau Singularity" },
] as const;

export const QUANTUM_SPECTRUMS: QuantumColorPalette[] = [
  {
    name: "Cyber Cyan / Violet",
    hex: "#00f0ff",
    secondaryHex: "#8b5cf6",
    glow: "rgba(0, 240, 255, 0.85)",
    cssGlowClass: "shadow-[0_0_55px_rgba(0,240,255,0.65)]",
    borderClass: "border-cyan-400",
    bgGlow: "rgba(0, 240, 255, 0.2)",
  },
  {
    name: "Solar Gold / Crimson",
    hex: "#fbbf24",
    secondaryHex: "#f43f5e",
    glow: "rgba(251, 191, 36, 0.85)",
    cssGlowClass: "shadow-[0_0_55px_rgba(251,191,36,0.7)]",
    borderClass: "border-amber-400",
    bgGlow: "rgba(251, 191, 36, 0.22)",
  },
  {
    name: "Emerald Matrix / Arctic",
    hex: "#10b981",
    secondaryHex: "#38bdf8",
    glow: "rgba(16, 185, 129, 0.85)",
    cssGlowClass: "shadow-[0_0_55px_rgba(16,185,129,0.75)]",
    borderClass: "border-emerald-400",
    bgGlow: "rgba(16, 185, 129, 0.22)",
  },
  {
    name: "Ultraviolet Nova",
    hex: "#c084fc",
    secondaryHex: "#ec4899",
    glow: "rgba(192, 132, 252, 0.85)",
    cssGlowClass: "shadow-[0_0_55px_rgba(192,132,252,0.75)]",
    borderClass: "border-purple-400",
    bgGlow: "rgba(192, 132, 252, 0.22)",
  },
];

export const QUANTUM_DESIGNS: QuantumCoreDesign[] = CORE_TOPOLOGIES.map((t) => ({
  id: `topo_${t.id}`,
  name: t.name,
  category: "Quantum Topology",
  description: t.name,
  icon: "atom",
}));

export const QUANTUM_PALETTES = QUANTUM_SPECTRUMS;

interface CentralQuantumCoreHologramProps {
  coherence: number;
  language: LanguageCode;
  voiceGender: VoiceGender;
  activeInterfaceTheme?: JarvisInterfaceThemeId;
  onColorChange?: (color: QuantumColorPalette) => void;
  onDesignChange?: (design: QuantumCoreDesign) => void;
  isOverdriveActive?: boolean;
  onToggleOverdrive?: () => void;
  cockpitPhase?: CockpitCorePhase;
  assistantName?: string;
  onRenameAssistant?: (newName: string) => void;
  audioLevel?: number;
  liveTranscript?: string;
  recordingSeconds?: number;
  waWaveBars?: number[];
  onCancelRecording?: () => void;
  onSendRecording?: () => void;
  onStartManualRecording?: () => void;
  wakeReady?: boolean;
  onPrimeWakeMic?: () => void;
  topologyIndex?: number;
  spectrumIndex?: number;
  energySurge?: boolean;
}

export const CentralQuantumCoreHologram: React.FC<CentralQuantumCoreHologramProps> = ({
  cockpitPhase = "galaxy",
  assistantName = "Wasi ki Jan",
  voiceGender,
  onRenameAssistant,
  onColorChange,
  audioLevel = 0,
  liveTranscript = "",
  recordingSeconds = 0,
  waWaveBars = [],
  onCancelRecording,
  onSendRecording,
  onStartManualRecording,
  wakeReady = true,
  onPrimeWakeMic,
  topologyIndex = 0,
  spectrumIndex = 0,
  energySurge = false,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const [webglUnavailable, setWebglUnavailable] = useState(false);

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(assistantName);
  const [shockwaveActive, setShockwaveActive] = useState(false);
  const [waveTick, setWaveTick] = useState(0);

  useEffect(() => {
    setNameDraft(assistantName);
  }, [assistantName]);

  // Animated wave tick for Processing & Speaking signal waves below the main 3D logo
  useEffect(() => {
    if (cockpitPhase !== "processing" && cockpitPhase !== "speaking") return;
    const id = setInterval(() => {
      setWaveTick((t) => (t + 1) % 10000);
    }, 65);
    return () => clearInterval(id);
  }, [cockpitPhase]);

  const phaseRef = useRef<CockpitCorePhase>(cockpitPhase);
  phaseRef.current = cockpitPhase;
  const audioLevelRef = useRef(audioLevel);
  audioLevelRef.current = audioLevel;
  const topologyRef = useRef(topologyIndex);
  topologyRef.current = topologyIndex;
  const spectrumRef = useRef(spectrumIndex);
  spectrumRef.current = spectrumIndex;
  const surgeRef = useRef(energySurge);
  surgeRef.current = energySurge;

  const pointerDownPosRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const sp = QUANTUM_SPECTRUMS[spectrumIndex % QUANTUM_SPECTRUMS.length];
    onColorChange?.(sp);
  }, [spectrumIndex, onColorChange]);

  // =========================================================================
  // THREE.JS MAIN 3D MOVING QUANTUM CORE LOGO (VISIBLE ACROSS ALL PHASES)
  // =========================================================================
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const getSize = () => {
      const s = container.clientWidth || (window.innerWidth < 640 ? 290 : 390);
      return { w: s, h: s };
    };

    const { w: initW, h: initH } = getSize();

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(46, initW / initH, 0.1, 100);
    camera.position.set(0, 0.75, 6.2);

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
      setWebglUnavailable(true);
      return;
    }

    const canvas = renderer.domElement;
    const onLost = (e: Event) => {
      e.preventDefault();
      setWebglUnavailable(true);
    };
    const onRestored = () => {
      setWebglUnavailable(false);
    };
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.22;
    renderer.setSize(initW, initH);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 1.5));
    container.innerHTML = "";
    container.appendChild(canvas);

    let envTarget: THREE.WebGLRenderTarget | null = null;
    try {
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      const roomEnv = new RoomEnvironment();
      envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
      scene.environment = envTarget.texture;
      roomEnv.dispose();
      pmremGenerator.dispose();
    } catch {}

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.minDistance = 3.4;
    controls.maxDistance = 10.5;
    controls.autoRotate = false;

    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x090d16, 0.9);
    const keyLight = new THREE.DirectionalLight(0xfff1e6, 1.85);
    keyLight.position.set(5, 7, 6);
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.45);
    rimLight.position.set(-6, 3, -5);
    const corePointLight = new THREE.PointLight(0x00f0ff, 5.2, 20, 1.4);
    scene.add(hemiLight, keyLight, rimLight, corePointLight);

    const masterGroup = new THREE.Group();
    scene.add(masterGroup);

    // ---------------------------------------------------------------------
    // MAIN 4-TOPOLOGY MORPHING QUANTUM CORE
    // ---------------------------------------------------------------------
    const quantumGroup = new THREE.Group();
    masterGroup.add(quantumGroup);

    const nucleusGeo = new THREE.IcosahedronGeometry(0.46, 1);
    const nucleusMat = new THREE.MeshPhysicalMaterial({
      color: 0x0f172a,
      metalness: 0.92,
      roughness: 0.14,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      emissive: new THREE.Color(0x00f0ff),
      emissiveIntensity: 0.65,
      flatShading: true,
      transparent: true,
      opacity: 1,
    });
    const nucleusMesh = new THREE.Mesh(nucleusGeo, nucleusMat);
    quantumGroup.add(nucleusMesh);

    const plasmaGeo = new THREE.IcosahedronGeometry(0.68, 2);
    const plasmaMat = new THREE.MeshStandardMaterial({
      color: 0x8b5cf6,
      metalness: 0.2,
      roughness: 0.1,
      emissive: new THREE.Color(0x8b5cf6),
      emissiveIntensity: 1.15,
      wireframe: true,
      transparent: true,
      opacity: 0.55,
    });
    const plasmaShell = new THREE.Mesh(plasmaGeo, plasmaMat);
    quantumGroup.add(plasmaShell);

    const gimbalMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      metalness: 0.9,
      roughness: 0.22,
      transparent: true,
      opacity: 0.9,
    });
    const gimbal1Geo = new THREE.TorusGeometry(2.38, 0.02, 12, 96);
    const gimbal2Geo = new THREE.TorusGeometry(2.56, 0.015, 12, 96);
    const gimbal1 = new THREE.Mesh(gimbal1Geo, gimbalMat);
    const gimbal2 = new THREE.Mesh(gimbal2Geo, gimbalMat);
    gimbal2.rotation.x = Math.PI * 0.36;
    quantumGroup.add(gimbal1, gimbal2);

    const MORPH_COUNT = isSoftwareGl ? 1200 : 2400;
    const topoTargets = [
      new Float32Array(MORPH_COUNT * 3),
      new Float32Array(MORPH_COUNT * 3),
      new Float32Array(MORPH_COUNT * 3),
      new Float32Array(MORPH_COUNT * 3),
    ];

    for (let i = 0; i < MORPH_COUNT; i++) {
      const idx3 = i * 3;
      const ringChoice = i % 4;
      const t = (i / MORPH_COUNT) * Math.PI * 2 * 14;
      if (ringChoice < 3) {
        const r = 1.55 + ringChoice * 0.26 + (Math.random() - 0.5) * 0.06;
        const x = Math.cos(t) * r;
        const y = Math.sin(t) * r;
        const z = (Math.random() - 0.5) * 0.05;
        const tilt = ringChoice * (Math.PI / 3);
        const ny = y * Math.cos(tilt) - z * Math.sin(tilt);
        const nz = y * Math.sin(tilt) + z * Math.cos(tilt);
        const rotZ = ringChoice * 0.72;
        topoTargets[0][idx3] = x * Math.cos(rotZ) - ny * Math.sin(rotZ);
        topoTargets[0][idx3 + 1] = x * Math.sin(rotZ) + ny * Math.cos(rotZ);
        topoTargets[0][idx3 + 2] = nz;
      } else {
        const u = Math.random() * Math.PI * 2;
        const v = Math.acos(2 * Math.random() - 1);
        const r = 1.0 + Math.sin(u * 3) * 0.14;
        topoTargets[0][idx3] = r * Math.sin(v) * Math.cos(u);
        topoTargets[0][idx3 + 1] = r * Math.sin(v) * Math.sin(u);
        topoTargets[0][idx3 + 2] = r * Math.cos(v);
      }
    }

    for (let i = 0; i < MORPH_COUNT; i++) {
      const idx3 = i * 3;
      const u = (i / MORPH_COUNT) * Math.PI * 2 * 3;
      const p = 3;
      const q = 5;
      const R = 1.42;
      const r = 0.55;
      const tubeJitter = (Math.random() - 0.5) * 0.16;
      const radial = R + (r + tubeJitter) * Math.cos(q * u);
      topoTargets[1][idx3] = radial * Math.cos(p * u);
      topoTargets[1][idx3 + 1] = (r + tubeJitter) * Math.sin(q * u) * 1.4;
      topoTargets[1][idx3 + 2] = radial * Math.sin(p * u);
    }

    const verts4D: number[][] = [];
    for (let v = 0; v < 16; v++) {
      verts4D.push([v & 1 ? 1 : -1, v & 2 ? 1 : -1, v & 4 ? 1 : -1, v & 8 ? 1 : -1]);
    }
    const edges4D: [number, number][] = [];
    for (let a = 0; a < 16; a++) {
      for (let b = a + 1; b < 16; b++) {
        const diff = a ^ b;
        if (diff && (diff & (diff - 1)) === 0) edges4D.push([a, b]);
      }
    }
    for (let i = 0; i < MORPH_COUNT; i++) {
      const idx3 = i * 3;
      const edge = edges4D[i % edges4D.length];
      const s = Math.floor(i / edges4D.length) / Math.max(1, Math.floor(MORPH_COUNT / edges4D.length));
      const va = verts4D[edge[0]];
      const vb = verts4D[edge[1]];
      const x4 = THREE.MathUtils.lerp(va[0], vb[0], s);
      const y4 = THREE.MathUtils.lerp(va[1], vb[1], s);
      const z4 = THREE.MathUtils.lerp(va[2], vb[2], s);
      const w4 = THREE.MathUtils.lerp(va[3], vb[3], s);
      const proj = 2.05 / (2.6 - w4 * 0.72);
      topoTargets[2][idx3] = x4 * proj;
      topoTargets[2][idx3 + 1] = y4 * proj;
      topoTargets[2][idx3 + 2] = z4 * proj;
    }

    for (let i = 0; i < MORPH_COUNT; i++) {
      const idx3 = i * 3;
      const n = 5;
      const k = i % n;
      const u = ((i / MORPH_COUNT) * 2 - 1) * 1.15;
      const v = ((i * 1.6180339) % 1) * Math.PI * 2;
      const angle = (2 * Math.PI * k) / n;
      const rMod = Math.pow(Math.abs(Math.cosh(u)), 2 / n);
      const x = rMod * Math.cos(v + angle) * 1.12;
      const y = rMod * Math.sin(v + angle) * 1.12;
      const z = (Math.sin(n * v) * 0.55 + Math.sinh(u) * 0.72) * Math.cos(angle * 0.5 + u);
      topoTargets[3][idx3] = x;
      topoTargets[3][idx3 + 1] = z;
      topoTargets[3][idx3 + 2] = y;
    }

    const currentMorphPos = new Float32Array(topoTargets[0]);
    const morphGeo = new THREE.BufferGeometry();
    morphGeo.setAttribute("position", new THREE.BufferAttribute(currentMorphPos, 3));
    const morphPointsMat = new THREE.PointsMaterial({
      color: 0x00f0ff,
      size: 0.068,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const morphPoints = new THREE.Points(morphGeo, morphPointsMat);
    quantumGroup.add(morphPoints);

    const wireAccentMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: new THREE.Color(0x00f0ff),
      emissiveIntensity: 0.75,
      metalness: 0.85,
      roughness: 0.18,
      wireframe: true,
      transparent: true,
      opacity: 0.34,
    });

    const topoDisposables: THREE.BufferGeometry[] = [];
    const atomRingsGroup = new THREE.Group();
    for (let r = 0; r < 3; r++) {
      const rg = new THREE.TorusGeometry(1.55 + r * 0.26, 0.015, 10, 80);
      topoDisposables.push(rg);
      const ring = new THREE.Mesh(rg, wireAccentMat);
      ring.rotation.x = r * (Math.PI / 3);
      ring.rotation.z = r * 0.72;
      atomRingsGroup.add(ring);
    }
    quantumGroup.add(atomRingsGroup);

    const tokamakGeo = new THREE.TorusKnotGeometry(1.36, 0.22, 140, 18, 3, 5);
    topoDisposables.push(tokamakGeo);
    const tokamakMesh = new THREE.Mesh(tokamakGeo, wireAccentMat);
    tokamakMesh.visible = false;
    quantumGroup.add(tokamakMesh);

    const tesseractGroup = new THREE.Group();
    const boxOuterGeo = new THREE.BoxGeometry(2.65, 2.65, 2.65);
    const boxInnerGeo = new THREE.BoxGeometry(1.3, 1.3, 1.3);
    topoDisposables.push(boxOuterGeo, boxInnerGeo);
    tesseractGroup.add(new THREE.Mesh(boxOuterGeo, wireAccentMat));
    tesseractGroup.add(new THREE.Mesh(boxInnerGeo, wireAccentMat));
    tesseractGroup.visible = false;
    quantumGroup.add(tesseractGroup);

    const calabiGeo = new THREE.TorusKnotGeometry(1.26, 0.32, 150, 22, 5, 2);
    topoDisposables.push(calabiGeo);
    const calabiMesh = new THREE.Mesh(calabiGeo, wireAccentMat);
    calabiMesh.visible = false;
    quantumGroup.add(calabiMesh);

    const topoMeshes = [atomRingsGroup, tokamakMesh, tesseractGroup, calabiMesh];

    // Processing Gyroscope Overlay
    const processingGroup = new THREE.Group();
    masterGroup.add(processingGroup);
    const procMatMain = new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0 });
    const procMatAmber = new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0 });
    const procMatWire = new THREE.MeshBasicMaterial({
      color: 0xc084fc,
      wireframe: true,
      transparent: true,
      opacity: 0,
    });
    const pG1 = new THREE.TorusGeometry(1.75, 0.048, 10, 64);
    const pG2 = new THREE.TorusGeometry(1.42, 0.04, 10, 64);
    const pG3 = new THREE.TorusGeometry(1.08, 0.034, 10, 48);
    const pBox = new THREE.BoxGeometry(1.12, 1.12, 1.12);
    const pOct = new THREE.OctahedronGeometry(0.45, 0);
    topoDisposables.push(pG1, pG2, pG3, pBox, pOct);

    const procGyro1 = new THREE.Mesh(pG1, procMatMain);
    const procGyro2 = new THREE.Mesh(pG2, procMatAmber);
    const procGyro3 = new THREE.Mesh(pG3, procMatMain);
    const procTesseractOuter = new THREE.Mesh(pBox, procMatWire);
    const procCoreOrb = new THREE.Mesh(pOct, procMatAmber);
    processingGroup.add(procGyro1, procGyro2, procGyro3, procTesseractOuter, procCoreOrb);

    // Speaking Voice-Reactive Resonance Overlay
    const speakingGroup = new THREE.Group();
    masterGroup.add(speakingGroup);
    const speakMatCore = new THREE.MeshBasicMaterial({
      color: 0x34d399,
      wireframe: true,
      transparent: true,
      opacity: 0,
    });
    const speakMatRingA = new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0 });
    const speakMatRingB = new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0 });
    const sSph = new THREE.IcosahedronGeometry(1.22, 2);
    const sR1 = new THREE.TorusGeometry(1.58, 0.036, 12, 64);
    const sR2 = new THREE.TorusGeometry(1.86, 0.028, 12, 64);
    const sR3 = new THREE.TorusGeometry(0.88, 0.042, 12, 48);
    topoDisposables.push(sSph, sR1, sR2, sR3);

    const speakSphere = new THREE.Mesh(sSph, speakMatCore);
    const speakWaveRing1 = new THREE.Mesh(sR1, speakMatRingA);
    const speakWaveRing2 = new THREE.Mesh(sR2, speakMatRingB);
    const speakWaveRing3 = new THREE.Mesh(sR3, speakMatRingA);
    speakWaveRing1.rotation.x = Math.PI / 2.4;
    speakWaveRing2.rotation.y = Math.PI / 2.8;
    speakingGroup.add(speakSphere, speakWaveRing1, speakWaveRing2, speakWaveRing3);

    const handleResize = () => {
      if (!container) return;
      const { w, h } = getSize();
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    const timer = new THREE.Timer();
    timer.connect(document);
    const targetPrimary = new THREE.Color(QUANTUM_SPECTRUMS[0].hex);
    const targetSecondary = new THREE.Color(QUANTUM_SPECTRUMS[0].secondaryHex);
    const livePrimary = new THREE.Color(QUANTUM_SPECTRUMS[0].hex);
    const liveSecondary = new THREE.Color(QUANTUM_SPECTRUMS[0].secondaryHex);

    const animate = (timestamp?: number) => {
      animFrameRef.current = requestAnimationFrame(animate);
      timer.update(timestamp);
      const dt = Math.min(timer.getDelta(), 0.05);
      const t = timer.getElapsed();
      const phase = phaseRef.current;
      const activeTopo = topologyRef.current % 4;
      const activeSpec = QUANTUM_SPECTRUMS[spectrumRef.current % QUANTUM_SPECTRUMS.length];
      const surgeMult = surgeRef.current ? 2.5 : 1.0;

      targetPrimary.set(activeSpec.hex);
      targetSecondary.set(activeSpec.secondaryHex);

      const cDamp = 1 - Math.exp(-2.6 * dt);
      livePrimary.lerp(targetPrimary, cDamp);
      liveSecondary.lerp(targetSecondary, cDamp);

      const isQuantumIdle = phase === "galaxy" || phase === "recording";
      const isProcessing = phase === "processing";
      const isSpeaking = phase === "speaking";

      topoMeshes.forEach((m, idx) => {
        m.visible = isQuantumIdle && idx === activeTopo;
      });

      nucleusMat.opacity = THREE.MathUtils.lerp(nucleusMat.opacity, isQuantumIdle ? 1.0 : 0.25, 0.12);
      plasmaMat.opacity = THREE.MathUtils.lerp(plasmaMat.opacity, isQuantumIdle ? 0.55 : 0.14, 0.12);
      gimbalMat.opacity = THREE.MathUtils.lerp(gimbalMat.opacity, isQuantumIdle ? 0.9 : 0.25, 0.12);
      morphPointsMat.opacity = THREE.MathUtils.lerp(morphPointsMat.opacity, isQuantumIdle ? 0.92 : 0.22, 0.12);
      wireAccentMat.opacity = THREE.MathUtils.lerp(wireAccentMat.opacity, isQuantumIdle ? 0.34 : 0.08, 0.12);

      procMatMain.opacity = THREE.MathUtils.lerp(procMatMain.opacity, isProcessing ? 0.92 : 0.0, 0.14);
      procMatAmber.opacity = THREE.MathUtils.lerp(procMatAmber.opacity, isProcessing ? 0.88 : 0.0, 0.14);
      procMatWire.opacity = THREE.MathUtils.lerp(procMatWire.opacity, isProcessing ? 0.76 : 0.0, 0.14);

      speakMatCore.opacity = THREE.MathUtils.lerp(speakMatCore.opacity, isSpeaking ? 0.78 : 0.0, 0.14);
      speakMatRingA.opacity = THREE.MathUtils.lerp(speakMatRingA.opacity, isSpeaking ? 0.9 : 0.0, 0.14);
      speakMatRingB.opacity = THREE.MathUtils.lerp(speakMatRingB.opacity, isSpeaking ? 0.76 : 0.0, 0.14);

      if (phase === "recording") {
        nucleusMat.emissive.set("#25d366");
        morphPointsMat.color.set("#34d399");
        corePointLight.color.set("#10b981");
        const pulseScale = 1 + audioLevelRef.current * 0.16;
        quantumGroup.scale.setScalar(THREE.MathUtils.lerp(quantumGroup.scale.x, pulseScale, 0.22));
      } else {
        nucleusMat.emissive.copy(livePrimary);
        morphPointsMat.color.copy(livePrimary);
        corePointLight.color.copy(livePrimary);
        quantumGroup.scale.setScalar(THREE.MathUtils.lerp(quantumGroup.scale.x, 1, 0.12));
      }

      nucleusMat.emissiveIntensity = surgeRef.current ? 1.45 : 0.68;
      plasmaMat.color.copy(liveSecondary);
      plasmaMat.emissive.copy(liveSecondary);
      wireAccentMat.color.copy(livePrimary);
      wireAccentMat.emissive.copy(livePrimary);
      corePointLight.intensity = surgeRef.current
        ? 9.0 + Math.sin(t * 14) * 2.0
        : 5.2 + Math.sin(t * 3) * 0.6;
      rimLight.color.copy(liveSecondary);

      const targetBuf = topoTargets[activeTopo];
      const posAttr = morphGeo.attributes.position as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      const morphAlpha = 1 - Math.exp(-(surgeRef.current ? 6.2 : 3.6) * dt);
      for (let i = 0; i < arr.length; i++) {
        arr[i] += (targetBuf[i] - arr[i]) * morphAlpha;
      }
      posAttr.needsUpdate = true;

      quantumGroup.rotation.y += dt * (phase === "recording" ? 0.75 : 0.36) * surgeMult;
      quantumGroup.rotation.x = Math.sin(t * 0.45) * 0.18;
      nucleusMesh.rotation.y -= dt * 0.85 * surgeMult;
      nucleusMesh.rotation.z += dt * 0.55 * surgeMult;
      plasmaShell.rotation.x += dt * 0.48 * surgeMult;
      plasmaShell.scale.setScalar(1 + Math.sin(t * 3.2 * surgeMult) * 0.055);
      gimbal1.rotation.z += dt * 0.42 * surgeMult;
      gimbal1.rotation.x += dt * 0.21 * surgeMult;
      gimbal2.rotation.y -= dt * 0.35 * surgeMult;

      if (procMatMain.opacity > 0.02) {
        procGyro1.rotation.x = t * 2.5;
        procGyro1.rotation.y = t * 1.7;
        procGyro2.rotation.y = -t * 3.0;
        procGyro2.rotation.z = t * 2.0;
        procGyro3.rotation.z = t * 3.5;
        procGyro3.rotation.x = -t * 1.5;
        procTesseractOuter.rotation.x = t * 1.9;
        procTesseractOuter.rotation.y = t * 2.3;
        procCoreOrb.rotation.y = -t * 3.4;
        const pScale = 1 + Math.sin(t * 7.5) * 0.12;
        procCoreOrb.scale.set(pScale, pScale, pScale);
      }

      if (speakMatCore.opacity > 0.02) {
        const vocalCadence =
          1 +
          Math.abs(Math.sin(t * 7.2)) * 0.14 +
          Math.abs(Math.sin(t * 13.5)) * 0.08 +
          audioLevelRef.current * 0.22;
        speakSphere.scale.set(vocalCadence, vocalCadence, vocalCadence);
        speakSphere.rotation.y = t * 0.9;
        speakSphere.rotation.x = Math.sin(t * 2.1) * 0.35;
        speakWaveRing1.rotation.z = t * 1.6;
        speakWaveRing1.scale.set(1 + Math.sin(t * 6) * 0.08, 1 + Math.sin(t * 6) * 0.08, 1);
        speakWaveRing2.rotation.x = -t * 1.3;
        speakWaveRing2.scale.set(1 + Math.cos(t * 5) * 0.1, 1 + Math.cos(t * 5) * 0.1, 1);
        speakWaveRing3.rotation.y = t * 2.1;
      }

      controls.update();
      renderer.render(scene, camera);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      timer.disconnect();
      timer.dispose();
      window.removeEventListener("resize", handleResize);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      controls.dispose();
      renderer.dispose();
      envTarget?.dispose();

      nucleusGeo.dispose();
      nucleusMat.dispose();
      plasmaGeo.dispose();
      plasmaMat.dispose();
      gimbalMat.dispose();
      gimbal1Geo.dispose();
      gimbal2Geo.dispose();
      morphGeo.dispose();
      morphPointsMat.dispose();
      wireAccentMat.dispose();
      topoDisposables.forEach((g) => g.dispose());
      procMatMain.dispose();
      procMatAmber.dispose();
      procMatWire.dispose();
      speakMatCore.dispose();
      speakMatRingA.dispose();
      speakMatRingB.dispose();

      if (container.contains(canvas)) {
        container.removeChild(canvas);
      }
    };
  }, []);

  const formatWaTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${mins}:${rem < 10 ? "0" : ""}${rem}`;
  };

  const handleSaveName = () => {
    const cleaned = nameDraft.trim();
    if (cleaned && onRenameAssistant) {
      soundEffects.playBeepConfirm();
      onRenameAssistant(cleaned);
    }
    setIsEditingName(false);
  };

  const activeSpectrum = QUANTUM_SPECTRUMS[spectrumIndex % QUANTUM_SPECTRUMS.length];
  const barCount = 34;

  // Build Signal Wave bar heights cleanly for LISTENING, PROCESSING, and SPEAKING below the Main 3D Logo
  const signalBars: number[] = (() => {
    if (cockpitPhase === "recording") {
      return waWaveBars.length > 0 ? waWaveBars : Array(barCount).fill(22);
    }
    if (cockpitPhase === "processing") {
      return Array.from({ length: barCount }, (_, i) => {
        const s = Math.sin(waveTick * 0.42 + i * 0.45) * 0.5 + 0.5;
        const s2 = Math.cos(waveTick * 0.25 - i * 0.3) * 0.5 + 0.5;
        return Math.round(18 + (s * 0.65 + s2 * 0.35) * 80);
      });
    }
    if (cockpitPhase === "speaking") {
      return Array.from({ length: barCount }, (_, i) => {
        const centerFactor = 1 - Math.abs(i - barCount / 2) / (barCount / 2);
        const harmonic =
          Math.abs(Math.sin(waveTick * 0.55 + i * 0.52)) * 0.65 +
          Math.abs(Math.cos(waveTick * 0.31 - i * 0.28)) * 0.35;
        return Math.round(16 + (harmonic * 0.72 + centerFactor * 0.28 + audioLevel * 0.25) * 82);
      });
    }
    return [];
  })();

  return (
    <div className="relative flex flex-col items-center justify-center w-full select-none">
      {/* Subtle Quantum Field Halo behind the Main 3D Logo */}
      <div
        className="absolute pointer-events-none rounded-full blur-3xl transition-all duration-700"
        style={{
          width: "390px",
          height: "390px",
          background:
            cockpitPhase === "processing"
              ? "radial-gradient(circle, rgba(168,85,247,0.28) 0%, transparent 70%)"
              : cockpitPhase === "speaking"
              ? "radial-gradient(circle, rgba(16,185,129,0.26) 0%, transparent 70%)"
              : cockpitPhase === "recording"
              ? "radial-gradient(circle, rgba(37,211,102,0.24) 0%, transparent 70%)"
              : `radial-gradient(circle, ${activeSpectrum.bgGlow} 0%, transparent 72%)`,
        }}
      />

      {shockwaveActive && (
        <div
          className="absolute z-20 pointer-events-none rounded-full animate-ping border-2"
          style={{ width: "330px", height: "330px", borderColor: activeSpectrum.hex }}
        />
      )}

      {/* ================================================================= */}
      {/* ALWAYS-VISIBLE CENTER MAIN 3D QUANTUM CORE LOGO                    */}
      {/* ================================================================= */}
      <div
        onPointerDown={(e) => {
          pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          const start = pointerDownPosRef.current;
          pointerDownPosRef.current = null;
          if (!start) return;
          const dist = Math.hypot(e.clientX - start.x, e.clientY - start.y);
          if (dist < 6) {
            setShockwaveActive(true);
            setTimeout(() => setShockwaveActive(false), 750);
            if (cockpitPhase === "galaxy" && onStartManualRecording) {
              soundEffects.playBeepConfirm();
              onStartManualRecording();
            }
          }
        }}
        className="relative z-10 w-[290px] h-[290px] sm:w-[380px] sm:h-[380px] flex items-center justify-center cursor-grab active:cursor-grabbing"
        title={`Say "Jarvis" or tap logo to speak with ${assistantName}`}
      >
        {!webglUnavailable ? (
          <div ref={mountRef} className="w-full h-full flex items-center justify-center" />
        ) : (
          <div className="w-48 h-48 rounded-full border border-cyan-400/50 bg-cyan-950/20 flex items-center justify-center shadow-[0_0_60px_rgba(34,211,238,0.4)]">
            <AudioWaveform className="w-16 h-16 text-cyan-300 animate-pulse" />
          </div>
        )}
      </div>

      {/* ================================================================= */}
      {/* ASSISTANT NAME + LIVE SIGNAL WAVE BELOW MAIN LOGO (LISTENING / PROCESSING / SPEAKING) */}
      {/* ================================================================= */}
      <div className="relative z-20 -mt-2 flex flex-col items-center gap-2.5 w-full max-w-md px-3">
        {isEditingName ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950/90 border border-sky-400/50 backdrop-blur-md">
            <input
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveName();
                if (e.key === "Escape") setIsEditingName(false);
              }}
              maxLength={24}
              autoFocus
              placeholder="Name..."
              className="w-32 bg-transparent text-sm font-orbitron font-bold text-white outline-none px-1"
            />
            <button
              type="button"
              onClick={handleSaveName}
              className="p-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/40 cursor-pointer"
              title="Save Name"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setIsEditingName(false)}
              className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              title="Cancel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <h1
              className="font-orbitron font-bold text-lg sm:text-xl tracking-[0.22em] text-slate-100 uppercase"
              style={{
                textShadow:
                  cockpitPhase === "processing"
                    ? "0 0 18px rgba(168,85,247,0.8)"
                    : cockpitPhase === "speaking"
                    ? "0 0 18px rgba(16,185,129,0.8)"
                    : cockpitPhase === "recording"
                    ? "0 0 18px rgba(37,211,102,0.8)"
                    : `0 0 20px ${activeSpectrum.glow}`,
              }}
            >
              {assistantName}
            </h1>
            {onRenameAssistant && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingName(true);
                }}
                className="p-1 rounded-lg text-slate-500 hover:text-sky-300 hover:bg-white/5 transition cursor-pointer"
                title="Change Name"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* LIVE SIGNAL WAVE UNDER MAIN 3D LOGO DURING LISTENING / PROCESSING / SPEAKING */}
        {cockpitPhase !== "galaxy" ? (
          <div className="w-full flex flex-col items-center gap-2 animate-fadeIn">
            {/* Explicit Phase Status Badge */}
            <div className="flex items-center gap-2 font-orbitron font-bold text-xs tracking-[0.22em] uppercase">
              <span
                className={`w-2.5 h-2.5 rounded-full animate-ping ${
                  cockpitPhase === "recording"
                    ? "bg-emerald-400"
                    : cockpitPhase === "processing"
                    ? "bg-purple-400"
                    : "bg-cyan-400"
                }`}
              />
              <span
                className={
                  cockpitPhase === "recording"
                    ? "text-emerald-300"
                    : cockpitPhase === "processing"
                    ? "text-purple-300"
                    : "text-cyan-300"
                }
              >
                {cockpitPhase === "recording"
                  ? "LISTENING"
                  : cockpitPhase === "processing"
                  ? "PROCESSING"
                  : "SPEAKING"}
              </span>
              {cockpitPhase === "recording" && (
                <span className="font-mono text-xs text-slate-300 tabular-nums ml-1">
                  {formatWaTimer(recordingSeconds)}
                </span>
              )}
            </div>

            {/* Signal Waveform Strip Directly Below Main Logo */}
            <div
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-full bg-[#09121e]/90 border shadow-2xl ${
                cockpitPhase === "recording"
                  ? "border-emerald-500/50 shadow-[0_0_32px_rgba(16,185,129,0.28)]"
                  : cockpitPhase === "processing"
                  ? "border-purple-500/50 shadow-[0_0_32px_rgba(168,85,247,0.28)]"
                  : "border-cyan-400/50 shadow-[0_0_32px_rgba(0,240,255,0.28)]"
              }`}
            >
              <div className="flex-1 flex items-center justify-center gap-[3px] h-9 overflow-hidden">
                {signalBars.map((heightPct, idx) => (
                  <div
                    key={idx}
                    className="w-[3px] rounded-full transition-all duration-75 shrink-0"
                    style={{
                      height: `${Math.max(5, Math.round((heightPct / 100) * 32))}px`,
                      backgroundColor:
                        cockpitPhase === "recording"
                          ? heightPct > 36
                            ? "#25d366"
                            : "#64748b"
                          : cockpitPhase === "processing"
                          ? idx % 2 === 0
                            ? "#c084fc"
                            : "#f59e0b"
                          : idx % 2 === 0
                          ? "#00f0ff"
                          : "#10b981",
                    }}
                  />
                ))}
              </div>

              {cockpitPhase === "recording" && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={onCancelRecording}
                    className="p-2 rounded-full bg-rose-950/90 hover:bg-rose-900 border border-rose-500/40 text-rose-300 transition cursor-pointer"
                    title="Cancel"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={onSendRecording}
                    className="p-2 rounded-full bg-[#00a884] hover:bg-[#06cf9c] text-slate-950 transition cursor-pointer"
                    title="Send"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {cockpitPhase === "recording" && (
              <div className="text-[11px] font-mono text-emerald-200/90 text-center">
                {liveTranscript
                  ? `"${liveTranscript}"`
                  : `${assistantName} aapki awaaz sun ${voiceGender === "male" ? "raha hai" : "rahi hai"}...`}
              </div>
            )}
            {cockpitPhase === "processing" && (
              <div className="text-[11px] font-mono text-purple-200/90 text-center">
                Command execute aur process ho rahi hai...
              </div>
            )}
            {cockpitPhase === "speaking" && (
              <div className="text-[11px] font-mono text-cyan-200/90 text-center">
                {assistantName} jawab de {voiceGender === "male" ? "raha hai" : "rahi hai"}...
              </div>
            )}
          </div>
        ) : (
          <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
            {wakeReady ? (
              <span>Say &quot;Jarvis&quot; or tap logo to speak</span>
            ) : (
              <button
                type="button"
                onClick={onPrimeWakeMic}
                className="text-amber-300 hover:text-amber-200 underline underline-offset-4 cursor-pointer"
              >
                Tap here to enable &quot;Jarvis&quot; mic
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
