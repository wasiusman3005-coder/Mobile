import React, { useEffect, useRef } from "react";
import type { LiveWallpaperStyleId, ClockStyleId } from "../types";
import { LIVE_WALLPAPER_PRESETS } from "../data/oneUi9Catalog";

interface LiveWallpaperCanvasProps {
  styleId: LiveWallpaperStyleId;
  accentHex?: string;
  galleryImageUrl?: string;
  depthEnabled?: boolean;
  dimPercent?: number;
  blurPx?: number;
  className?: string;
  interactive?: boolean;
}

function drawDepthBackgroundScene(
  ctx: CanvasRenderingContext2D,
  styleId: LiveWallpaperStyleId,
  w: number,
  h: number,
  primary: string,
  secondary: string,
  t: number
) {
  if (styleId === "depth_moon_eclipse") {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#02040a");
    sky.addColorStop(0.55, "#060b16");
    sky.addColorStop(1, "#000000");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Subtle starfield
    for (let i = 0; i < 36; i++) {
      const sx = ((i * 197 + 41) % 100) * 0.01 * w;
      const sy = ((i * 131 + 17) % 60) * 0.01 * h;
      ctx.fillStyle = i % 3 === 0 ? secondary : "#ffffff";
      ctx.globalAlpha = 0.28 + 0.35 * Math.abs(Math.sin(t * 0.7 + i));
      ctx.fillRect(sx, sy, Math.max(1.5, w * 0.0022), Math.max(1.5, w * 0.0022));
    }
    ctx.globalAlpha = 1;

    // Lunar Corona behind Moon
    const mx = w * 0.5;
    const my = h * 0.58;
    const mr = Math.min(w, h) * 0.34;
    const halo = ctx.createRadialGradient(mx, my, mr * 0.4, mx, my, mr * 1.9);
    halo.addColorStop(0, `${primary}45`);
    halo.addColorStop(0.45, `${secondary}22`);
    halo.addColorStop(1, "transparent");
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);
  } else if (styleId === "depth_supercar_neon") {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#0b0618");
    sky.addColorStop(0.45, "#23123a");
    sky.addColorStop(0.75, "#0f172a");
    sky.addColorStop(1, "#05070e");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    const glow = ctx.createRadialGradient(w * 0.5, h * 0.48, 0, w * 0.5, h * 0.48, Math.min(w, h) * 0.65);
    glow.addColorStop(0, `${primary}66`);
    glow.addColorStop(0.5, `${secondary}2e`);
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    // Subtle cyberpunk skyline silhouette in distance
    ctx.fillStyle = "#080b18";
    const cols = 11;
    const bw = w / cols;
    for (let i = 0; i < cols; i++) {
      const bh = h * (0.14 + ((i * 37) % 19) * 0.009);
      ctx.fillRect(i * bw, h * 0.56 - bh, bw + 1, bh + h * 0.1);
    }
  } else if (styleId === "depth_abyssal_ocean") {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#042640");
    sky.addColorStop(0.42, "#074d74");
    sky.addColorStop(0.55, "#033352");
    sky.addColorStop(1, "#011220");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    const sun = ctx.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.42, Math.min(w, h) * 0.48);
    sun.addColorStop(0, "#a5f3fc88");
    sun.addColorStop(0.6, `${primary}28`);
    sun.addColorStop(1, "transparent");
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, w, h);
  } else if (styleId === "depth_emerald_ridge") {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#102819");
    sky.addColorStop(0.35, "#2b6b3a");
    sky.addColorStop(0.58, "#174123");
    sky.addColorStop(1, "#031208");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    const sun = ctx.createRadialGradient(w * 0.72, h * 0.34, 0, w * 0.72, h * 0.34, Math.min(w, h) * 0.5);
    sun.addColorStop(0, "#d9f99d77");
    sun.addColorStop(0.5, `${primary}30`);
    sun.addColorStop(1, "transparent");
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, w, h);
  } else if (styleId === "depth_obsidian_panther") {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, w, h);
    const rim = ctx.createRadialGradient(w * 0.5, h * 0.55, Math.min(w, h) * 0.1, w * 0.5, h * 0.55, Math.min(w, h) * 0.55);
    rim.addColorStop(0, `${secondary}33`);
    rim.addColorStop(0.55, `${primary}22`);
    rim.addColorStop(1, "transparent");
    ctx.fillStyle = rim;
    ctx.fillRect(0, 0, w, h);
  } else if (styleId === "depth_alpine_peak") {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#0b172e");
    sky.addColorStop(0.38, "#1e3a6d");
    sky.addColorStop(0.65, "#475569");
    sky.addColorStop(1, "#090f1c");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    const dawn = ctx.createRadialGradient(w * 0.3, h * 0.38, 0, w * 0.3, h * 0.38, Math.min(w, h) * 0.55);
    dawn.addColorStop(0, `${secondary}66`);
    dawn.addColorStop(0.5, `${primary}25`);
    dawn.addColorStop(1, "transparent");
    ctx.fillStyle = dawn;
    ctx.fillRect(0, 0, w, h);
  }
}

function drawDepthForegroundSubject(
  ctx: CanvasRenderingContext2D,
  styleId: LiveWallpaperStyleId,
  w: number,
  h: number,
  primary: string,
  secondary: string
) {
  if (styleId === "depth_moon_eclipse") {
    const cx = w * 0.5;
    const cy = h * 0.58;
    const r = Math.min(w, h) * 0.33;
    const moonGrad = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.25, r * 0.08, cx, cy, r);
    moonGrad.addColorStop(0, "#f1f5f9");
    moonGrad.addColorStop(0.52, "#94a3b8");
    moonGrad.addColorStop(0.85, "#334155");
    moonGrad.addColorStop(1, "#090d16");
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = moonGrad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

    // Subtle lunar craters
    ctx.fillStyle = "rgba(15, 23, 42, 0.24)";
    const craters = [
      [-0.22, -0.18, 0.18],
      [0.24, -0.12, 0.14],
      [-0.08, 0.22, 0.21],
      [0.32, 0.26, 0.11],
      [-0.36, 0.14, 0.13],
    ];
    for (const [dx, dy, cr] of craters) {
      ctx.beginPath();
      ctx.arc(cx + dx * r, cy + dy * r, cr * r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else if (styleId === "depth_supercar_neon") {
    // Sleek foreground supercar roof/hood depth silhouette
    ctx.save();
    const roadGrad = ctx.createLinearGradient(0, h * 0.62, 0, h);
    roadGrad.addColorStop(0, "#0b1020");
    roadGrad.addColorStop(1, "#03050a");
    ctx.fillStyle = roadGrad;
    ctx.fillRect(0, h * 0.68, w, h * 0.32);

    // Car body silhouette overlapping clock lower edge (~46% height at windshield peak)
    ctx.fillStyle = "#111827";
    ctx.beginPath();
    ctx.moveTo(w * 0.08, h * 0.68);
    ctx.lineTo(w * 0.22, h * 0.56);
    ctx.quadraticCurveTo(w * 0.44, h * 0.45, w * 0.68, h * 0.50);
    ctx.lineTo(w * 0.89, h * 0.61);
    ctx.lineTo(w * 0.94, h * 0.72);
    ctx.lineTo(w * 0.06, h * 0.72);
    ctx.closePath();
    ctx.fill();

    // Neon rim highlights + headlights
    ctx.strokeStyle = secondary;
    ctx.lineWidth = Math.max(2, w * 0.004);
    ctx.beginPath();
    ctx.moveTo(w * 0.22, h * 0.56);
    ctx.quadraticCurveTo(w * 0.44, h * 0.45, w * 0.68, h * 0.50);
    ctx.stroke();

    ctx.fillStyle = primary;
    ctx.shadowColor = primary;
    ctx.shadowBlur = 18;
    ctx.fillRect(w * 0.16, h * 0.63, w * 0.14, h * 0.012);
    ctx.fillRect(w * 0.72, h * 0.63, w * 0.14, h * 0.012);
    ctx.restore();
  } else if (styleId === "depth_abyssal_ocean") {
    const sea = ctx.createLinearGradient(0, h * 0.44, 0, h);
    sea.addColorStop(0, "#0ea5e955");
    sea.addColorStop(0.22, "#0369a1cc");
    sea.addColorStop(1, "#010c17");
    ctx.fillStyle = sea;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.47);
    ctx.quadraticCurveTo(w * 0.25, h * 0.42, w * 0.5, h * 0.47);
    ctx.quadraticCurveTo(w * 0.75, h * 0.51, w, h * 0.46);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();
  } else if (styleId === "depth_emerald_ridge") {
    const hill1 = ctx.createLinearGradient(0, h * 0.42, 0, h);
    hill1.addColorStop(0, "#65a30d");
    hill1.addColorStop(0.45, "#15803d");
    hill1.addColorStop(1, "#041c0d");
    ctx.fillStyle = hill1;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.52);
    ctx.quadraticCurveTo(w * 0.35, h * 0.41, w * 0.7, h * 0.49);
    ctx.quadraticCurveTo(w * 0.88, h * 0.53, w, h * 0.47);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();
  } else if (styleId === "depth_obsidian_panther") {
    // Stylized panther head / ears foreground cutout with electric cyan eyes
    ctx.save();
    ctx.fillStyle = "#06080f";
    ctx.beginPath();
    ctx.moveTo(w * 0.16, h);
    ctx.lineTo(w * 0.24, h * 0.58);
    ctx.lineTo(w * 0.31, h * 0.44);
    ctx.lineTo(w * 0.41, h * 0.51);
    ctx.quadraticCurveTo(w * 0.5, h * 0.49, w * 0.59, h * 0.51);
    ctx.lineTo(w * 0.69, h * 0.44);
    ctx.lineTo(w * 0.76, h * 0.58);
    ctx.lineTo(w * 0.84, h);
    ctx.closePath();
    ctx.fill();

    // Glowing eyes
    ctx.fillStyle = primary;
    ctx.shadowColor = primary;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.ellipse(w * 0.39, h * 0.62, w * 0.04, h * 0.008, 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(w * 0.61, h * 0.62, w * 0.04, h * 0.008, -0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (styleId === "depth_alpine_peak") {
    ctx.save();
    const mtn = ctx.createLinearGradient(0, h * 0.4, 0, h);
    mtn.addColorStop(0, "#e2e8f0");
    mtn.addColorStop(0.28, "#64748b");
    mtn.addColorStop(0.65, "#1e293b");
    mtn.addColorStop(1, "#060a14");
    ctx.fillStyle = mtn;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.62);
    ctx.lineTo(w * 0.26, h * 0.49);
    ctx.lineTo(w * 0.52, h * 0.39);
    ctx.lineTo(w * 0.78, h * 0.52);
    ctx.lineTo(w, h * 0.58);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

export const DepthForegroundOverlay: React.FC<{
  styleId: LiveWallpaperStyleId;
  accentHex?: string;
}> = ({ styleId, accentHex }) => {
  const preset = LIVE_WALLPAPER_PRESETS.find((p) => p.id === styleId);
  if (!preset?.isDepth) return null;
  const primary = accentHex || preset.primary;
  const secondary = preset.secondary;

  if (styleId === "depth_moon_eclipse") {
    return (
      <svg
        viewBox="0 0 360 700"
        preserveAspectRatio="xMidYMid slice"
        className="pointer-events-none absolute inset-0 w-full h-full z-15"
      >
        <defs>
          <radialGradient id="moonDepthGrad" cx="38%" cy="35%" r="68%">
            <stop offset="0%" stopColor="#f1f5f9" />
            <stop offset="55%" stopColor="#94a3b8" />
            <stop offset="88%" stopColor="#334155" />
            <stop offset="100%" stopColor="#090d16" />
          </radialGradient>
        </defs>
        <circle cx="180" cy="406" r="118" fill="url(#moonDepthGrad)" />
        <circle cx="152" cy="382" r="21" fill="#0f172a" fillOpacity="0.22" />
        <circle cx="212" cy="392" r="16" fill="#0f172a" fillOpacity="0.2" />
        <circle cx="172" cy="436" r="24" fill="#0f172a" fillOpacity="0.22" />
      </svg>
    );
  }

  if (styleId === "depth_supercar_neon") {
    return (
      <svg
        viewBox="0 0 360 700"
        preserveAspectRatio="xMidYMid slice"
        className="pointer-events-none absolute inset-0 w-full h-full z-15"
      >
        <path
          d="M28,476 L79,392 Q158,315 245,350 L320,427 L338,510 L22,510 Z"
          fill="#0f172a"
        />
        <path
          d="M79,392 Q158,315 245,350"
          fill="none"
          stroke={secondary}
          strokeWidth="3"
        />
        <rect x="58" y="440" width="48" height="8" rx="3" fill={primary} />
        <rect x="256" y="440" width="48" height="8" rx="3" fill={primary} />
      </svg>
    );
  }

  if (styleId === "depth_abyssal_ocean") {
    return (
      <svg
        viewBox="0 0 360 700"
        preserveAspectRatio="xMidYMid slice"
        className="pointer-events-none absolute inset-0 w-full h-full z-15"
      >
        <defs>
          <linearGradient id="oceanDepthGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.45" />
            <stop offset="30%" stopColor="#0369a1" stopOpacity="0.82" />
            <stop offset="100%" stopColor="#010c17" stopOpacity="0.98" />
          </linearGradient>
        </defs>
        <path
          d="M0,328 Q90,295 180,328 T360,322 L360,700 L0,700 Z"
          fill="url(#oceanDepthGrad)"
        />
      </svg>
    );
  }

  if (styleId === "depth_emerald_ridge") {
    return (
      <svg
        viewBox="0 0 360 700"
        preserveAspectRatio="xMidYMid slice"
        className="pointer-events-none absolute inset-0 w-full h-full z-15"
      >
        <defs>
          <linearGradient id="meadowDepthGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#65a30d" />
            <stop offset="45%" stopColor="#15803d" />
            <stop offset="100%" stopColor="#041c0d" />
          </linearGradient>
        </defs>
        <path
          d="M0,364 Q126,288 252,342 Q316,370 360,332 L360,700 L0,700 Z"
          fill="url(#meadowDepthGrad)"
        />
      </svg>
    );
  }

  if (styleId === "depth_obsidian_panther") {
    return (
      <svg
        viewBox="0 0 360 700"
        preserveAspectRatio="xMidYMid slice"
        className="pointer-events-none absolute inset-0 w-full h-full z-15"
      >
        <path
          d="M58,700 L86,406 L112,308 L148,356 Q180,342 212,356 L248,308 L274,406 L302,700 Z"
          fill="#06080f"
        />
        <ellipse cx="140" cy="434" rx="14" ry="5" transform="rotate(14 140 434)" fill={primary} />
        <ellipse cx="220" cy="434" rx="14" ry="5" transform="rotate(-14 220 434)" fill={primary} />
      </svg>
    );
  }

  // depth_alpine_peak
  return (
    <svg
      viewBox="0 0 360 700"
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 w-full h-full z-15"
    >
      <defs>
        <linearGradient id="alpineDepthGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f1f5f9" />
          <stop offset="28%" stopColor="#64748b" />
          <stop offset="70%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#060a14" />
        </linearGradient>
      </defs>
      <path
        d="M0,434 L94,342 L187,273 L281,364 L360,406 L360,700 L0,700 Z"
        fill="url(#alpineDepthGrad)"
      />
    </svg>
  );
};

export const LiveWallpaperCanvas: React.FC<LiveWallpaperCanvasProps> = ({
  styleId,
  accentHex,
  galleryImageUrl,
  depthEnabled = true,
  dimPercent = 18,
  blurPx = 0,
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
    let lastDraw = 0;

    const drops = Array.from({ length: 48 }, (_, idx) => ({
      x: ((idx * 73) % 100) / 100,
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
      const dpr = Math.min(window.devicePixelRatio || 1, 1.2);
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = (now: number) => {
      rafId = requestAnimationFrame(draw);
      if (document.hidden || now - lastDraw < 32) return;
      lastDraw = now;
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
      } else if (preset.isDepth) {
        drawDepthBackgroundScene(ctx, styleId, w, h, primary, secondary, t);
      } else {
        const bgGrad = ctx.createLinearGradient(0, 0, w, h);
        bgGrad.addColorStop(0, preset.bg);
        bgGrad.addColorStop(1, "#020511");
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, w, h);

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
      }

      // Style specific overlays (only when NOT a gallery photo or depth preset)
      if (!bgImg && !preset.isDepth) {
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
      }

      if (!bgImg && preset.isDepth && !depthEnabled) {
        drawDepthForegroundSubject(ctx, styleId, w, h, primary, secondary);
      }

      const dimAlpha = Math.max(0, Math.min(0.75, (dimPercent ?? 0) / 100));
      if (dimAlpha > 0) {
        ctx.fillStyle = `rgba(2, 5, 18, ${dimAlpha.toFixed(2)})`;
        ctx.fillRect(0, 0, w, h);
      }
    };

    rafId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
    };
  }, [styleId, accentHex, depthEnabled, dimPercent]);

  return (
    <canvas
      ref={canvasRef}
      style={blurPx > 0 ? { filter: `blur(${Math.min(18, blurPx)}px)` } : undefined}
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

function drawClockOnBitmap(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  opts: {
    accentHex: string;
    clockHex: string;
    clockStyleId?: ClockStyleId;
    clockPosY?: number;
    clockScale?: number;
  }
) {
  const now = new Date();
  const hh = String(now.getHours() % 12 || 12).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const dateStr = now
    .toLocaleDateString("en-US", {
      weekday: "short",
      day: "numeric",
      month: "short",
    })
    .toUpperCase();

  const scale = Math.max(0.65, Math.min(1.4, opts.clockScale ?? 1));
  const yFrac = Math.max(0.14, Math.min(0.62, (opts.clockPosY ?? 22) / 100));

  ctx.save();
  ctx.fillStyle = opts.clockHex || "#e0f2fe";
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 24;

  if (opts.clockStyleId === "depth_editorial") {
    ctx.fillStyle = opts.accentHex;
    ctx.font = `700 ${Math.round(34 * scale)}px monospace`;
    ctx.fillText(dateStr, w / 2, h * yFrac - 150 * scale);

    ctx.fillStyle = opts.clockHex || "#ffffff";
    ctx.font = `900 ${Math.round(290 * scale)}px Impact, Orbitron, sans-serif`;
    ctx.fillText(`${hh}${mm}`, w / 2, h * yFrac + 75 * scale);
  } else if (opts.clockStyleId === "stacked_vertical") {
    ctx.font = `800 ${Math.round(190 * scale)}px Orbitron, sans-serif`;
    ctx.fillText(hh, w / 2, h * yFrac);
    ctx.fillStyle = opts.accentHex;
    ctx.fillText(mm, w / 2, h * yFrac + 205 * scale);
    ctx.fillStyle = opts.clockHex || "#e0f2fe";
    ctx.font = `600 ${Math.round(32 * scale)}px monospace`;
    ctx.fillText(dateStr, w / 2, h * yFrac + 280 * scale);
  } else {
    ctx.font =
      opts.clockStyleId === "slim_ultralight"
        ? `300 ${Math.round(185 * scale)}px sans-serif`
        : `800 ${Math.round(175 * scale)}px Orbitron, sans-serif`;
    ctx.fillText(`${hh}:${mm}`, w / 2, h * yFrac + 35 * scale);
    ctx.fillStyle = opts.accentHex;
    ctx.font = `600 ${Math.round(32 * scale)}px monospace`;
    ctx.fillText(dateStr, w / 2, h * yFrac + 100 * scale);
  }
  ctx.restore();
}

/**
 * Generates a clean 1080x2400 PNG dataUrl wallpaper bitmap for Android WallpaperManager
 * WITHOUT unwanted stuck circles, and with optional 3D depth subject layering over the clock!
 */
export function renderPhoneWallpaperBitmapDataUrl(opts: {
  styleId: LiveWallpaperStyleId;
  accentHex: string;
  clockHex: string;
  clockStyleId?: ClockStyleId;
  includeClock?: boolean;
  depthEnabled?: boolean;
  dimPercent?: number;
  clockPosY?: number;
  clockScale?: number;
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

  if (preset.isDepth) {
    drawDepthBackgroundScene(ctx, opts.styleId, w, h, primary, secondary, 0);
  } else {
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
  }

  const dimAlpha = Math.max(0, Math.min(0.75, (opts.dimPercent ?? 18) / 100));
  if (dimAlpha > 0) {
    ctx.fillStyle = `rgba(2, 5, 18, ${dimAlpha.toFixed(2)})`;
    ctx.fillRect(0, 0, w, h);
  }

  if (opts.includeClock) {
    drawClockOnBitmap(ctx, w, h, {
      accentHex: primary,
      clockHex: opts.clockHex,
      clockStyleId: opts.clockStyleId,
      clockPosY: opts.clockPosY,
      clockScale: opts.clockScale,
    });
  }

  // Render 3D Depth foreground subject ABOVE clock so the clock sits behind the subject!
  if (preset.isDepth && opts.depthEnabled !== false) {
    drawDepthForegroundSubject(ctx, opts.styleId, w, h, primary, secondary);
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
  depthEnabled?: boolean;
  dimPercent?: number;
  blurPx?: number;
  clockPosY?: number;
  clockScale?: number;
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
    if (opts.blurPx && opts.blurPx > 0) {
      ctx.filter = `blur(${Math.min(24, opts.blurPx)}px)`;
    }
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    ctx.filter = "none";

    const dimAlpha = Math.max(0, Math.min(0.75, (opts.dimPercent ?? 18) / 100));
    if (dimAlpha > 0) {
      ctx.fillStyle = `rgba(2, 5, 18, ${dimAlpha.toFixed(2)})`;
      ctx.fillRect(0, 0, w, h);
    }
  } catch {
    return renderPhoneWallpaperBitmapDataUrl(opts);
  }

  if (opts.includeClock) {
    drawClockOnBitmap(ctx, w, h, {
      accentHex: primary,
      clockHex: opts.clockHex,
      clockStyleId: opts.clockStyleId,
      clockPosY: opts.clockPosY,
      clockScale: opts.clockScale,
    });
  }

  return canvas.toDataURL("image/png");
}
