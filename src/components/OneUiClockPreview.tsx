import React, { useState, useEffect } from "react";
import type { ClockStyleId } from "../types";

interface OneUiClockPreviewProps {
  styleId: ClockStyleId;
  colorHex?: string;
  accentHex?: string;
  scale?: number;
  batteryPercent?: number | null;
  compact?: boolean;
}

export const OneUiClockPreview: React.FC<OneUiClockPreviewProps> = ({
  styleId,
  colorHex = "#e0f2fe",
  accentHex = "#00f0ff",
  scale = 1,
  batteryPercent,
  compact = false,
}) => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const hours24 = now.getHours();
  const hours12 = String(hours24 % 12 || 12).padStart(2, "0");
  const mins = String(now.getMinutes()).padStart(2, "0");
  const secs = String(now.getSeconds()).padStart(2, "0");
  const ampm = hours24 >= 12 ? "PM" : "AM";
  const dateStr = now.toLocaleDateString("en-PK", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  const s = compact ? 0.68 : scale;

  if (styleId === "analog_quantum") {
    const secDeg = now.getSeconds() * 6;
    const minDeg = now.getMinutes() * 6 + now.getSeconds() * 0.1;
    const hrDeg = (hours24 % 12) * 30 + now.getMinutes() * 0.5;
    const dim = compact ? 104 : 156;
    return (
      <div className="flex flex-col items-center gap-2 select-none" style={{ transform: `scale(${scale})` }}>
        <div
          className="relative rounded-full border-2 flex items-center justify-center bg-slate-950/60 backdrop-blur-md"
          style={{ width: dim, height: dim, borderColor: `${accentHex}90`, boxShadow: `0 0 28px ${accentHex}40` }}
        >
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
            <div
              key={deg}
              className="absolute inset-1.5 flex justify-center"
              style={{ transform: `rotate(${deg}deg)` }}
            >
              <span
                className="w-0.5 rounded-full"
                style={{
                  height: deg % 90 === 0 ? 10 : 5,
                  background: deg % 90 === 0 ? accentHex : `${colorHex}66`,
                }}
              />
            </div>
          ))}
          <div
            className="absolute bottom-1/2 left-1/2 w-1.5 rounded-full origin-bottom -translate-x-1/2"
            style={{ height: dim * 0.24, background: colorHex, transform: `translateX(-50%) rotate(${hrDeg}deg)` }}
          />
          <div
            className="absolute bottom-1/2 left-1/2 w-1 rounded-full origin-bottom -translate-x-1/2"
            style={{ height: dim * 0.34, background: accentHex, transform: `translateX(-50%) rotate(${minDeg}deg)` }}
          />
          <div
            className="absolute bottom-1/2 left-1/2 w-0.5 rounded-full origin-bottom -translate-x-1/2 bg-rose-400"
            style={{ height: dim * 0.38, transform: `translateX(-50%) rotate(${secDeg}deg)` }}
          />
          <div className="w-2.5 h-2.5 rounded-full z-10" style={{ background: accentHex }} />
        </div>
        <div className="text-[11px] font-mono tracking-wider uppercase" style={{ color: colorHex }}>
          {dateStr} {batteryPercent !== undefined && batteryPercent !== null ? `• ${batteryPercent}%` : ""}
        </div>
      </div>
    );
  }

  if (styleId === "stacked_vertical") {
    return (
      <div className="flex flex-col items-center leading-none select-none" style={{ transform: `scale(${s})` }}>
        <span className="font-orbitron font-black text-5xl sm:text-6xl tracking-tight" style={{ color: colorHex }}>
          {hours12}
        </span>
        <span className="font-orbitron font-black text-5xl sm:text-6xl tracking-tight -mt-1" style={{ color: accentHex }}>
          {mins}
        </span>
        <span className="mt-2 text-[11px] font-mono tracking-widest uppercase opacity-80" style={{ color: colorHex }}>
          {dateStr} • {ampm}
        </span>
      </div>
    );
  }

  if (styleId === "flip_retro") {
    return (
      <div className="flex flex-col items-center gap-2 select-none" style={{ transform: `scale(${s})` }}>
        <div className="flex items-center gap-2 tabular">
          <div
            className="px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-400/25 shadow-lg font-orbitron font-extrabold text-3xl sm:text-4xl relative"
            style={{ color: colorHex }}
          >
            {hours12}
            <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-black/50" />
          </div>
          <span className="font-orbitron font-bold text-2xl" style={{ color: accentHex }}>
            :
          </span>
          <div
            className="px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-400/25 shadow-lg font-orbitron font-extrabold text-3xl sm:text-4xl relative"
            style={{ color: accentHex }}
          >
            {mins}
            <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-black/50" />
          </div>
        </div>
        <div className="text-[11px] font-mono tracking-wider uppercase" style={{ color: colorHex }}>
          {dateStr} • {secs}s
        </div>
      </div>
    );
  }

  if (styleId === "floating_glass") {
    return (
      <div
        className="px-5 py-3 rounded-3xl bg-slate-900/45 backdrop-blur-xl border shadow-xl flex flex-col items-center gap-1 select-none"
        style={{ transform: `scale(${s})`, borderColor: `${accentHex}55` }}
      >
        <div className="font-sans font-extrabold text-4xl sm:text-5xl tracking-tight tabular" style={{ color: colorHex }}>
          {hours12}:{mins}
          <span className="text-sm font-mono ml-1.5 opacity-80" style={{ color: accentHex }}>
            {ampm}
          </span>
        </div>
        <div className="text-[11px] font-mono uppercase tracking-widest opacity-80" style={{ color: colorHex }}>
          {dateStr}
          {batteryPercent !== undefined && batteryPercent !== null ? ` • ${batteryPercent}%` : ""}
        </div>
      </div>
    );
  }

  const fontClass =
    styleId === "slim_ultralight"
      ? "font-sans font-extralight tracking-tight"
      : styleId === "neon_segment"
      ? "font-orbitron font-black tracking-wider"
      : styleId === "calligraphy_mono"
      ? "font-mono font-bold tracking-tight"
      : "font-sans font-black tracking-tight";

  return (
    <div className="flex flex-col items-center gap-1 select-none" style={{ transform: `scale(${s})` }}>
      <div
        className={`text-5xl sm:text-6xl tabular ${fontClass}`}
        style={{
          color: colorHex,
          textShadow: styleId === "neon_segment" ? `0 0 22px ${accentHex}` : undefined,
        }}
      >
        {hours12}:{mins}
        {!compact && (
          <span className="text-base font-mono ml-1.5 opacity-75" style={{ color: accentHex }}>
            {secs}
          </span>
        )}
      </div>
      <div className="text-[11px] font-mono tracking-widest uppercase opacity-85" style={{ color: colorHex }}>
        {dateStr} • {ampm}
        {batteryPercent !== undefined && batteryPercent !== null ? ` • ${batteryPercent}%` : ""}
      </div>
    </div>
  );
};
