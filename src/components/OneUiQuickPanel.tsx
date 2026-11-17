import React, { useState } from "react";
import {
  Wifi,
  Bluetooth,
  Smartphone,
  Sun,
  Volume2,
  Flashlight,
  MapPin,
  BatteryCharging,
  Plane,
  Palette,
  Mic,
  Lock,
  X,
  SlidersHorizontal,
} from "lucide-react";
import type { QuickPanelStyleId } from "../types";
import { togglePhoneFlashlight } from "../services/mobileDeviceActions";
import { openAndroidQuickPanel } from "../services/nativeAndroidBridge";

interface OneUiQuickPanelProps {
  isOpen: boolean;
  onClose: () => void;
  styleId: QuickPanelStyleId;
  accentHex?: string;
  isWakeActive: boolean;
  onToggleWake: () => void;
  onOpenOneUiStudio: () => void;
  onTriggerVoice: () => void;
  onLockNow?: () => void;
  onToast: (msg: string) => void;
}

export const OneUiQuickPanel: React.FC<OneUiQuickPanelProps> = ({
  isOpen,
  onClose,
  styleId,
  accentHex = "#00f0ff",
  isWakeActive,
  onToggleWake,
  onOpenOneUiStudio,
  onTriggerVoice,
  onLockNow,
  onToast,
}) => {
  const [torchOn, setTorchOn] = useState(false);
  const [brightness, setBrightness] = useState(82);
  const [volume, setVolume] = useState(74);

  if (!isOpen) return null;

  const panelBg =
    styleId === "minimal_matte"
      ? "bg-[#050608]/96 border-slate-800"
      : styleId === "neon_cyber"
      ? "bg-[#03091a]/95 border-cyan-400/60 shadow-[0_0_50px_rgba(0,240,255,0.22)]"
      : styleId === "retro_matrix"
      ? "bg-[#02120b]/96 border-emerald-400/50"
      : styleId === "liquid_aurora"
      ? "bg-gradient-to-b from-[#0b1332]/95 via-[#0f0c29]/95 to-[#050918]/95 border-violet-400/45"
      : styleId === "amoled_dual"
      ? "bg-[#040710]/96 border-amber-400/45"
      : "bg-[#070d20]/90 backdrop-blur-2xl border-slate-400/25";

  const tileBase =
    styleId === "capsule_pills"
      ? "rounded-full"
      : styleId === "retro_matrix"
      ? "rounded-lg font-mono"
      : styleId === "prism_cards"
      ? "rounded-3xl"
      : "rounded-2xl";

  const handlePanel = async (
    panel: "wifi" | "bluetooth" | "data" | "display" | "sound" | "battery" | "location" | "airplane"
  ) => {
    const res = await openAndroidQuickPanel(panel);
    if (!res.ok && res.message) {
      onToast(res.message);
    }
  };

  const switches = [
    {
      id: "wifi",
      label: "Wi-Fi",
      sub: "Internet Panel",
      icon: Wifi,
      active: true,
      onClick: () => handlePanel("wifi"),
    },
    {
      id: "bluetooth",
      label: "Bluetooth",
      sub: "Devices",
      icon: Bluetooth,
      active: false,
      onClick: () => handlePanel("bluetooth"),
    },
    {
      id: "data",
      label: "Mobile Data",
      sub: "SIM Network",
      icon: Smartphone,
      active: true,
      onClick: () => handlePanel("data"),
    },
    {
      id: "torch",
      label: "Flashlight",
      sub: torchOn ? "ON" : "OFF",
      icon: Flashlight,
      active: torchOn,
      onClick: async () => {
        const next = !torchOn;
        setTorchOn(next);
        const r = await togglePhoneFlashlight(next);
        onToast(r.message);
      },
    },
    {
      id: "wake",
      label: "Jarvis Wake",
      sub: isWakeActive ? "Always-On" : "Paused",
      icon: Mic,
      active: isWakeActive,
      onClick: () => onToggleWake(),
    },
    {
      id: "location",
      label: "GPS Location",
      sub: "Maps",
      icon: MapPin,
      active: true,
      onClick: () => handlePanel("location"),
    },
    {
      id: "battery",
      label: "Power Saver",
      sub: "Battery",
      icon: BatteryCharging,
      active: false,
      onClick: () => handlePanel("battery"),
    },
    {
      id: "airplane",
      label: "Airplane",
      sub: "Flight Mode",
      icon: Plane,
      active: false,
      onClick: () => handlePanel("airplane"),
    },
  ];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[110] bg-black/65 backdrop-blur-sm flex items-start justify-center p-3 sm:p-6 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-xl mt-2 rounded-3xl border p-4 sm:p-5 space-y-4 shadow-2xl ${panelBg}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <SlidersHorizontal className="w-4 h-4" style={{ color: accentHex }} />
            <span className="font-orbitron font-bold text-xs sm:text-sm tracking-wider text-slate-100">
              ONE UI 9 QUICK SWITCHES
            </span>
          </div>
          <div className="flex items-center gap-2">
            {onLockNow && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onLockNow();
                }}
                className="min-h-[44px] px-3 rounded-xl bg-slate-900/90 border border-slate-500/30 text-xs font-mono text-slate-200 flex items-center gap-1.5 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Lock</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Quick Panel"
              className="min-w-[44px] min-h-[44px] rounded-xl bg-slate-900/90 border border-slate-500/30 text-slate-300 flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Shortcut Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {switches.map((sw) => {
            const Icon = sw.icon;
            return (
              <button
                key={sw.id}
                type="button"
                onClick={sw.onClick}
                className={`min-h-[64px] p-3 border text-left flex items-center gap-2.5 cursor-pointer transition active:scale-95 ${tileBase} ${
                  sw.active
                    ? "bg-slate-800/85 text-white"
                    : "bg-slate-950/75 border-slate-500/20 text-slate-300"
                }`}
                style={
                  sw.active
                    ? {
                        borderColor: `${accentHex}90`,
                        boxShadow: `0 0 18px ${accentHex}24`,
                      }
                    : undefined
                }
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    background: sw.active ? accentHex : "rgba(148,163,184,0.14)",
                    color: sw.active ? "#030712" : "#cbd5e1",
                  }}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold truncate">{sw.label}</div>
                  <div className="text-[10px] font-mono text-slate-400 truncate">{sw.sub}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Display Brightness & Sound Sliders */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="p-3 rounded-2xl bg-slate-950/75 border border-slate-500/20 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-slate-300">
              <button
                type="button"
                onClick={() => handlePanel("display")}
                className="flex items-center gap-1.5 cursor-pointer hover:text-white"
              >
                <Sun className="w-4 h-4" style={{ color: accentHex }} />
                <span>Brightness</span>
              </button>
              <span className="tabular">{brightness}%</span>
            </div>
            <input
              type="range"
              min={15}
              max={100}
              value={brightness}
              onChange={(e) => setBrightness(Number(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          <div className="p-3 rounded-2xl bg-slate-950/75 border border-slate-500/20 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-slate-300">
              <button
                type="button"
                onClick={() => handlePanel("sound")}
                className="flex items-center gap-1.5 cursor-pointer hover:text-white"
              >
                <Volume2 className="w-4 h-4" style={{ color: accentHex }} />
                <span>Media Volume</span>
              </button>
              <span className="tabular">{volume}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-full accent-violet-400 cursor-pointer"
            />
          </div>
        </div>

        {/* Bottom Action Row */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => {
              onClose();
              onTriggerVoice();
            }}
            className="min-h-[46px] px-4 py-2.5 rounded-2xl font-orbitron font-bold text-xs tracking-wider text-[#030712] flex items-center justify-center gap-2 cursor-pointer"
            style={{ background: accentHex }}
          >
            <Mic className="w-4 h-4" />
            <span>Speak to Jarvis</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenOneUiStudio();
            }}
            className="min-h-[46px] px-4 py-2.5 rounded-2xl bg-slate-900 border border-slate-500/35 text-xs font-orbitron font-bold text-slate-100 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Palette className="w-4 h-4" style={{ color: accentHex }} />
            <span>One UI 9 Studio</span>
          </button>
        </div>
      </div>
    </div>
  );
};
