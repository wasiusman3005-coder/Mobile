import React, { useRef } from "react";
import { Zap, X, Thermometer, BatteryCharging, Activity } from "lucide-react";
import type { ChargingAnimId } from "../types";
import { CHARGING_ANIM_PRESETS } from "../data/oneUi9Catalog";

interface ChargingAnimationOverlayProps {
  isOpen: boolean;
  animId: ChargingAnimId;
  batteryPercent: number | null;
  customImageUrl?: string;
  showPhoto?: boolean;
  dismissMethod?: "single_tap" | "double_tap";
  tempC?: number | null;
  voltageV?: string;
  healthLabel?: string;
  onClose: () => void;
}

export const ChargingAnimationOverlay: React.FC<ChargingAnimationOverlayProps> = ({
  isOpen,
  animId,
  batteryPercent,
  customImageUrl,
  showPhoto = false,
  dismissMethod = "single_tap",
  tempC,
  voltageV = "4.32 V",
  healthLabel = "Good",
  onClose,
}) => {
  const lastTapRef = useRef(0);
  if (!isOpen) return null;

  const preset = CHARGING_ANIM_PRESETS.find((c) => c.id === animId) || CHARGING_ANIM_PRESETS[0];
  const pct = batteryPercent !== null ? batteryPercent : 85;
  const displayTemp = tempC !== undefined && tempC !== null ? `${tempC.toFixed(1)}°C` : "31.5°C";

  const handleBackdropTap = () => {
    if (dismissMethod === "double_tap") {
      const now = Date.now();
      if (now - lastTapRef.current < 500) {
        onClose();
      } else {
        lastTapRef.current = now;
      }
      return;
    }
    onClose();
  };

  return (
    <div
      onClick={handleBackdropTap}
      className="fixed inset-0 z-[115] flex items-center justify-center bg-[#020512]/92 backdrop-blur-xl p-6 cursor-pointer"
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Dismiss charging animation"
        className="absolute top-6 right-6 min-w-[44px] min-h-[44px] rounded-full bg-slate-900/90 border border-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
      >
        <X className="w-5 h-5" />
      </button>

      <div
        onClick={(e) => e.stopPropagation()}
        className="flex flex-col items-center gap-5 select-none max-w-xs w-full"
      >
        <div className="relative w-60 h-60 flex items-center justify-center">
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

          {/* Core Orb */}
          <div
            className="relative z-10 w-44 h-44 rounded-full overflow-hidden border-2 bg-[#040a1c] flex flex-col items-center justify-center shadow-2xl"
            style={{
              borderColor: `${preset.accent}cc`,
              boxShadow: `0 0 42px ${preset.accent}44`,
            }}
          >
            {showPhoto && customImageUrl && (
              <img
                src={customImageUrl}
                alt="Custom charging theme"
                className="absolute inset-0 w-full h-full object-cover opacity-45"
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

            <Zap className="relative z-10 w-7 h-7 mb-1" style={{ color: preset.accent }} />
            <div className="relative z-10 font-orbitron font-black text-4xl text-white tabular">
              {pct}%
            </div>
            <div
              className="relative z-10 mt-1 text-[10px] font-mono uppercase tracking-widest"
              style={{ color: preset.accent }}
            >
              {pct >= 100 ? "Battery Full" : "Super Fast Charging"}
            </div>
          </div>
        </div>

        {/* Battery Details 2x2 Grid (Voltage / Temp / Health / Charge) */}
        <div className="w-full grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-700/70 flex items-center gap-2">
            <BatteryCharging className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <div className="text-[10px] font-mono text-slate-400">Battery</div>
              <div className="font-orbitron font-bold text-white tabular">{pct}%</div>
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-700/70 flex items-center gap-2">
            <Thermometer className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <div className="text-[10px] font-mono text-slate-400">Temp</div>
              <div className="font-orbitron font-bold text-white tabular">{displayTemp}</div>
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-700/70 flex items-center gap-2">
            <Zap className="w-4 h-4 text-cyan-400 shrink-0" />
            <div>
              <div className="text-[10px] font-mono text-slate-400">Voltage</div>
              <div className="font-orbitron font-bold text-white tabular">{voltageV}</div>
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-700/70 flex items-center gap-2">
            <Activity className="w-4 h-4 text-purple-400 shrink-0" />
            <div>
              <div className="text-[10px] font-mono text-slate-400">Health</div>
              <div className="font-orbitron font-bold text-white">{healthLabel}</div>
            </div>
          </div>
        </div>

        <div className="text-center space-y-1">
          <div className="font-orbitron font-bold text-sm tracking-wider text-slate-100">
            {preset.name}
          </div>
          <div className="text-xs font-mono text-slate-400">
            {dismissMethod === "double_tap"
              ? "Double-tap background to dismiss"
              : "Tap background to dismiss"}
          </div>
        </div>
      </div>
    </div>
  );
};
