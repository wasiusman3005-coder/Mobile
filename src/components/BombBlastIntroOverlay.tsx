import React, { useEffect, useRef, useState } from "react";
import { soundEffects } from "../services/soundEffects";

interface BombBlastIntroOverlayProps {
  onComplete: () => void;
}

interface Shard {
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX: number;
  targetY: number;
  size: number;
  rot: number;
  vRot: number;
  color: string;
  sides: number;
}

export const BombBlastIntroOverlay: React.FC<BombBlastIntroOverlayProps> = ({ onComplete }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [fadingOut, setFadingOut] = useState(false);
  const doneRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      onCompleteRef.current();
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId = 0;
    let width = window.innerWidth;
    let height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const cx = width * 0.5;
    const cy = height * 0.48;
    const palette = ["#00f0ff", "#8b5cf6", "#38bdf8", "#f59e0b", "#e2e8f0"];
    const shards: Shard[] = Array.from({ length: 56 }, (_, idx) => {
      const angle = (idx / 56) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
      const speed = 340 + Math.random() * 440;
      const isLeftPanel = idx % 2 === 0;
      const targetPanelX = isLeftPanel ? width * 0.31 : width * 0.69;
      const targetPanelY = height * 0.53;
      const spreadX = (Math.random() - 0.5) * Math.min(340, width * 0.32);
      const spreadY = (Math.random() - 0.5) * Math.min(360, height * 0.44);
      return {
        x: cx + Math.cos(angle) * 24,
        y: cy + Math.sin(angle) * 24,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 260, // Blast upward into air!
        targetX: targetPanelX + spreadX,
        targetY: targetPanelY + spreadY,
        size: 7 + Math.random() * 14,
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 10,
        color: palette[idx % palette.length],
        sides: idx % 3 === 0 ? 4 : 3,
      };
    });

    const startTime = performance.now();
    let prevTime = startTime;
    let blastPlayed = false;

    const finishIntro = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      setFadingOut(true);
      setTimeout(() => {
        onCompleteRef.current();
      }, 280);
    };

    const drawPolygon = (x: number, y: number, r: number, sides: number, rot: number) => {
      ctx.beginPath();
      for (let i = 0; i < sides; i++) {
        const a = rot + (i / sides) * Math.PI * 2;
        const px = x + Math.cos(a) * r;
        const py = y + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    };

    const renderFrame = (now: number) => {
      const elapsed = Math.max(0, (now - startTime) / 1000);
      const dt = Math.max(0.001, Math.min(0.05, (now - prevTime) / 1000));
      prevTime = now;

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "rgba(3, 6, 16, 0.96)";
      ctx.fillRect(0, 0, width, height);

      // Subtle futuristic horizon grid
      ctx.strokeStyle = "rgba(0, 240, 255, 0.06)";
      ctx.lineWidth = 1;
      for (let gx = 0; gx < width; gx += 48) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, height);
        ctx.stroke();
      }
      for (let gy = 0; gy < height; gy += 48) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(width, gy);
        ctx.stroke();
      }

      if (elapsed < 1.08) {
        // PHASE 1: Wasi's Jarvis Bomb Emblem Charge-Up
        const p = elapsed / 1.08;
        const pulse = 1 + Math.sin(elapsed * 22) * (0.04 + p * 0.08);
        const coreR = Math.min(width, height) * 0.12 * pulse;

        // Fuse wire + burning spark at top
        ctx.save();
        ctx.translate(cx, cy);
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(0, -coreR);
        ctx.quadraticCurveTo(coreR * 0.45, -coreR * 1.48, coreR * 0.85, -coreR * 1.32);
        ctx.stroke();

        const sparkX = coreR * (0.85 - p * 0.72);
        const sparkY = -coreR * (1.32 - p * 0.18);
        const sparkGlow = ctx.createRadialGradient(sparkX, sparkY, 1, sparkX, sparkY, 26);
        sparkGlow.addColorStop(0, "#ffffff");
        sparkGlow.addColorStop(0.35, "#fbbf24");
        sparkGlow.addColorStop(1, "rgba(245, 158, 11, 0)");
        ctx.fillStyle = sparkGlow;
        ctx.beginPath();
        ctx.arc(sparkX, sparkY, 26, 0, Math.PI * 2);
        ctx.fill();

        // Outer orbital rings
        ctx.strokeStyle = p > 0.7 ? "rgba(245, 158, 11, 0.8)" : "rgba(0, 240, 255, 0.7)";
        ctx.lineWidth = 2;
        ctx.setLineDash([12, 8]);
        ctx.save();
        ctx.rotate(elapsed * 3.5);
        ctx.beginPath();
        ctx.arc(0, 0, coreR * 1.32, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        ctx.setLineDash([]);

        // Metallic bomb casing
        const orbGrad = ctx.createRadialGradient(-coreR * 0.25, -coreR * 0.25, coreR * 0.1, 0, 0, coreR);
        orbGrad.addColorStop(0, "#1e293b");
        orbGrad.addColorStop(0.6, "#090f24");
        orbGrad.addColorStop(1, "#020617");
        ctx.fillStyle = orbGrad;
        ctx.beginPath();
        ctx.arc(0, 0, coreR, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = p > 0.75 ? "#f59e0b" : "#00f0ff";
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Glowing core seam
        ctx.strokeStyle = `rgba(0, 240, 255, ${0.45 + p * 0.55})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, coreR * 0.62, -Math.PI * p, Math.PI * p);
        ctx.stroke();

        // Brand Crest "WASI'S JARVIS"
        ctx.fillStyle = "#f8fafc";
        ctx.textAlign = "center";
        ctx.font = `800 ${Math.max(13, Math.round(coreR * 0.24))}px Orbitron, sans-serif`;
        ctx.fillText("WASI'S", 0, -coreR * 0.06);
        ctx.fillStyle = p > 0.75 ? "#fbbf24" : "#00f0ff";
        ctx.font = `800 ${Math.max(15, Math.round(coreR * 0.29))}px Orbitron, sans-serif`;
        ctx.fillText("JARVIS", 0, coreR * 0.24);
        ctx.restore();
      } else if (elapsed < 1.56) {
        // PHASE 2: Detonation! Shards blast high into the air
        if (!blastPlayed) {
          blastPlayed = true;
          try {
            soundEffects.playQuantumWarp();
          } catch {}
        }
        const bp = (elapsed - 1.08) / 0.48;
        const ringR = bp * Math.max(width, height) * 0.68;
        ctx.strokeStyle = `rgba(0, 240, 255, ${1 - bp})`;
        ctx.lineWidth = Math.max(2, 14 * (1 - bp));
        ctx.beginPath();
        ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
        ctx.stroke();

        const ringR2 = bp * Math.max(width, height) * 0.45;
        ctx.strokeStyle = `rgba(139, 92, 246, ${0.9 - bp * 0.9})`;
        ctx.lineWidth = 6 * (1 - bp);
        ctx.beginPath();
        ctx.arc(cx, cy, ringR2, 0, Math.PI * 2);
        ctx.stroke();

        for (const s of shards) {
          s.x += s.vx * dt;
          s.y += s.vy * dt;
          s.vy += 420 * dt;
          s.rot += s.vRot * dt;

          ctx.save();
          ctx.fillStyle = s.color;
          ctx.shadowColor = s.color;
          ctx.shadowBlur = 12;
          drawPolygon(s.x, s.y, s.size, s.sides, s.rot);
          ctx.fill();
          ctx.restore();
        }
      } else if (elapsed < 2.45) {
        // PHASE 3: Airborne shards magnetically converge & form the 2 dashing Lock Screen frames
        const ap = Math.min(1, (elapsed - 1.56) / 0.85);
        const ease = 1 - Math.pow(1 - ap, 3);

        // Emerging Lock Screen wireframes
        const colW = Math.min(460, width * 0.39);
        const colH = Math.min(420, height * 0.56);
        [width * 0.31, width * 0.69].forEach((tx, idx) => {
          const rx = tx - colW * 0.5;
          const ry = height * 0.53 - colH * 0.5;
          ctx.save();
          ctx.strokeStyle = `rgba(0, 240, 255, ${ease * 0.65})`;
          ctx.fillStyle = `rgba(8, 14, 28, ${ease * 0.5})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(rx, ry, colW, colH, 16);
          ctx.fill();
          ctx.stroke();
          if (idx === 0) {
            ctx.beginPath();
            ctx.arc(tx, ry + colH * 0.44, 72 * ease, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.restore();
        });

        for (const s of shards) {
          s.x += (s.targetX - s.x) * Math.min(1, dt * 8.5);
          s.y += (s.targetY - s.y) * Math.min(1, dt * 8.5);
          s.rot += s.vRot * dt * (1 - ease);

          ctx.save();
          ctx.globalAlpha = 1 - ease * 0.45;
          ctx.fillStyle = s.color;
          ctx.shadowColor = s.color;
          ctx.shadowBlur = 8;
          drawPolygon(s.x, s.y, s.size * (1 - ease * 0.35), s.sides, s.rot);
          ctx.fill();
          ctx.restore();
        }
      } else {
        finishIntro();
        return;
      }

      rafId = requestAnimationFrame(renderFrame);
    };

    rafId = requestAnimationFrame(renderFrame);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div
      className={`fixed inset-0 z-[80] bg-[#030610] transition-opacity duration-300 ${
        fadingOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      <canvas ref={canvasRef} className="block w-full h-full" />
      <button
        type="button"
        onClick={() => {
          if (doneRef.current) return;
          doneRef.current = true;
          setFadingOut(true);
          setTimeout(onComplete, 180);
        }}
        className="fixed top-4 right-4 z-10 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-500/35 hover:border-cyan-400 text-[11px] font-mono text-slate-300 hover:text-white cursor-pointer transition"
      >
        Skip Intro
      </button>
    </div>
  );
};
