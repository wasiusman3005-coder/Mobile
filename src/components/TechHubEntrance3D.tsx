import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { soundEffects } from "../services/soundEffects";

interface TechHubEntrance3DProps {
  isOpen: boolean;
  onComplete: () => void;
  maleName?: string;
  femaleName?: string;
}

interface CubeTarget {
  scatterPos: THREE.Vector3;
  scatterRot: THREE.Euler;
  hubPos: THREE.Vector3;
  color: THREE.Color;
}

function buildStealthHullGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 2.35); // Razor nose tip
  shape.lineTo(0.42, 0.9);
  shape.lineTo(0.85, -0.55);
  shape.lineTo(0.68, -1.65);
  shape.lineTo(0.28, -1.85);
  shape.lineTo(-0.28, -1.85);
  shape.lineTo(-0.68, -1.65);
  shape.lineTo(-0.85, -0.55);
  shape.lineTo(-0.42, 0.9);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.34,
    bevelEnabled: true,
    bevelThickness: 0.14,
    bevelSize: 0.12,
    bevelSegments: 2,
  });
  geo.rotateX(Math.PI / 2);
  geo.center();
  return geo;
}

function buildSweptWingGeometry(side: 1 | -1): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.45);
  shape.lineTo(side * 2.35, -0.85);
  shape.lineTo(side * 2.48, -1.35);
  shape.lineTo(side * 0.45, -1.1);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.08,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.025,
    bevelSegments: 1,
  });
  geo.rotateX(Math.PI / 2);
  return geo;
}

export const TechHubEntrance3D: React.FC<TechHubEntrance3DProps> = ({
  isOpen,
  onComplete,
  maleName = "Wasu",
  femaleName = "Wasi ki Jan",
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [phaseLabel, setPhaseLabel] = useState("ORBITAL CRUISE • AUTOPILOT TRAJECTORY ENGAGED");
  const [fadingOut, setFadingOut] = useState(false);
  const doneRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!isOpen) {
      doneRef.current = false;
      setFadingOut(false);
      return;
    }

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      onCompleteRef.current();
      return;
    }

    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      });
    } catch {
      onCompleteRef.current();
      return;
    }

    const gl = renderer.getContext();
    const rendererStr = String(gl.getParameter(gl.RENDERER) || "");
    const isSoftwareGl = /SwiftShader|llvmpipe|softpipe/i.test(rendererStr);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSoftwareGl ? 1 : 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const onContextLost = (ev: Event) => {
      ev.preventDefault();
      if (!doneRef.current) {
        doneRef.current = true;
        onCompleteRef.current();
      }
    };
    renderer.domElement.addEventListener("webglcontextlost", onContextLost);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020612);
    scene.fog = new THREE.FogExp2(0x020612, 0.011);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envRT = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envRT.texture;

    const camera = new THREE.PerspectiveCamera(58, width / height, 0.1, 260);
    camera.position.set(-7, 3.8, 17);

    // Three-point Orbital & Hub Lighting
    const ambient = new THREE.AmbientLight(0x94c9ff, 0.65);
    scene.add(ambient);
    const keyLight = new THREE.DirectionalLight(0xf8fafc, 2.1);
    keyLight.position.set(12, 16, 14);
    scene.add(keyLight);
    const rimLight = new THREE.PointLight(0x00f0ff, 18, 55);
    rimLight.position.set(-8, 6, 6);
    scene.add(rimLight);
    const warmRimLight = new THREE.PointLight(0xf59e0b, 12, 48);
    warmRimLight.position.set(8, -2, 6);
    scene.add(warmRimLight);

    // 1. High-Speed Warp Starfield (InstancedMesh)
    const starCount = isSoftwareGl ? 220 : 380;
    const starGeo = new THREE.SphereGeometry(0.052, 6, 6);
    const starMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0 });
    const starsMesh = new THREE.InstancedMesh(starGeo, starMat, starCount);
    const starPositions = Array.from({ length: starCount }, () => ({
      x: (Math.random() - 0.5) * 75,
      y: (Math.random() - 0.5) * 48,
      z: -Math.random() * 95 + 16,
      s: 0.55 + Math.random() * 1.45,
    }));
    scene.add(starsMesh);

    // 2. Realistic Textured Earth + Dual Atmosphere Limb + Cloud Band + Tech Hub Landing Pad
    const earthCanvas = document.createElement("canvas");
    earthCanvas.width = 1024;
    earthCanvas.height = 512;
    const eCtx = earthCanvas.getContext("2d");
    if (eCtx) {
      const ocean = eCtx.createLinearGradient(0, 0, 0, 512);
      ocean.addColorStop(0, "#062540");
      ocean.addColorStop(0.5, "#0c4a6e");
      ocean.addColorStop(1, "#062540");
      eCtx.fillStyle = ocean;
      eCtx.fillRect(0, 0, 1024, 512);

      // Continents
      eCtx.fillStyle = "#15803d";
      [
        [185, 140, 110, 68],
        [270, 260, 65, 92],
        [490, 130, 152, 72],
        [530, 240, 84, 96],
        [680, 136, 184, 86],
        [810, 315, 88, 56],
      ].forEach(([cx, cy, rx, ry]) => {
        eCtx.beginPath();
        eCtx.ellipse(cx, cy, rx, ry, 0.22, 0, Math.PI * 2);
        eCtx.fill();
      });

      // Soft swirling cloud bands
      eCtx.fillStyle = "rgba(255, 255, 255, 0.18)";
      for (let i = 0; i < 24; i++) {
        eCtx.beginPath();
        eCtx.ellipse(
          (i * 117) % 1024,
          40 + ((i * 53) % 420),
          65 + (i % 5) * 28,
          12 + (i % 3) * 6,
          0.12,
          0,
          Math.PI * 2
        );
        eCtx.fill();
      }

      // Subtle golden orbital grid arcs
      eCtx.strokeStyle = "rgba(56, 189, 248, 0.28)";
      eCtx.lineWidth = 1.2;
      for (let i = 0; i < 1024; i += 64) {
        eCtx.beginPath();
        eCtx.moveTo(i, 0);
        eCtx.lineTo(i, 512);
        eCtx.stroke();
      }
    }
    const earthTex = new THREE.CanvasTexture(earthCanvas);
    earthTex.colorSpace = THREE.SRGBColorSpace;
    earthTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const earthGroup = new THREE.Group();
    earthGroup.position.set(1.2, -3.4, -36);
    const earthGeo = new THREE.SphereGeometry(7.4, 40, 28);
    const earthMat = new THREE.MeshStandardMaterial({
      map: earthTex,
      roughness: 0.48,
      metalness: 0.12,
      emissive: new THREE.Color(0x041e34),
      emissiveIntensity: 0.42,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthGroup.add(earthMesh);

    const haloGeo = new THREE.SphereGeometry(7.78, 32, 24);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.24,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    });
    earthGroup.add(new THREE.Mesh(haloGeo, haloMat));
    scene.add(earthGroup);

    // Tech Hub Holographic Landing Pad Ring
    const padGroup = new THREE.Group();
    padGroup.position.set(0, -1.9, -2.5);
    const padRingGeo = new THREE.RingGeometry(1.9, 2.35, 48);
    padRingGeo.rotateX(-Math.PI / 2);
    const padRingMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const padRingMesh = new THREE.Mesh(padRingGeo, padRingMat);
    const padInnerGeo = new THREE.RingGeometry(0.9, 1.08, 36);
    padInnerGeo.rotateX(-Math.PI / 2);
    const padInnerMat = new THREE.MeshBasicMaterial({
      color: 0xa855f7,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const padInnerMesh = new THREE.Mesh(padInnerGeo, padInnerMat);
    padGroup.add(padRingMesh, padInnerMesh);
    scene.add(padGroup);

    // 3. Ultra-Realistic Multi-Part Composite Spaceship (Fuselage, Swept Wings, Canopy, Twin Pilots, Nachburner Cones, Landing Struts)
    const shipRoot = new THREE.Group();
    const shipModel = new THREE.Group();
    shipRoot.add(shipModel);

    const titaniumMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.88,
      roughness: 0.22,
    });
    const darkCarbonMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.72,
      roughness: 0.38,
    });
    const seamGlowMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 1.8,
      metalness: 0.5,
      roughness: 0.2,
    });
    const glassCanopyMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      metalness: 0.1,
      roughness: 0.08,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      transparent: true,
      opacity: 0.62,
    });

    // Main stealth fuselage (ExtrudeGeometry)
    const fuselageGeo = buildStealthHullGeometry();
    const fuselageMesh = new THREE.Mesh(fuselageGeo, titaniumMat);
    shipModel.add(fuselageMesh);

    // Spine ridge + tail fin
    const spineGeo = new THREE.BoxGeometry(0.32, 0.28, 2.2);
    const spineMesh = new THREE.Mesh(spineGeo, darkCarbonMat);
    spineMesh.position.set(0, 0.26, 0.55);
    shipModel.add(spineMesh);

    const dorsalFinGeo = new THREE.ConeGeometry(0.14, 0.95, 4);
    dorsalFinGeo.rotateX(-Math.PI * 0.36);
    const dorsalFin = new THREE.Mesh(dorsalFinGeo, titaniumMat);
    dorsalFin.position.set(0, 0.64, 1.38);
    shipModel.add(dorsalFin);

    // Swept Wings + Winglets
    const leftWingGeo = buildSweptWingGeometry(-1);
    const rightWingGeo = buildSweptWingGeometry(1);
    const leftWing = new THREE.Mesh(leftWingGeo, titaniumMat);
    const rightWing = new THREE.Mesh(rightWingGeo, titaniumMat);
    leftWing.position.set(-0.42, -0.02, 0.25);
    rightWing.position.set(0.42, -0.02, 0.25);
    shipModel.add(leftWing, rightWing);

    const wingletGeo = new THREE.BoxGeometry(0.08, 0.55, 0.68);
    const leftWinglet = new THREE.Mesh(wingletGeo, darkCarbonMat);
    leftWinglet.position.set(-2.78, 0.24, 1.32);
    leftWinglet.rotation.z = 0.28;
    const rightWinglet = new THREE.Mesh(wingletGeo, darkCarbonMat);
    rightWinglet.position.set(2.78, 0.24, 1.32);
    rightWinglet.rotation.z = -0.28;
    shipModel.add(leftWinglet, rightWinglet);

    // Wing Leading-Edge Energy Strips & Navigation Strobes
    const wingTrimGeo = new THREE.BoxGeometry(2.3, 0.045, 0.07);
    const leftTrim = new THREE.Mesh(wingTrimGeo, seamGlowMat);
    leftTrim.position.set(-1.55, 0.04, 0.62);
    leftTrim.rotation.y = 0.52;
    const rightTrim = new THREE.Mesh(wingTrimGeo, seamGlowMat);
    rightTrim.position.set(1.55, 0.04, 0.62);
    rightTrim.rotation.y = -0.52;
    shipModel.add(leftTrim, rightTrim);

    const navGeo = new THREE.SphereGeometry(0.065, 8, 8);
    const navLeftMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e });
    const navRightMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    const navLeft = new THREE.Mesh(navGeo, navLeftMat);
    navLeft.position.set(-2.85, 0.52, 1.35);
    const navRight = new THREE.Mesh(navGeo, navRightMat);
    navRight.position.set(2.85, 0.52, 1.35);
    shipModel.add(navLeft, navRight);

    // Panoramic Cockpit Canopy + Twin Commander Seats (Wasi ki Jan Cyan + Wasu Gold)
    const canopyGeo = new THREE.SphereGeometry(0.44, 20, 14);
    canopyGeo.scale(1.05, 0.58, 1.75);
    const canopyMesh = new THREE.Mesh(canopyGeo, glassCanopyMat);
    canopyMesh.position.set(0, 0.28, -0.45);
    shipModel.add(canopyMesh);

    const pilotGeo = new THREE.SphereGeometry(0.11, 10, 10);
    const femalePilotMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const malePilotMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const femalePilot = new THREE.Mesh(pilotGeo, femalePilotMat);
    femalePilot.position.set(-0.16, 0.29, -0.42);
    const malePilot = new THREE.Mesh(pilotGeo, malePilotMat);
    malePilot.position.set(0.16, 0.29, -0.42);
    shipModel.add(femalePilot, malePilot);

    // Twin Engine Nacelles + Dynamic Volumetric Plasma Afterburners
    const nacelleGeo = new THREE.CylinderGeometry(0.22, 0.26, 0.95, 14);
    nacelleGeo.rotateX(Math.PI / 2);
    const plumeCoreGeo = new THREE.ConeGeometry(0.16, 1.45, 12);
    plumeCoreGeo.rotateX(Math.PI / 2);
    plumeCoreGeo.translate(0, 0, 0.72);
    const plumeOuterGeo = new THREE.ConeGeometry(0.27, 2.25, 14);
    plumeOuterGeo.rotateX(Math.PI / 2);
    plumeOuterGeo.translate(0, 0, 1.12);

    const plumeCoreMat = new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const plumeOuterMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const plumeGroups: THREE.Group[] = [];
    [-0.58, 0.58].forEach((tx) => {
      const nac = new THREE.Mesh(nacelleGeo, darkCarbonMat);
      nac.position.set(tx, 0.02, 1.52);
      shipModel.add(nac);

      const pGrp = new THREE.Group();
      pGrp.position.set(tx, 0.02, 1.98);
      pGrp.add(new THREE.Mesh(plumeCoreGeo, plumeCoreMat));
      pGrp.add(new THREE.Mesh(plumeOuterGeo, plumeOuterMat));
      shipModel.add(pGrp);
      plumeGroups.push(pGrp);
    });

    const enginePointLight = new THREE.PointLight(0x00f0ff, 8, 12);
    enginePointLight.position.set(0, 0.1, 2.5);
    shipModel.add(enginePointLight);

    // Deployable Landing Gear Struts
    const strutGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.55, 8);
    const landingGearGroup = new THREE.Group();
    const strutPositions: [number, number, number][] = [
      [0, -0.22, -1.05],
      [-0.82, -0.22, 0.88],
      [0.82, -0.22, 0.88],
    ];
    strutPositions.forEach(([sx, sy, sz]) => {
      const st = new THREE.Mesh(strutGeo, seamGlowMat);
      st.position.set(sx, sy, sz);
      landingGearGroup.add(st);
    });
    landingGearGroup.scale.y = 0.01;
    landingGearGroup.visible = false;
    shipModel.add(landingGearGroup);

    // Atmospheric Reentry Bow Plasma Shield
    const shieldGeo = new THREE.SphereGeometry(2.15, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.46);
    shieldGeo.rotateX(-Math.PI / 2);
    const shieldMat = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const reentryShield = new THREE.Mesh(shieldGeo, shieldMat);
    reentryShield.position.set(0, 0, -0.8);
    shipModel.add(reentryShield);

    scene.add(shipRoot);

    // Smooth Aerodynamic S-Curve Approach Trajectory toward Technology Hub Pad
    const flightCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-9.5, 4.4, 15.0),
      new THREE.Vector3(-3.8, 2.3, 7.5),
      new THREE.Vector3(3.6, 1.0, 1.8),
      new THREE.Vector3(1.1, -0.45, -1.6),
      new THREE.Vector3(0.0, -1.35, -2.5),
    ]);

    // 4. Tech Hub Cube Matrix (64 Cubes scattering from landing pad then assembling from every direction)
    const cubeCount = 64;
    const cubeGeo = new THREE.BoxGeometry(0.76, 0.76, 0.76);
    const cubeMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.84,
      roughness: 0.22,
    });
    const cubesMesh = new THREE.InstancedMesh(cubeGeo, cubeMat, cubeCount);
    cubesMesh.visible = false;
    const cubeTargets: CubeTarget[] = [];
    for (let i = 0; i < cubeCount; i++) {
      const theta = (i / cubeCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.65;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 9.5 + Math.random() * 14;
      const scatterPos = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * radius,
        Math.cos(phi) * radius * 0.75,
        Math.sin(phi) * Math.sin(theta) * radius - 2.5
      );
      const scatterRot = new THREE.Euler(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      );

      // Build curved Tech Hub Bay Ring + Overhead Panoramic Wall
      const ringAngle = (i / cubeCount) * Math.PI * 2;
      const layer = i % 4;
      const ringR = layer === 0 ? 4.8 : layer === 1 ? 5.6 : 6.4;
      const hubY = layer === 0 ? -2.2 : layer === 1 ? 0.1 : layer === 2 ? 2.1 : -1.0;
      const hubPos = new THREE.Vector3(
        Math.cos(ringAngle) * ringR,
        hubY,
        Math.sin(ringAngle) * ringR * 0.75 - 2.5
      );
      const col = new THREE.Color(
        i % 3 === 0 ? 0x00f0ff : i % 3 === 1 ? 0x8b5cf6 : 0x0f172a
      );
      cubesMesh.setColorAt(i, col);
      cubeTargets.push({ scatterPos, scatterRot, hubPos, color: col });
    }
    if (cubesMesh.instanceColor) cubesMesh.instanceColor.needsUpdate = true;
    scene.add(cubesMesh);

    // 5. Lightning & Particle Converging Matrix for Dual Character Arrival
    const sparkCount = isSoftwareGl ? 80 : 140;
    const sparkGeo = new THREE.BoxGeometry(0.075, 0.38, 0.075);
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const sparksMesh = new THREE.InstancedMesh(sparkGeo, sparkMat, sparkCount);
    sparksMesh.visible = false;
    const sparkSeeds = Array.from({ length: sparkCount }, (_, idx) => ({
      angle: (idx / sparkCount) * Math.PI * 2,
      radius: 4.8 + Math.random() * 5.2,
      height: (Math.random() - 0.5) * 6.2,
      targetSide: idx % 2 === 0 ? -1.2 : 1.2,
    }));
    scene.add(sparksMesh);

    // Zero-allocation scratch variables for animation loop
    const dummy = new THREE.Object3D();
    const shipPos = new THREE.Vector3();
    const lookAheadPos = new THREE.Vector3();
    const tangentVec = new THREE.Vector3();
    const nextTangentVec = new THREE.Vector3();
    const camTargetPos = new THREE.Vector3();
    const tmpVec = new THREE.Vector3();
    let currentRoll = 0;
    let currentPitch = 0;

    const startTime = performance.now();
    let prevTime = startTime;
    let rafId = 0;
    let lastPhase = 0;

    try {
      soundEffects.playQuantumStartup();
    } catch {}

    const completeSequence = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      setFadingOut(true);
      setTimeout(() => {
        onCompleteRef.current();
      }, 360);
    };

    const animate = (now: number) => {
      const elapsed = Math.max(0, (now - startTime) / 1000);
      const dt = Math.max(0.001, Math.min((now - prevTime) / 1000, 0.05));
      prevTime = now;

      // Animate Warp Stars
      const starStretch = elapsed < 1.9 ? 6.5 : 1.2;
      const starSpeed = elapsed < 1.9 ? 0.62 : 0.14;
      for (let i = 0; i < starCount; i++) {
        const st = starPositions[i];
        st.z += starSpeed;
        if (st.z > 18) st.z = -78;
        dummy.position.set(st.x, st.y, st.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(st.s, st.s, st.s * starStretch);
        dummy.updateMatrix();
        starsMesh.setMatrixAt(i, dummy.matrix);
      }
      starsMesh.instanceMatrix.needsUpdate = true;

      if (elapsed < 2.55) {
        // PHASE A: Real Aerodynamic Flight + Reentry Plasma + Landing Gear Hover Touchdown
        const rawT = THREE.MathUtils.clamp(elapsed / 2.55, 0, 1);
        // Smooth deceleration right before touchdown
        const curvedT = rawT < 0.7 ? rawT : 0.7 + (1 - Math.pow(1 - (rawT - 0.7) / 0.3, 2)) * 0.3;
        const u = THREE.MathUtils.clamp(curvedT, 0.0001, 0.9999);
        const uNext = THREE.MathUtils.clamp(u + 0.04, 0.0001, 0.9999);

        flightCurve.getPointAt(u, shipPos);
        flightCurve.getTangentAt(u, tangentVec);
        flightCurve.getTangentAt(uNext, nextTangentVec);
        lookAheadPos.copy(shipPos).add(tangentVec);

        shipRoot.visible = true;
        shipRoot.position.copy(shipPos);
        shipRoot.lookAt(lookAheadPos);

        // Compute realistic banking roll from lateral curve curvature
        const turnCrossY = tangentVec.z * nextTangentVec.x - tangentVec.x * nextTangentVec.z;
        const targetRoll = THREE.MathUtils.clamp(turnCrossY * 9.5, -0.78, 0.78);
        const flarePitch = rawT > 0.76 ? ((rawT - 0.76) / 0.24) * 0.24 : 0;
        currentRoll = THREE.MathUtils.damp(currentRoll, targetRoll * (1 - flarePitch * 2.5), 6.5, dt);
        currentPitch = THREE.MathUtils.damp(currentPitch, flarePitch, 7.0, dt);
        shipModel.rotation.set(currentPitch, 0, currentRoll);

        // Volumetric thruster plume pulsing
        const thrustIntensity = rawT < 0.75 ? 1.25 : 1.25 - (rawT - 0.75) * 2.4;
        const flicker = 0.92 + Math.sin(elapsed * 42) * 0.14;
        for (let p = 0; p < plumeGroups.length; p++) {
          plumeGroups[p].scale.set(1, 1, Math.max(0.28, thrustIntensity * flicker));
        }
        enginePointLight.intensity = 7 + Math.sin(elapsed * 35) * 3;

        // Atmospheric reentry plasma bow wave during descent into Earth atmosphere
        if (rawT > 0.36 && rawT < 0.74) {
          if (lastPhase < 1) {
            lastPhase = 1;
            setPhaseLabel("ATMOSPHERIC REENTRY • PLASMA HEAT SHIELD ACTIVE");
            try {
              soundEffects.playQuantumWarp();
            } catch {}
          }
          const heatWave = Math.sin(((rawT - 0.36) / 0.38) * Math.PI);
          shieldMat.opacity = heatWave * 0.42;
        } else {
          shieldMat.opacity = THREE.MathUtils.damp(shieldMat.opacity, 0, 8, dt);
        }

        // Deploy landing gear + glowing Tech Hub pad during final flare
        if (rawT > 0.68) {
          if (lastPhase < 2) {
            lastPhase = 2;
            setPhaseLabel("TECH HUB PAD LOCKED • RETRO-THRUST TOUCHDOWN");
          }
          const gearProg = Math.min(1, (rawT - 0.68) / 0.22);
          landingGearGroup.visible = true;
          landingGearGroup.scale.y = Math.max(0.01, gearProg);
          padRingMat.opacity = gearProg * 0.65;
          padInnerMat.opacity = gearProg * 0.55;
          padGroup.rotation.y += dt * 1.4;
        }

        // Earth grows closer smoothly during descent
        earthGroup.position.set(1.2 - rawT * 1.2, -3.4 + rawT * 0.6, -36 + rawT * 26);
        earthMesh.rotation.y += dt * 0.18;

        // Cinematic Inertial Chase Camera + Dynamic FOV
        camTargetPos.set(shipPos.x * 0.45 - 1.2, shipPos.y + 1.45, shipPos.z + 5.6);
        camera.position.x = THREE.MathUtils.damp(camera.position.x, camTargetPos.x, 4.5, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, camTargetPos.y, 4.5, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, camTargetPos.z, 4.5, dt);
        camera.lookAt(shipPos.x * 0.7, shipPos.y - 0.15, shipPos.z - 2.6);

        const targetFov = rawT < 0.55 ? 65 : 56;
        camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 4, dt);
        camera.updateProjectionMatrix();
      } else if (elapsed < 3.55) {
        // PHASE B: Spaceship & Landing Pad Transform into 64 Scattering Cube Matrix Boxes
        if (lastPhase < 3) {
          lastPhase = 3;
          setPhaseLabel("DECONSTRUCTING LANDING BAY INTO MODULAR CUBES");
          try {
            soundEffects.playSubBassPulse();
          } catch {}
        }
        const p = (elapsed - 2.55) / 1.0;
        const ease = 1 - Math.pow(1 - p, 2);
        shipRoot.scale.setScalar(Math.max(0.01, 1 - p * 1.15));
        if (p > 0.8) shipRoot.visible = false;
        earthGroup.position.y -= dt * 3.5;
        earthGroup.scale.setScalar(1 + p * 1.5);
        padRingMat.opacity = (1 - ease) * 0.5;
        padInnerMat.opacity = (1 - ease) * 0.4;

        cubesMesh.visible = true;
        for (let i = 0; i < cubeCount; i++) {
          const ct = cubeTargets[i];
          tmpVec.set(0, -1.2, -2.5).lerp(ct.scatterPos, ease);
          dummy.position.copy(tmpVec);
          dummy.rotation.set(ct.scatterRot.x * ease, ct.scatterRot.y * ease, ct.scatterRot.z * ease);
          dummy.scale.setScalar(0.5 + ease * 0.58);
          dummy.updateMatrix();
          cubesMesh.setMatrixAt(i, dummy.matrix);
        }
        cubesMesh.instanceMatrix.needsUpdate = true;
        camera.position.x = THREE.MathUtils.damp(camera.position.x, 0, 5, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, 0.7, 5, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, 9.2, 5, dt);
        camera.lookAt(0, 0, -2.5);
      } else if (elapsed < 4.55) {
        // PHASE C: Cubes Magnetize from All Directions to Assemble Technology Hub
        if (lastPhase < 4) {
          lastPhase = 4;
          setPhaseLabel(`ASSEMBLING TECHNOLOGY HUB • ${femaleName.toUpperCase()} & ${maleName.toUpperCase()}`);
        }
        const p = (elapsed - 3.55) / 1.0;
        const ease = 1 - Math.pow(1 - p, 3);
        earthGroup.visible = false;
        shipRoot.visible = false;
        padGroup.visible = false;

        for (let i = 0; i < cubeCount; i++) {
          const ct = cubeTargets[i];
          tmpVec.copy(ct.scatterPos).lerp(ct.hubPos, ease);
          dummy.position.copy(tmpVec);
          dummy.rotation.set(
            ct.scatterRot.x * (1 - ease),
            ct.scatterRot.y * (1 - ease) + elapsed * 0.25,
            ct.scatterRot.z * (1 - ease)
          );
          dummy.scale.setScalar(1.05 - ease * 0.14);
          dummy.updateMatrix();
          cubesMesh.setMatrixAt(i, dummy.matrix);
        }
        cubesMesh.instanceMatrix.needsUpdate = true;
        camera.position.set(0, 0.6, 9.0 - ease * 1.8);
        camera.lookAt(0, 0, -2.5);
      } else if (elapsed < 5.35) {
        // PHASE D: Lightning & Particles Materialize Dual Characters inside Hub
        if (lastPhase < 5) {
          lastPhase = 5;
          setPhaseLabel("LIGHTNING CONVERGENCE • COMMAND CONSOLES ONLINE");
          try {
            soundEffects.playSuccessChime();
          } catch {}
        }
        const p = (elapsed - 4.55) / 0.8;
        sparksMesh.visible = true;
        for (let i = 0; i < sparkCount; i++) {
          const sp = sparkSeeds[i];
          const converge = Math.min(1, p * 1.15);
          const ang = sp.angle + elapsed * 7.5;
          const r = sp.radius * (1 - converge * 0.84);
          dummy.position.set(
            sp.targetSide * converge + Math.cos(ang) * r,
            sp.height * (1 - converge * 0.74),
            -2.0 + Math.sin(ang) * r
          );
          dummy.rotation.set(elapsed * 8, ang, 0);
          dummy.scale.set(1, 0.8 + Math.sin(elapsed * 24 + i) * 0.7, 1);
          dummy.updateMatrix();
          sparksMesh.setMatrixAt(i, dummy.matrix);
        }
        sparksMesh.instanceMatrix.needsUpdate = true;
        camera.position.set(0, 0.4, 7.2 - p * 2.4);
        camera.lookAt(0, 0, -2.5);
      } else {
        completeSequence();
        return;
      }

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      starGeo.dispose();
      starMat.dispose();
      earthTex.dispose();
      earthGeo.dispose();
      earthMat.dispose();
      haloGeo.dispose();
      haloMat.dispose();
      padRingGeo.dispose();
      padRingMat.dispose();
      padInnerGeo.dispose();
      padInnerMat.dispose();
      fuselageGeo.dispose();
      spineGeo.dispose();
      dorsalFinGeo.dispose();
      leftWingGeo.dispose();
      rightWingGeo.dispose();
      wingletGeo.dispose();
      wingTrimGeo.dispose();
      navGeo.dispose();
      navLeftMat.dispose();
      navRightMat.dispose();
      canopyGeo.dispose();
      pilotGeo.dispose();
      femalePilotMat.dispose();
      malePilotMat.dispose();
      nacelleGeo.dispose();
      plumeCoreGeo.dispose();
      plumeOuterGeo.dispose();
      plumeCoreMat.dispose();
      plumeOuterMat.dispose();
      strutGeo.dispose();
      shieldGeo.dispose();
      shieldMat.dispose();
      titaniumMat.dispose();
      darkCarbonMat.dispose();
      seamGlowMat.dispose();
      glassCanopyMat.dispose();
      cubeGeo.dispose();
      cubeMat.dispose();
      sparkGeo.dispose();
      sparkMat.dispose();
      envRT.dispose();
      roomEnv.dispose();
      pmrem.dispose();
      renderer.dispose();
    };
  }, [isOpen, maleName, femaleName]);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-[95] bg-[#020612] transition-opacity duration-300 select-none ${
        fadingOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      <div ref={mountRef} className="w-full h-full" />

      <div className="fixed top-4 left-4 right-4 z-10 flex items-center justify-between gap-3 pointer-events-none">
        <div className="px-3.5 py-2 rounded-xl bg-black/60 border border-cyan-400/35 backdrop-blur-md">
          <div className="font-orbitron font-bold text-xs text-cyan-300 tracking-wider">
            WASI&apos;S TECHNOLOGY HUB
          </div>
          <div className="font-mono text-[10px] text-slate-300 mt-0.5">{phaseLabel}</div>
        </div>

        <button
          type="button"
          onClick={() => {
            if (doneRef.current) return;
            doneRef.current = true;
            setFadingOut(true);
            setTimeout(onComplete, 200);
          }}
          className="pointer-events-auto px-3.5 py-2 rounded-xl bg-slate-900/80 border border-cyan-400/40 hover:bg-cyan-500 hover:text-slate-950 font-orbitron font-bold text-xs text-cyan-200 cursor-pointer transition"
        >
          Enter Hub
        </button>
      </div>
    </div>
  );
};
