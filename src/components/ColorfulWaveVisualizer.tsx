import React, { useEffect, useRef } from "react";
import type { WaveVisualizerStyleId } from "../types";
import { WAVE_COLOR_THEMES } from "../data/oneUi9Catalog";

interface ColorfulWaveVisualizerProps {
  styleId?: WaveVisualizerStyleId;
  colorThemeId?: string;
  audioLevel?: number; // 0..1
  phase?: "listening" | "processing" | "speaking" | "idle";
  height?: number;
  className?: string;
  compact?: boolean;
}

export const ColorfulWaveVisualizer: React.FC<ColorfulWaveVisualizerProps> = ({
  styleId = "rainbow_prism",
  colorThemeId = "aurora_cyan",
  audioLevel = 0.25,
  phase = "listening",
  height = 42,
  className = "",
  compact = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const levelRef = useRef(audioLevel);
  const phaseRef = useRef(phase);

  useEffect(() => {
    levelRef.current = audioLevel;
  }, [audioLevel]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const palette =
      WAVE_COLOR_THEMES.find((t) => t.id === colorThemeId)?.colors ||
      ["#00f0ff", "#8b5cf6", "#ec4899"];

    let rafId = 0;
    let tick = 0;
    let smoothed = 0.22;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(120, Math.floor(rect.width || 220));
      const h = Math.max(24, Math.floor(rect.height || height));
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const curPhase = phaseRef.current;
      const targetAmp =
        curPhase === "listening"
          ? Math.max(0.24, Math.min(1, levelRef.current * 1.35 + 0.12))
          : curPhase === "speaking"
          ? 0.68
          : curPhase === "processing"
          ? 0.45
          : 0.15;

      smoothed = smoothed * 0.72 + targetAmp * 0.28;
      tick += curPhase === "processing" ? 0.14 : curPhase === "idle" ? 0.05 : 0.11;

      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, palette[0]);
      grad.addColorStop(0.5, palette[1]);
      grad.addColorStop(1, palette[2]);

      const midY = h / 2;

      if (styleId === "aurora_ribbon" || styleId === "rainbow_prism" || styleId === "cyber_pulse") {
        const layers = styleId === "cyber_pulse" ? 2 : 3;
        for (let l = 0; l < layers; l++) {
          ctx.beginPath();
          const freq = 0.028 + l * 0.011;
          const speed = tick * (1.2 + l * 0.35);
          const layerAmp = (h * 0.36) * smoothed * (1 - l * 0.22);
          for (let x = 0; x <= w; x += 3) {
            const env = Math.sin((x / w) * Math.PI);
            const yOffset =
              styleId === "cyber_pulse"
                ? Math.sin(x * freq * 1.4 - speed) * Math.cos(x * 0.015 + speed * 0.5) * layerAmp * env
                : Math.sin(x * freq + speed + l * 1.2) * layerAmp * env;
            const y = midY + yOffset;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = palette[l % palette.length];
          ctx.lineWidth = styleId === "rainbow_prism" ? 3.2 - l * 0.6 : 2.5 - l * 0.5;
          ctx.shadowColor = palette[l % palette.length];
          ctx.shadowBlur = 10;
          ctx.stroke();
        }
        ctx.shadowBlur = 0;
      } else if (styleId === "quantum_rings") {
        const rings = compact ? 5 : 7;
        const step = w / (rings + 1);
        for (let i = 0; i < rings; i++) {
          const cx = step * (i + 1);
          const wave = 0.5 + 0.5 * Math.sin(tick * 1.5 - i * 0.7);
          const r = Math.max(3, Math.min(h * 0.44, 17 * (0.35 + wave * smoothed)));
          ctx.beginPath();
          ctx.arc(cx, midY, Math.max(3, r), 0, Math.PI * 2);
          ctx.strokeStyle = palette[i % palette.length];
          ctx.lineWidth = 2.2;
          ctx.shadowColor = palette[i % palette.length];
          ctx.shadowBlur = 8;
          ctx.stroke();
        }
        ctx.shadowBlur = 0;
      } else if (styleId === "liquid_neon") {
        const orbs = compact ? 12 : 18;
        const step = w / orbs;
        for (let i = 0; i < orbs; i++) {
          const t = i / orbs;
          const env = Math.sin(t * Math.PI);
          const dy = Math.sin(tick * 1.6 + i * 0.65) * (h * 0.28 * smoothed * env);
          const r = Math.max(2.5, (compact ? 3 : 4.2) * (0.55 + smoothed * 0.65 * env));
          ctx.beginPath();
          ctx.arc(step * (i + 0.5), midY + dy, r, 0, Math.PI * 2);
          ctx.fillStyle = palette[i % palette.length];
          ctx.fill();
        }
      } else {
        // plasma_bars, emerald_matrix, solar_flare
        const bars = compact ? 18 : 28;
        const gap = compact ? 3 : 4;
        const barW = Math.max(2.5, (w - gap * (bars - 1)) / bars);
        const isMatrix = styleId === "emerald_matrix";
        const isSolar = styleId === "solar_flare";

        for (let i = 0; i < bars; i++) {
          const t = i / bars;
          const env = Math.max(0.22, Math.sin(t * Math.PI));
          const wave = Math.abs(Math.sin(tick * 1.45 + i * 0.52));
          const bh = Math.max(4, (h - 4) * (0.18 + wave * smoothed * env * 0.85));
          const x = i * (barW + gap);
          const y = midY - bh / 2;

          ctx.fillStyle = isMatrix
            ? i % 2 === 0
              ? "#10b981"
              : "#34d399"
            : isSolar
            ? i % 2 === 0
              ? "#f59e0b"
              : "#fb7185"
            : grad;

          const rad = Math.min(barW / 2, 4);
          ctx.beginPath();
          ctx.roundRect(x, y, barW, bh, rad);
          ctx.fill();
        }
      }

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [styleId, colorThemeId, height, compact]);

  return (
    <canvas
      ref={canvasRef}
      style={{ height: `${height}px` }}
      className={`w-full block ${className}`}
      aria-label="Colorful Voice Wave Visualizer"
    />
  );
};
