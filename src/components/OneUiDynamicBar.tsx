import React, { useState, useEffect } from "react";
import {
  SlidersHorizontal,
  BatteryCharging,
  Sparkles,
  Music,
  PhoneIncoming,
  PhoneOff,
  Fingerprint,
  ScanFace,
  Unlock,
} from "lucide-react";
import type {
  DynamicBarStyleId,
  DynamicBarAnchor,
  UnlockBarAnimStyleId,
  WaveVisualizerStyleId,
  UserActivityState,
} from "../types";
import { UNLOCK_BAR_ANIM_PRESETS } from "../data/oneUi9Catalog";
import { ColorfulWaveVisualizer } from "./ColorfulWaveVisualizer";

interface OneUiDynamicBarProps {
  styleId: DynamicBarStyleId;
  anchor?: DynamicBarAnchor;
  offsetX?: number;
  offsetY?: number;
  cameraGapPx?: number;
  customLabel?: string;
  accentHex?: string;
  isListening?: boolean;
  isSpeaking?: boolean;
  audioLevel?: number;
  waveVisualizerStyle?: WaveVisualizerStyleId;
  waveColorTheme?: string;
  unlockBarAnimStyle?: UnlockBarAnimStyleId;
  unlockPulseNonce?: number;
  unlockMethodLabel?: string;
  batteryPercent?: number | null;
  isCharging?: boolean;
  activeStatus?: string;
  activityState?: UserActivityState;
  incomingCallLabel?: string | null;
  onAnswerCall?: () => void;
  onRejectCall?: () => void;
  onTapVoice: () => void;
  onTapQuickPanel: () => void;
}

export const OneUiDynamicBar: React.FC<OneUiDynamicBarProps> = ({
  styleId,
  anchor = "camera-island",
  offsetX = 0,
  offsetY = 6,
  cameraGapPx = 34,
  customLabel = "Wasu's Jarvis",
  accentHex = "#00f0ff",
  isListening = false,
  isSpeaking = false,
  audioLevel = 0.25,
  waveVisualizerStyle = "rainbow_prism",
  waveColorTheme = "aurora_cyan",
  unlockBarAnimStyle = "aurora_bloom",
  unlockPulseNonce = 0,
  unlockMethodLabel = "Fingerprint",
  batteryPercent,
  isCharging = false,
  activeStatus,
  activityState,
  incomingCallLabel,
  onAnswerCall,
  onRejectCall,
  onTapVoice,
  onTapQuickPanel,
}) => {
  const [timeStr, setTimeStr] = useState(() =>
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
  const [unlockActive, setUnlockActive] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setTimeStr(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    }, 15000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!unlockPulseNonce) return;
    setUnlockActive(true);
    const t = setTimeout(() => setUnlockActive(false), 3200);
    return () => clearTimeout(t);
  }, [unlockPulseNonce]);

  if (styleId === "hidden") return null;

  const unlockPreset =
    UNLOCK_BAR_ANIM_PRESETS.find((u) => u.id === unlockBarAnimStyle) || UNLOCK_BAR_ANIM_PRESETS[0];

  const lowerUnlock = (unlockMethodLabel || "").toLowerCase();
  const isFaceUnlock = lowerUnlock.includes("face");
  const isFingerUnlock = lowerUnlock.includes("finger") || !isFaceUnlock;

  // Settings-locked position: ONLY updated from Studio/App Settings — touch never drags or moves it
  const computePositionStyle = (): React.CSSProperties => {
    const safeY = Math.max(0, Math.min(820, offsetY));
    if (anchor === "top-left") {
      return { top: `${safeY}px`, left: `${Math.max(8, 12 + offsetX)}px` };
    }
    if (anchor === "top-right") {
      return { top: `${safeY}px`, right: `${Math.max(8, 12 - offsetX)}px` };
    }
    if (anchor === "bottom-center") {
      return {
        bottom: `${Math.max(10, safeY)}px`,
        left: `calc(50% + ${offsetX}px)`,
        transform: "translateX(-50%)",
      };
    }
    return {
      top: `${safeY}px`,
      left: `calc(50% + ${offsetX}px)`,
      transform: "translateX(-50%)",
    };
  };

  const cleanLabel = customLabel?.trim() || "Wasu's Jarvis";
  const actTag =
    activityState === "riding_bike"
      ? "Riding"
      : activityState === "walking"
      ? "Walking"
      : activityState === "lying_sleeping"
      ? "Resting"
      : "";

  const isCameraIsland = anchor === "camera-island";
  const effectiveBorderColor = unlockActive
    ? isFaceUnlock
      ? "#a855f7"
      : "#10b981"
    : isCameraIsland
    ? "#f59e0b"
    : `${accentHex}99`;

  const renderUnlockIcon = () => {
    if (isFaceUnlock) {
      return (
        <span className="relative flex items-center justify-center w-6 h-6 shrink-0">
          <span
            className="absolute inset-0 rounded-full border-2 border-dashed border-purple-400 animate-spin"
            style={{ animationDuration: "3.2s" }}
          />
          <ScanFace className="w-3.5 h-3.5 text-fuchsia-300" />
        </span>
      );
    }
    if (isFingerUnlock) {
      return (
        <span className="relative flex items-center justify-center w-6 h-6 shrink-0">
          <span className="absolute inset-0 rounded-full border border-emerald-400/80 animate-ping" />
          <Fingerprint className="w-4 h-4 text-emerald-300" />
        </span>
      );
    }
    return <Unlock className="w-3.5 h-3.5 shrink-0" style={{ color: unlockPreset.accent }} />;
  };

  // True OLED Black Camera-Hole Island matching reference screenshot
  if (isCameraIsland && !incomingCallLabel) {
    return (
      <div
        style={computePositionStyle()}
        className="fixed z-[65] max-w-[96vw] pointer-events-auto select-none"
      >
        <div
          className="flex items-center gap-2 px-3 py-1 rounded-full bg-black border-[1.5px] transition-all duration-300"
          style={{
            borderColor: effectiveBorderColor,
            boxShadow: unlockActive
              ? `0 0 28px ${isFaceUnlock ? "rgba(168,85,247,0.7)" : "rgba(16,185,129,0.7)"}`
              : "0 0 22px rgba(245,158,11,0.32), 0 8px 24px rgba(0,0,0,0.9)",
          }}
        >
          {/* Left status & voice trigger */}
          <button
            type="button"
            onClick={onTapVoice}
            className="min-h-[34px] flex items-center gap-1.5 cursor-pointer text-left shrink-0"
          >
            {unlockActive ? (
              renderUnlockIcon()
            ) : (
              <span className="w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-400/60 flex items-center justify-center">
                <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
              </span>
            )}
            <span className="text-[11px] font-mono font-bold whitespace-nowrap text-emerald-300 tabular">
              {unlockActive
                ? isFaceUnlock
                  ? "Face ID"
                  : "Finger OK"
                : isListening
                ? "Sun rahi..."
                : isSpeaking
                ? "Jarvis"
                : `${timeStr}`}
            </span>
          </button>

          {/* Center Front Camera Cutout Spacer */}
          {cameraGapPx > 0 && (
            <div
              aria-hidden="true"
              className="shrink-0 flex items-center justify-center"
              style={{ width: `${Math.min(72, cameraGapPx)}px` }}
            >
              <span className="w-3.5 h-3.5 rounded-full bg-[#090d16] border border-slate-700/70 shadow-inner" />
            </div>
          )}

          {/* Right Live Spectrum Wave + Quick Panel Switch */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-[62px]">
              <ColorfulWaveVisualizer
                styleId={waveVisualizerStyle}
                colorThemeId={waveColorTheme}
                audioLevel={unlockActive ? 0.92 : isListening || isSpeaking ? audioLevel : 0.32}
                phase={isListening ? "listening" : "speaking"}
                height={18}
                compact
              />
            </div>
            <button
              type="button"
              onClick={onTapQuickPanel}
              aria-label="Open Quick Switches"
              className="w-7 h-7 rounded-full bg-slate-900/90 border border-slate-700/70 text-slate-200 flex items-center justify-center cursor-pointer"
            >
              <SlidersHorizontal className="w-3 h-3" style={{ color: accentHex }} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (styleId === "dual_capsule" && !isListening && !isSpeaking && !incomingCallLabel) {
    return (
      <div
        style={computePositionStyle()}
        className="fixed z-[65] flex items-center gap-2 pointer-events-auto select-none"
      >
        <button
          type="button"
          onClick={onTapVoice}
          className="min-h-[40px] px-3.5 py-1.5 rounded-full bg-black/95 backdrop-blur-xl border text-xs font-mono text-slate-100 flex items-center gap-2 cursor-pointer shadow-lg transition active:scale-95"
          style={{ borderColor: effectiveBorderColor, boxShadow: `0 0 18px ${accentHex}2a` }}
        >
          {unlockActive ? (
            renderUnlockIcon()
          ) : (
            <Sparkles className="w-3.5 h-3.5" style={{ color: accentHex }} />
          )}
          <span className="whitespace-nowrap">
            {unlockActive ? `${isFaceUnlock ? "Face ID" : "Fingerprint"} Unlocked` : cleanLabel}
          </span>
        </button>

        <button
          type="button"
          onClick={onTapQuickPanel}
          className="min-h-[40px] px-3 py-1.5 rounded-full bg-black/95 backdrop-blur-xl border border-slate-500/35 text-xs font-mono text-slate-200 flex items-center gap-1.5 cursor-pointer shadow-lg transition active:scale-95 tabular"
        >
          <span>{timeStr}</span>
          {batteryPercent !== undefined && batteryPercent !== null && (
            <span className="text-emerald-300">{batteryPercent}%</span>
          )}
          <SlidersHorizontal className="w-3.5 h-3.5 text-slate-300" />
        </button>
      </div>
    );
  }

  const isVoiceExpanded = isListening || isSpeaking;

  return (
    <div
      style={computePositionStyle()}
      className="fixed z-[65] max-w-[94vw] pointer-events-auto select-none"
    >
      <div
        className={`flex flex-col gap-1.5 px-3.5 py-1.5 backdrop-blur-xl border shadow-2xl transition-all duration-300 ${
          styleId === "minimal_dot" && !isVoiceExpanded && !incomingCallLabel
            ? "rounded-full bg-black/95 px-3 py-1"
            : styleId === "cyber_strip"
            ? "rounded-xl bg-[#040a18]/94"
            : "rounded-3xl bg-[#050b1d]/94"
        }`}
        style={{
          borderColor: effectiveBorderColor,
          boxShadow: unlockActive
            ? `0 0 32px ${isFaceUnlock ? "rgba(168,85,247,0.65)" : "rgba(16,185,129,0.65)"}`
            : `0 6px 26px rgba(0,0,0,0.6), 0 0 18px ${accentHex}28`,
        }}
      >
        <div className="flex items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={onTapVoice}
            className="flex items-center gap-2 min-h-[36px] cursor-pointer text-left flex-1 min-w-0"
          >
            {unlockActive ? (
              renderUnlockIcon()
            ) : styleId === "music_ticker" ? (
              <Music className="w-3.5 h-3.5 shrink-0" style={{ color: accentHex }} />
            ) : (
              <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ color: accentHex }} />
            )}

            <span className="text-[11px] font-mono font-semibold text-slate-100 whitespace-nowrap truncate max-w-[205px] sm:max-w-[270px]">
              {unlockActive
                ? `${isFaceUnlock ? "Face ID" : "Fingerprint"} Unlocked · ${unlockPreset.name}`
                : isListening
                ? "Sun rahi hoon, bolein aap"
                : isSpeaking
                ? `${cleanLabel} · Jawab`
                : styleId === "minimal_dot"
                ? timeStr
                : activeStatus ||
                  `${cleanLabel} · ${timeStr}${actTag ? ` · ${actTag}` : ""}`}
            </span>
          </button>

          {batteryPercent !== undefined && batteryPercent !== null && (
            <span className="hidden sm:flex items-center gap-1 text-[10px] font-mono text-emerald-300 tabular whitespace-nowrap">
              {isCharging && <BatteryCharging className="w-3 h-3" />}
              {batteryPercent}%
            </span>
          )}

          <button
            type="button"
            onClick={onTapQuickPanel}
            aria-label="Open Swipe Quick Panel"
            className="min-w-[36px] min-h-[36px] px-2 rounded-full bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 flex items-center justify-center cursor-pointer transition shrink-0"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" style={{ color: accentHex }} />
          </button>
        </div>

        {(isVoiceExpanded || unlockActive) && (
          <div className="w-[min(280px,78vw)] pb-0.5">
            <ColorfulWaveVisualizer
              styleId={waveVisualizerStyle}
              colorThemeId={waveColorTheme}
              audioLevel={unlockActive ? 0.88 : audioLevel}
              phase={isListening ? "listening" : "speaking"}
              height={24}
              compact
            />
          </div>
        )}

        {incomingCallLabel && (
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10">
            <span className="text-[11px] font-mono text-amber-200 truncate max-w-[140px]">
              {incomingCallLabel}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onAnswerCall}
                className="min-h-[44px] px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <PhoneIncoming className="w-3.5 h-3.5" />
                <span>Answer</span>
              </button>
              <button
                type="button"
                onClick={onRejectCall}
                className="min-h-[44px] px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <PhoneOff className="w-3.5 h-3.5" />
                <span>Cut</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
