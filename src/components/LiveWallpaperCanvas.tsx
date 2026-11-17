import React, { useEffect, useRef } from "react";
import type { LiveWallpaperStyleId, ClockStyleId } from "../types";
import { LIVE_WALLPAPER_PRESETS } from "../data/oneUi9Catalog";

interface LiveWallpaperCanvasProps {
  styleId: LiveWallpaperStyleId;
  accentHex?: string;
  galleryImageUrl?: string;
  className?: string;
  interactive?: boolean;
}

export const LiveWallpaperCanvas: React.FC<LiveWallpaperCanvasProps> = ({
  styleId,
  accentHex,
  galleryImageUrl,
  className = "",
  interactive = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerRef = useRef<{ x: number; y: number }>({ x: 0.5, y: 0.5 });
  const galleryImgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!galleryImageUrl) {
      galleryImgRef.current = null;
      return;
    }
    const img = new Image();
    img.onload = () => {
      galleryImgRef.current = img;
    };
    img.src = galleryImageUrl;
  }, [galleryImageUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const preset = LIVE_WALLPAPER_PRESETS.find((p) => p.id === styleId) || LIVE_WALLPAPER_PRESETS[0];
    const primary = accentHex || preset.primary;
    const secondary = preset.secondary;

    let rafId = 0;
    const start = performance.now();

    const drops = Array.from({ length: 72 }, (_, idx) => ({
      x: (idx * 73 % 100) / 100,
      y: Math.random(),
      speed: 0.18 + Math.random() * 0.55,
      len: 18 + Math.random() * 58,
      size: 1.2 + (idx % 3) * 0.8,
      alpha: 0.25 + Math.random() * 0.55,
    }));

    const resize = () => {
      const parent = canvas.parentElement;
      const w = parent ? parent.clientWidth : window.innerWidth;
      const h = parent ? parent.clientHeight : window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = (now: number) => {
      const t = (now - start) * 0.001;
      const w = canvas.width;
      const h = canvas.height;
      const cx = w * 0.5 + (pointerRef.current.x - 0.5) * w * 0.06;
      const cy = h * 0.5 + (pointerRef.current.y - 0.5) * h * 0.06;

      // Base fill or Gallery Photo cover backdrop
      const bgImg = galleryImgRef.current;
      if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
        const scale = Math.max(w / bgImg.naturalWidth, h / bgImg.naturalHeight);
        const dw = bgImg.naturalWidth * scale;
        const dh = bgImg.naturalHeight * scale;
        ctx.drawImage(bgImg, (w - dw) / 2, (h - dh) / 2, dw, dh);
        ctx.fillStyle = "rgba(2, 5, 17, 0.36)";
        ctx.fillRect(0, 0, w, h);
      } else {
        const bgGrad = ctx.createLinearGradient(0, 0, w, h);
        bgGrad.addColorStop(0, preset.bg);
        bgGrad.addColorStop(1, "#020511");
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, w, h);
      }

      // Two moving aurora radial glows
      const ox1 = cx + Math.cos(t * 0.45) * w * 0.24;
      const oy1 = h * 0.32 + Math.sin(t * 0.38) * h * 0.14;
      const r1 = Math.min(w, h) * 0.62;
      const g1 = ctx.createRadialGradient(ox1, oy1, 0, ox1, oy1, r1);
      g1.addColorStop(0, `${primary}55`);
      g1.addColorStop(0.55, `${primary}18`);
      g1.addColorStop(1, "transparent");
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, w, h);

      const ox2 = cx + Math.sin(t * 0.34) * w * 0.26;
      const oy2 = h * 0.72 + Math.cos(t * 0.41) * h * 0.12;
      const r2 = Math.min(w, h) * 0.58;
      const g2 = ctx.createRadialGradient(ox2, oy2, 0, ox2, oy2, r2);
      g2.addColorStop(0, `${secondary}4d`);
      g2.addColorStop(0.55, `${secondary}16`);
      g2.addColorStop(1, "transparent");
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, w, h);

      // Style specific overlays
      if (styleId === "cosmic_rain" || styleId === "emerald_matrix") {
        ctx.lineWidth = Math.max(1.5, w * 0.0022);
        for (const d of drops) {
          d.y = (d.y + d.speed * 0.012) % 1.08;
          const px = d.x * w;
          const py = d.y * h;
          ctx.strokeStyle = primary;
          ctx.globalAlpha = d.alpha;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px, py + d.len);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      } else if (styleId === "cyber_grid_3d") {
        const horizon = h * 0.55;
        ctx.strokeStyle = primary;
        ctx.lineWidth = 1.4;
        ctx.globalAlpha = 0.28;
        for (let i = -7; i <= 7; i++) {
          ctx.beginPath();
          ctx.moveTo(cx + i * (w * 0.025), horizon);
          ctx.lineTo(cx + i * (w * 0.22), h);
          ctx.stroke();
        }
        let y = horizon + ((t * 50) % 52);
        let step = 20;
        while (y < h) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
          y += step;
          step *= 1.18;
        }
        ctx.globalAlpha = 1;
      } else if (styleId === "quantum_singularity" || styleId === "jarvis_reactor_clock") {
        const baseR = Math.min(w, h) * 0.27;
        for (let idx = 0; idx < 4; idx++) {
          const rad = baseR * (0.55 + idx * 0.2);
          ctx.strokeStyle = idx % 2 === 0 ? primary : secondary;
          ctx.lineWidth = Math.max(2, 6 - idx);
          ctx.globalAlpha = 0.65 - idx * 0.1;
          const ang = t * (0.65 + idx * 0.25) * (idx % 2 === 0 ? 1 : -1);
          ctx.beginPath();
          ctx.arc(cx, cy, rad, ang, ang + Math.PI * 1.25);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      } else if (styleId === "deep_ocean" || styleId === "velvet_ripples") {
        for (let band = 0; band < 4; band++) {
          ctx.beginPath();
          const yBase = h * (0.34 + band * 0.14);
          ctx.moveTo(0, yBase);
          for (let x = 0; x <= w; x += Math.max(18, w / 28)) {
            const wave = Math.sin(x * 0.004 + t * (0.7 + band * 0.15) + band) * (h * 0.045);
            ctx.lineTo(x, yBase + wave);
          }
          ctx.strokeStyle = band % 2 === 0 ? primary : secondary;
          ctx.lineWidth = 2.5;
          ctx.globalAlpha = 0.34;
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      } else {
        // Aurora / Stardust floating luminous particles
        for (let i = 0; i < drops.length; i++) {
          const d = drops[i];
          const px = ((d.x + Math.sin(t * 0.3 + i) * 0.03) * w + w) % w;
          const py = ((d.y + t * 0.015) % 1) * h;
          ctx.fillStyle = i % 2 === 0 ? primary : secondary;
          ctx.globalAlpha = d.alpha * 0.75;
          ctx.beginPath();
          ctx.arc(px, py, d.size * 1.4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
    };
  }, [styleId, accentHex]);

  return (
    <canvas
      ref={canvasRef}
      onPointerMove={
        interactive
          ? (e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                pointerRef.current = {
                  x: (e.clientX - rect.left) / rect.width,
                  y: (e.clientY - rect.top) / rect.height,
                };
              }
            }
          : undefined
      }
      className={`w-full h-full block ${className}`}
    />
  );
};

/**
 * Generates a crisp 1080x2400 PNG dataUrl wallpaper bitmap for Android WallpaperManager
 * optionally stamping the user's chosen Lock Clock Design onto it!
 */
export function renderPhoneWallpaperBitmapDataUrl(opts: {
  styleId: LiveWallpaperStyleId;
  accentHex: string;
  clockHex: string;
  clockStyleId?: ClockStyleId;
  includeClock?: boolean;
}): string {
  const w = 1080;
  const h = 2400;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const preset = LIVE_WALLPAPER_PRESETS.find((p) => p.id === opts.styleId) || LIVE_WALLPAPER_PRESETS[0];
  const primary = opts.accentHex || preset.primary;
  const secondary = preset.secondary;

  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, preset.bg);
  bg.addColorStop(1, "#020512");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const g1 = ctx.createRadialGradient(w * 0.25, h * 0.28, 0, w * 0.25, h * 0.28, 860);
  g1.addColorStop(0, `${primary}88`);
  g1.addColorStop(0.6, `${primary}20`);
  g1.addColorStop(1, "transparent");
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, w, h);

  const g2 = ctx.createRadialGradient(w * 0.78, h * 0.72, 0, w * 0.78, h * 0.72, 820);
  g2.addColorStop(0, `${secondary}78`);
  g2.addColorStop(0.6, `${secondary}1c`);
  g2.addColorStop(1, "transparent");
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, w, h);

  // Signature orbital rings
  ctx.strokeStyle = primary;
  ctx.lineWidth = 4;
  ctx.globalAlpha = 0.45;
  ctx.beginPath();
  ctx.arc(w / 2, h * 0.56, 320, 0, Math.PI * 1.45);
  ctx.stroke();

  ctx.strokeStyle = secondary;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(w / 2, h * 0.56, 250, Math.PI * 0.4, Math.PI * 1.9);
  ctx.stroke();
  ctx.globalAlpha = 1;

  if (opts.includeClock) {
    const now = new Date();
    const hh = String(now.getHours() % 12 || 12).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const dateStr = now.toLocaleDateString("en-US", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });

    ctx.fillStyle = opts.clockHex || "#e0f2fe";
    ctx.textAlign = "center";
    if (opts.clockStyleId === "stacked_vertical") {
      ctx.font = "800 190px Orbitron, sans-serif";
      ctx.fillText(hh, w / 2, h * 0.22);
      ctx.fillStyle = primary;
      ctx.fillText(mm, w / 2, h * 0.305);
    } else {
      ctx.font =
        opts.clockStyleId === "slim_ultralight"
          ? "300 185px sans-serif"
          : "800 175px Orbitron, sans-serif";
      ctx.fillText(`${hh}:${mm}`, w / 2, h * 0.24);
    }
    ctx.fillStyle = primary;
    ctx.font = "600 34px monospace";
    ctx.fillText(`${dateStr.toUpperCase()} • WASU'S JARVIS ONE UI 9`, w / 2, h * 0.35);
  }

  return canvas.toDataURL("image/png");
}

export async function renderPhoneWallpaperBitmapDataUrlAsync(opts: {
  styleId: LiveWallpaperStyleId;
  accentHex: string;
  clockHex: string;
  clockStyleId?: ClockStyleId;
  includeClock?: boolean;
  galleryImageUrl?: string;
}): Promise<string> {
  if (!opts.galleryImageUrl) {
    return renderPhoneWallpaperBitmapDataUrl(opts);
  }
  const w = 1080;
  const h = 2400;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return renderPhoneWallpaperBitmapDataUrl(opts);

  const preset = LIVE_WALLPAPER_PRESETS.find((p) => p.id === opts.styleId) || LIVE_WALLPAPER_PRESETS[0];
  const primary = opts.accentHex || preset.primary;

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = opts.galleryImageUrl!;
    });
    const scale = Math.max(w / Math.max(1, img.width), h / Math.max(1, img.height));
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    ctx.fillStyle = "rgba(2, 5, 18, 0.34)";
    ctx.fillRect(0, 0, w, h);
  } catch {
    return renderPhoneWallpaperBitmapDataUrl(opts);
  }

  ctx.strokeStyle = primary;
  ctx.lineWidth = 4;
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  ctx.arc(w / 2, h * 0.62, 300, 0, Math.PI * 1.45);
  ctx.stroke();
  ctx.globalAlpha = 1;

  if (opts.includeClock) {
    const now = new Date();
    const hh = String(now.getHours() % 12 || 12).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const dateStr = now.toLocaleDateString("en-US", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });

    ctx.fillStyle = opts.clockHex || "#e0f2fe";
    ctx.textAlign = "center";
    if (opts.clockStyleId === "stacked_vertical") {
      ctx.font = "800 190px Orbitron, sans-serif";
      ctx.fillText(hh, w / 2, h * 0.22);
      ctx.fillStyle = primary;
      ctx.fillText(mm, w / 2, h * 0.305);
    } else {
      ctx.font =
        opts.clockStyleId === "slim_ultralight"
          ? "300 185px sans-serif"
          : "800 175px Orbitron, sans-serif";
      ctx.fillText(`${hh}:${mm}`, w / 2, h * 0.24);
    }
    ctx.fillStyle = primary;
    ctx.font = "600 34px monospace";
    ctx.fillText(`${dateStr.toUpperCase()} • WASU'S JARVIS ONE UI 9`, w / 2, h * 0.35);
  }

  return canvas.toDataURL("image/png");
}
