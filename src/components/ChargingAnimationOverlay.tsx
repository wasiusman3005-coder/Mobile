import React from "react";
import { Zap, X } from "lucide-react";
import type { ChargingAnimId } from "../types";
import { CHARGING_ANIM_PRESETS } from "../data/oneUi9Catalog";

interface ChargingAnimationOverlayProps {
  isOpen: boolean;
  animId: ChargingAnimId;
  batteryPercent: number | null;
  customImageUrl?: string;
  onClose: () => void;
}

export const ChargingAnimationOverlay: React.FC<ChargingAnimationOverlayProps> = ({
  isOpen,
  animId,
  batteryPercent,
  customImageUrl,
  onClose,
}) => {
  if (!isOpen) return null;

  const preset = CHARGING_ANIM_PRESETS.find((c) => c.id === animId) || CHARGING_ANIM_PRESETS[0];
  const pct = batteryPercent !== null ? batteryPercent : 78;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[115] flex items-center justify-center bg-[#020512]/90 backdrop-blur-xl p-6 cursor-pointer"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss charging animation"
        className="absolute top-6 right-6 min-w-[44px] min-h-[44px] rounded-full bg-slate-900/90 border border-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
      >
        <X className="w-5 h-5" />
      </button>

      <div
        onClick={(e) => e.stopPropagation()}
        className="flex flex-col items-center gap-6 select-none"
      >
        <div className="relative w-64 h-64 flex items-center justify-center">
          {/* Outer spinning halo */}
          <div
            className="absolute inset-0 rounded-full p-[3px] animate-spin"
            style={{
              animationDuration: animId === "warp_core" || animId === "dual_turbine" ? "2.4s" : "5.5s",
              background: `conic-gradient(from 0deg, ${preset.accent}, transparent 40%, #a855f7 75%, ${preset.accent})`,
            }}
          >
            <div className="w-full h-full rounded-full bg-[#030714]" />
          </div>

          {animId === "dual_turbine" && (
            <div
              className="absolute inset-4 rounded-full border-2 border-dashed animate-spin-reverse"
              style={{ animationDuration: "3.2s", borderColor: `${preset.accent}aa` }}
            />
          )}

          {/* Liquid fill visual for liquid_fill / oneui9_turbo */}
          <div
            className="relative z-10 w-48 h-48 rounded-full overflow-hidden border-2 bg-[#040a1c] flex flex-col items-center justify-center shadow-2xl"
            style={{
              borderColor: `${preset.accent}cc`,
              boxShadow: `0 0 42px ${preset.accent}44`,
            }}
          >
            {customImageUrl && (
              <img
                src={customImageUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-cover opacity-35"
              />
            )}
            {(animId === "liquid_fill" || animId === "matrix_stream") && (
              <div
                className="absolute left-0 right-0 bottom-0 transition-all duration-700 opacity-35"
                style={{
                  height: `${Math.max(18, Math.min(100, pct))}%`,
                  background: `linear-gradient(180deg, ${preset.accent}, #065f46)`,
                }}
              />
            )}

            <Zap className="relative z-10 w-8 h-8 mb-1" style={{ color: preset.accent }} />
            <div className="relative z-10 font-orbitron font-black text-4xl text-white tabular">
              {pct}%
            </div>
            <div
              className="relative z-10 mt-1 text-[11px] font-mono uppercase tracking-widest"
              style={{ color: preset.accent }}
            >
              Super Fast Charging
            </div>
          </div>
        </div>

        <div className="text-center space-y-1">
          <div className="font-orbitron font-bold text-sm tracking-wider text-slate-100">
            {preset.name}
          </div>
          <div className="text-xs font-mono text-slate-400">
            Tap anywhere to continue
          </div>
        </div>
      </div>
    </div>
  );
};
