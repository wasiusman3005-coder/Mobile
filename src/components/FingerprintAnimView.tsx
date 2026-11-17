import React from "react";
import { Fingerprint } from "lucide-react";
import type { FingerprintAnimId } from "../types";
import { FINGERPRINT_ANIM_PRESETS } from "../data/oneUi9Catalog";

interface FingerprintAnimViewProps {
  animId: FingerprintAnimId;
  active?: boolean;
  size?: "sm" | "md" | "lg";
  customImageUrl?: string;
  onClick?: () => void;
}

export const FingerprintAnimView: React.FC<FingerprintAnimViewProps> = ({
  animId,
  active = false,
  size = "md",
  customImageUrl,
  onClick,
}) => {
  const preset = FINGERPRINT_ANIM_PRESETS.find((f) => f.id === animId) || FINGERPRINT_ANIM_PRESETS[0];
  const color = preset.color;
  const dimClass = size === "sm" ? "w-14 h-14" : size === "lg" ? "w-28 h-28" : "w-20 h-20";
  const iconClass = size === "sm" ? "w-6 h-6" : size === "lg" ? "w-11 h-11" : "w-8 h-8";

  const innerContent = (
    <>
      {/* Outer Animated Aura */}
      <span
        className={`absolute inset-0 rounded-full transition-all duration-500 ${
          active ? "scale-125 opacity-95" : "scale-100 opacity-65"
        }`}
        style={{
          background:
            animId === "quantum_iris"
              ? `conic-gradient(from 0deg, ${color}, #8b5cf6, transparent, ${color})`
              : animId === "liquid_gold"
              ? `radial-gradient(circle, ${color}55, transparent 70%)`
              : `radial-gradient(circle, ${color}44, transparent 72%)`,
          animation:
            animId === "quantum_iris" || animId === "starlight_ring"
              ? "spin 4s linear infinite"
              : undefined,
        }}
      />

      {/* Ripple / Shockwave Rings */}
      <span
        className="absolute inset-1 rounded-full border-2"
        style={{
          borderColor: color,
          borderStyle: animId === "honeycomb_scan" || animId === "starlight_ring" ? "dashed" : "solid",
          boxShadow: `0 0 18px ${color}88`,
          animation: active || animId === "ripple_wave" || animId === "neon_shockwave" ? "ping 1.8s cubic-bezier(0,0,0.2,1) infinite" : undefined,
        }}
      />

      {/* Inner Biometric Core */}
      <span
        className="relative z-10 w-[76%] h-[76%] rounded-full bg-[#050b1d]/90 border flex items-center justify-center overflow-hidden"
        style={{
          borderColor: `${color}aa`,
          boxShadow: `inset 0 0 14px ${color}55`,
        }}
      >
        {customImageUrl && (
          <img
            src={customImageUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-40"
          />
        )}
        {animId === "honeycomb_scan" && (
          <span
            className="absolute left-0 right-0 h-0.5 q-laser-beam"
            style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
          />
        )}
        <Fingerprint className={`relative z-10 ${iconClass}`} style={{ color }} />
      </span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`relative ${dimClass} rounded-full flex items-center justify-center cursor-pointer transition-transform active:scale-95 focus:outline-none`}
        aria-label={`Fingerprint Animation ${preset.name}`}
      >
        {innerContent}
      </button>
    );
  }

  return (
    <span
      className={`relative ${dimClass} rounded-full inline-flex items-center justify-center`}
      aria-hidden="true"
    >
      {innerContent}
    </span>
  );
};
