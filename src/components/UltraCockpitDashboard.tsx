import React, { useState, useEffect, useRef } from "react";
import {
  LayoutGrid,
  Smartphone,
  Bell,
  CheckSquare,
  Heart,
  MessageSquare,
  AudioWaveform,
  Download,
  Settings,
  Lock,
  ExternalLink,
  AlertTriangle,
  X,
  Atom,
  Volume2,
  VolumeX,
  ScrollText,
  Film,
} from "lucide-react";
import { soundEffects } from "../services/soundEffects";
import { readPhoneHardwareTelemetry, PhoneHardwareTelemetry } from "../services/systemTelemetry";
import { triggerHaptic } from "../services/mobileDeviceActions";
import { UserProfile, DashboardCustomization, LanguageCode, VoiceGender } from "../types";
import { QuantumThemeColor } from "./AutoMorphingQuantumLogo";
import {
  CentralQuantumCoreHologram,
  CockpitCorePhase,
  QuantumColorPalette,
  CORE_TOPOLOGIES,
  QUANTUM_SPECTRUMS,
} from "./CentralQuantumCoreHologram";
import { QDynamicsBrandLogo3D } from "./QDynamicsBrandLogo3D";
import { getCharacterDisplayName } from "../data/jarvisCatalog";

export interface CockpitSummaryItem {
  id: string;
  role: "user" | "assistant" | "reminder";
  speaker: string;
  text: string;
  timeStr: string;
}

interface UltraCockpitDashboardProps {
  userProfile: UserProfile;
  customization: DashboardCustomization;
  currentTheme?: QuantumThemeColor;
  coherence: number;
  isSpeaking: boolean;
  isListening: boolean;
  screenWorkMinutes: number;
  onOpenVoiceModal: () => void;
  onOpenAppsMatrix: () => void;
  onOpenModule?: (
    moduleId:
      | "comms"
      | "desktop"
      | "study"
      | "records"
      | "health"
      | "finance"
      | "focus"
      | "memory"
      | "automation"
      | "communication"
      | "maps"
      | "devices"
      | "studio"
  ) => void;
  onOpenSettings: () => void;
  onTriggerWakeWord?: () => void;
  onPrimeWakeMic?: () => void;
  onSpeakBriefing?: () => void;
  wakeStatusText?: string;
  wakeReady?: boolean;
  lastHeardWakeText?: string;
  onTriggerHealthLockdown: () => void;
  onLockScreen?: () => void;
  onToggleAwayMode?: () => void;
  isAwayMode?: boolean;
  onOpenPhoneInstall?: (tab?: "android" | "ios" | "apk") => void;
  language: LanguageCode;
  voiceGender: VoiceGender;
  cockpitPhase?: CockpitCorePhase;
  audioLevel?: number;
  liveTranscript?: string;
  recordingSeconds?: number;
  waWaveBars?: number[];
  onCancelRecording?: () => void;
  onSendRecording?: () => void;
  onStartManualRecording?: () => void;
  onRenameAssistant?: (newName: string) => void;
  cockpitSummaries?: CockpitSummaryItem[];
  topologyIndex?: number;
  onSelectTopology?: (idx: number) => void;
  onMorphNextTopology?: () => void;
  spectrumIndex?: number;
  onSelectSpectrum?: (idx: number) => void;
  energySurge?: boolean;
  onToggleEnergySurge?: () => void;
  hudHidden?: boolean;
  onToggleHudHidden?: () => void;
  onShowIdentityVideo?: () => void;
}

export const UltraCockpitDashboard: React.FC<UltraCockpitDashboardProps> = ({
  customization,
  coherence,
  isListening,
  onOpenVoiceModal,
  onOpenAppsMatrix,
  onOpenModule,
  onOpenSettings,
  onPrimeWakeMic,
  wakeReady,
  onLockScreen,
  onOpenPhoneInstall,
  language,
  voiceGender,
  cockpitPhase = "galaxy",
  audioLevel = 0,
  liveTranscript = "",
  recordingSeconds = 0,
  waWaveBars = [],
  onCancelRecording,
  onSendRecording,
  onStartManualRecording,
  onRenameAssistant,
  cockpitSummaries = [],
  topologyIndex = 0,
  onSelectTopology,
  onMorphNextTopology,
  spectrumIndex = 0,
  onSelectSpectrum,
  energySurge = false,
  onToggleEnergySurge,
  hudHidden = false,
  onToggleHudHidden,
  onShowIdentityVideo,
}) => {
  const [phoneTelemetry, setPhoneTelemetry] = useState<PhoneHardwareTelemetry | null>(null);
  const [dismissIframeNotice, setDismissIframeNotice] = useState(false);
  const [soundOn, setSoundOn] = useState(soundEffects.soundEnabled);
  const [sidebarDrawer, setSidebarDrawer] = useState<"none" | "core" | "summary">("none");
  const summaryScrollRef = useRef<HTMLDivElement>(null);

  const activeCharName = getCharacterDisplayName(customization.avatarConfig);
  const activeSpec = QUANTUM_SPECTRUMS[spectrumIndex % QUANTUM_SPECTRUMS.length];

  useEffect(() => {
    readPhoneHardwareTelemetry()
      .then((tel) => setPhoneTelemetry(tel))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (summaryScrollRef.current) {
      summaryScrollRef.current.scrollTop = summaryScrollRef.current.scrollHeight;
    }
  }, [cockpitSummaries, liveTranscript, sidebarDrawer]);

  const directAppUrl =
    typeof window !== "undefined"
      ? (window.location.origin || "").replace("https://ais-dev-", "https://ais-pre-")
      : "";

  const sideActions: {
    id: string;
    label: string;
    icon: React.ElementType;
    onClick: () => void;
    active?: boolean;
    badgeCount?: number;
  }[] = [
    {
      id: "identity_video",
      label: "Show Wasu & Wasi ki Jan",
      icon: Film,
      onClick: () => {
        soundEffects.playBeepConfirm();
        onShowIdentityVideo?.();
      },
    },
    {
      id: "core_controls",
      label: "Core & Spectrum",
      icon: Atom,
      active: sidebarDrawer === "core",
      onClick: () => {
        soundEffects.playClick();
        setSidebarDrawer((prev) => (prev === "core" ? "none" : "core"));
      },
    },
    {
      id: "summary",
      label: "Voice Summary",
      icon: ScrollText,
      active: sidebarDrawer === "summary",
      badgeCount: cockpitSummaries.length,
      onClick: () => {
        soundEffects.playClick();
        setSidebarDrawer((prev) => (prev === "summary" ? "none" : "summary"));
      },
    },
    {
      id: "apps",
      label: "Apps",
      icon: LayoutGrid,
      onClick: () => {
        soundEffects.playClick();
        triggerHaptic(15);
        onOpenAppsMatrix();
      },
    },
    {
      id: "info",
      label: "Phone Info",
      icon: Smartphone,
      onClick: () => {
        soundEffects.playClick();
        onOpenModule?.("desktop");
      },
    },
    {
      id: "alerts",
      label: "Alerts",
      icon: Bell,
      onClick: () => {
        soundEffects.playClick();
        onOpenModule?.("comms");
      },
    },
    {
      id: "tasks",
      label: "Tasks",
      icon: CheckSquare,
      onClick: () => {
        soundEffects.playClick();
        onOpenModule?.("memory");
      },
    },
    {
      id: "health",
      label: "Health",
      icon: Heart,
      onClick: () => {
        soundEffects.playClick();
        onOpenModule?.("health");
      },
    },
    {
      id: "chat",
      label: "Chat",
      icon: MessageSquare,
      onClick: () => {
        soundEffects.playClick();
        onOpenVoiceModal();
      },
    },
    {
      id: "voice",
      label: wakeReady ? (isListening ? "Listening" : "Speak") : "Mic On",
      icon: AudioWaveform,
      active: isListening || !wakeReady,
      onClick: () => {
        soundEffects.playBeepConfirm();
        if (!wakeReady && onPrimeWakeMic) {
          onPrimeWakeMic();
        } else {
          onStartManualRecording?.();
        }
      },
    },
    {
      id: "audio",
      label: soundOn ? "Audio On" : "Audio Off",
      icon: soundOn ? Volume2 : VolumeX,
      onClick: () => {
        const next = !soundEffects.soundEnabled;
        soundEffects.soundEnabled = next;
        setSoundOn(next);
        if (next) soundEffects.playKeyClick(880);
      },
    },
    {
      id: "install",
      label: "Phone Link",
      icon: Download,
      onClick: () => {
        soundEffects.playClick();
        onOpenPhoneInstall?.("android");
      },
    },
    {
      id: "settings",
      label: "Settings",
      icon: Settings,
      onClick: () => {
        soundEffects.playClick();
        onOpenSettings();
      },
    },
    {
      id: "lock",
      label: "Lock",
      icon: Lock,
      onClick: () => {
        soundEffects.playAlert();
        triggerHaptic([35, 20, 35]);
        onLockScreen?.();
      },
    },
  ];

  const handlePhaseColorChange = (_color: QuantumColorPalette) => {};

  return (
    <div
      id="core"
      className="relative w-full min-h-screen bg-transparent text-slate-100 flex flex-col items-center justify-center px-4 py-6 select-none font-rajdhani overflow-hidden"
    >
      {/* Floating Top-Left 3D Moving Q-DYNAMICS Logo (No Box/Border) */}
      <div className="q-hud-top fixed top-3 left-3 sm:left-5 z-30 transition-all duration-300">
        <QDynamicsBrandLogo3D accentHex={activeSpec.hex} secondaryHex={activeSpec.secondaryHex} />
      </div>

      {/* Minimal Dismissible AI Studio Wrapper Helper */}
      {phoneTelemetry?.inIframeWrapper && directAppUrl && !dismissIframeNotice && (
        <div className="q-hud-top fixed top-4 left-1/2 -translate-x-1/2 z-30 max-w-[90vw] px-3 py-1.5 rounded-xl bg-black/75 border border-amber-400/40 backdrop-blur-md flex items-center gap-2 text-[11px] font-mono text-amber-200 transition-all duration-300">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <a
            href={directAppUrl}
            target="_top"
            rel="noopener noreferrer"
            className="hover:underline flex items-center gap-1 whitespace-nowrap"
          >
            <span>Open Direct App for Mobile Install</span>
            <ExternalLink className="w-3 h-3" />
          </a>
          <button
            type="button"
            onClick={() => setDismissIframeNotice(true)}
            className="text-slate-400 hover:text-white cursor-pointer"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ================================================================= */}
      {/* CENTER CLEAN VIEWPORT: MAIN 3D QUANTUM LOGO + LIVE SIGNAL WAVE    */}
      {/* ================================================================= */}
      <div className="relative z-10 w-full max-w-xl flex flex-col items-center justify-center md:pr-14 pb-16 md:pb-0">
        <CentralQuantumCoreHologram
          coherence={coherence}
          language={language}
          voiceGender={voiceGender}
          activeInterfaceTheme="quantum_cockpit"
          cockpitPhase={cockpitPhase}
          assistantName={activeCharName}
          onRenameAssistant={onRenameAssistant}
          onColorChange={handlePhaseColorChange}
          audioLevel={audioLevel}
          liveTranscript={liveTranscript}
          recordingSeconds={recordingSeconds}
          waWaveBars={waWaveBars}
          onCancelRecording={onCancelRecording}
          onSendRecording={onSendRecording}
          onStartManualRecording={onStartManualRecording}
          wakeReady={wakeReady}
          onPrimeWakeMic={onPrimeWakeMic}
          topologyIndex={topologyIndex}
          spectrumIndex={spectrumIndex}
          energySurge={energySurge}
        />
      </div>

      {/* ================================================================= */}
      {/* SIDEBAR POPOVER DRAWER: CORE CONTROLS (TOPOLOGY/SPECTRUM/SURGE/HUD) */}
      {/* ================================================================= */}
      {sidebarDrawer === "core" && (
        <div className="q-hud-chrome fixed z-40 bottom-16 left-1/2 -translate-x-1/2 md:translate-x-0 md:left-auto md:bottom-auto md:right-20 md:top-1/2 md:-translate-y-1/2 w-[min(320px,calc(100vw-24px))] rounded-2xl bg-[#070d1c]/95 border border-slate-400/25 p-4 shadow-2xl space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-slate-400/15 pb-2">
            <span className="font-orbitron font-bold text-xs tracking-wider text-slate-100 uppercase">
              3D Core &amp; Spectrum
            </span>
            <button
              type="button"
              onClick={() => setSidebarDrawer("none")}
              className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-1.5">
            <div className="font-mono text-[10px] uppercase tracking-widest text-slate-400">
              Topology
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {CORE_TOPOLOGIES.map((t) => {
                const active = topologyIndex === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onSelectTopology?.(t.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer text-left ${
                      active
                        ? "text-slate-100"
                        : "text-slate-400 bg-slate-900/75 border-slate-400/15 hover:text-slate-100"
                    }`}
                    style={
                      active
                        ? { borderColor: activeSpec.hex, backgroundColor: `${activeSpec.hex}24` }
                        : undefined
                    }
                  >
                    {t.shortLabel}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={onMorphNextTopology}
              className="w-full py-1.5 rounded-lg text-xs font-semibold border border-slate-400/20 bg-slate-900/75 text-slate-200 hover:border-cyan-400 transition cursor-pointer"
            >
              Morph Next Topology
            </button>
          </div>

          <div className="space-y-1.5">
            <div className="font-mono text-[10px] uppercase tracking-widest text-slate-400">
              Spectrum
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {QUANTUM_SPECTRUMS.map((sp, idx) => {
                const active = spectrumIndex === idx;
                return (
                  <button
                    key={sp.name}
                    type="button"
                    onClick={() => onSelectSpectrum?.(idx)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
                      active
                        ? "text-slate-100"
                        : "text-slate-400 bg-slate-900/75 border-slate-400/15 hover:text-slate-100"
                    }`}
                    style={
                      active ? { borderColor: sp.hex, backgroundColor: `${sp.hex}24` } : undefined
                    }
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: sp.hex }} />
                    <span className="truncate">{sp.name.split(" ")[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5 pt-1">
            <button
              type="button"
              onClick={onToggleEnergySurge}
              className={`py-2 rounded-lg text-xs font-bold transition cursor-pointer border ${
                energySurge
                  ? "text-[#030712] border-transparent"
                  : "text-slate-200 bg-slate-900/75 border-slate-400/20 hover:border-cyan-400"
              }`}
              style={
                energySurge
                  ? { background: `linear-gradient(135deg, ${activeSpec.hex}, ${activeSpec.secondaryHex})` }
                  : undefined
              }
            >
              {energySurge ? "Surge Active" : "Energy Surge"}
            </button>
            <button
              type="button"
              onClick={onToggleHudHidden}
              className="py-2 rounded-lg text-xs font-semibold border border-slate-400/20 bg-slate-900/75 text-slate-200 hover:border-cyan-400 transition cursor-pointer"
            >
              {hudHidden ? "Show HUD (H)" : "Hide HUD (H)"}
            </button>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* SIDEBAR POPOVER DRAWER: VOICE & REMINDER SUMMARY                  */}
      {/* ================================================================= */}
      {sidebarDrawer === "summary" && (
        <div className="q-hud-chrome fixed z-40 bottom-16 left-1/2 -translate-x-1/2 md:translate-x-0 md:left-auto md:bottom-auto md:right-20 md:top-1/2 md:-translate-y-1/2 w-[min(360px,calc(100vw-24px))] rounded-2xl bg-[#070d1c]/95 border border-slate-400/25 p-4 shadow-2xl animate-fadeIn">
          <div className="flex items-center justify-between border-b border-slate-400/15 pb-2 mb-2.5">
            <span className="font-orbitron font-bold text-xs tracking-wider text-slate-100 uppercase">
              Voice &amp; Reminder Summary
            </span>
            <button
              type="button"
              onClick={() => setSidebarDrawer("none")}
              className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div ref={summaryScrollRef} className="max-h-60 overflow-y-auto space-y-2.5 pr-1 text-xs">
            {cockpitSummaries.length === 0 ? (
              <div className="text-slate-400 font-mono py-4 text-center">
                No voice logs yet. Say &quot;Jarvis&quot; to begin.
              </div>
            ) : (
              cockpitSummaries.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-2 leading-snug">
                  <div className="min-w-0">
                    <span
                      className={`font-semibold mr-1.5 ${
                        item.role === "user"
                          ? "text-sky-300"
                          : item.role === "reminder"
                          ? "text-amber-300"
                          : "text-emerald-300"
                      }`}
                    >
                      {item.speaker}:
                    </span>
                    <span className="text-slate-200 break-words">{item.text}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 tabular shrink-0">
                    {item.timeStr}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* SINGLE CLEAN VERTICAL ICON SIDEBAR (DESKTOP) / BOTTOM BAR (MOBILE) */}
      {/* ================================================================= */}
      <nav
        aria-label="Jarvis Icon Bar"
        className="q-hud-chrome fixed z-30 bottom-2.5 left-1/2 -translate-x-1/2 max-w-[95vw] md:max-w-none md:left-auto md:translate-x-0 md:bottom-auto md:right-3.5 md:top-1/2 md:-translate-y-1/2 flex flex-row md:flex-col items-center gap-1 p-1.5 rounded-2xl bg-[#070d1c]/82 border border-white/10 shadow-2xl overflow-x-auto md:overflow-visible transition-all duration-300"
      >
        {sideActions.map((item) => {
          const IconComponent = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              title={item.label}
              aria-label={item.label}
              className={`group relative p-2.5 rounded-xl flex items-center justify-center transition shrink-0 cursor-pointer ${
                item.active
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/45"
                  : "text-slate-300 hover:text-white hover:bg-white/10 border border-transparent"
              }`}
            >
              <IconComponent className="w-4 h-4 shrink-0" />
              {item.badgeCount !== undefined && item.badgeCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#00f0ff]" />
              )}
              <span className="hidden md:block pointer-events-none opacity-0 group-hover:opacity-100 absolute right-full mr-2.5 px-2.5 py-1 rounded-lg bg-[#070d1c]/95 border border-slate-400/25 text-[11px] font-mono text-slate-100 whitespace-nowrap shadow-xl transition-opacity">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
