import React, { useState, useEffect, useRef } from "react";
import {
  LayoutGrid,
  Smartphone,
  Bell,
  CheckSquare,
  Heart,
  MessageSquare,
  AudioWaveform,
  Settings,
  Lock,
  X,
  Volume2,
  VolumeX,
  ScrollText,
  Film,
  Users,
  Maximize2,
  Eye,
  Sparkles,
  RefreshCw,
  Sliders,
  Briefcase,
  GraduationCap,
  DollarSign,
  Mic,
  Trash2,
} from "lucide-react";
import { soundEffects } from "../services/soundEffects";
import { triggerHaptic } from "../services/mobileDeviceActions";
import { UserProfile, DashboardCustomization, LanguageCode, VoiceGender } from "../types";
import { QuantumThemeColor } from "./AutoMorphingQuantumLogo";
import {
  CockpitCorePhase,
  QUANTUM_SPECTRUMS,
} from "./CentralQuantumCoreHologram";
import { DualCharacterHoloStage, HubPanelNotification } from "./DualCharacterHoloStage";
import { QDynamicsBrandLogo3D } from "./QDynamicsBrandLogo3D";
import { getCharacterDisplayName } from "../data/jarvisCatalog";
import type { MatrixModuleId } from "./QuantumAppsMatrix";
import { MobileCommsControlHub } from "./MobileCommsControlHub";
import { DesktopManager } from "./DesktopManager";
import { StudentStudyHub } from "./StudentStudyHub";
import { BusinessAdvisorHub } from "./BusinessAdvisorHub";
import { LifeRecordsManager } from "./LifeRecordsManager";
import { HealthLifestyleGuard } from "./HealthLifestyleGuard";
import { FinanceInvestManager } from "./FinanceInvestManager";
import { QuantumFocusAnalytics } from "./QuantumFocusAnalytics";
import { PersonalMemoryBank } from "./PersonalMemoryBank";
import { WorkflowAutomationSuite } from "./WorkflowAutomationSuite";
import { CommunicationCodingSuite } from "./CommunicationCodingSuite";
import { QuantumGeospatialMapSuite } from "./QuantumGeospatialMapSuite";
import { DigitalDeviceBridgeSuite } from "./DigitalDeviceBridgeSuite";
import { CreativeMediaStudio } from "./CreativeMediaStudio";

export interface CockpitSummaryItem {
  id: string;
  role: "user" | "assistant" | "reminder";
  speaker: string;
  text: string;
  timeStr: string;
}

const MODULE_PROJECTED_TITLES: Record<MatrixModuleId, string> = {
  comms: "Mobile Alerts, Calls & Control Panel",
  desktop: "Phone Hardware & File Vault",
  study: "Study, Labs & Live Simulation Hub",
  business: "Business Command & Growth Advisor",
  records: "Universal Life Records Vault",
  health: "Health & Lifestyle Shield",
  finance: "Expenses & Fazool Kharchi Defense",
  focus: "Deep Focus Chamber",
  memory: "Tasks, Goals & Neural Memory",
  automation: "Workflow Automation Engine",
  communication: "Omni-Channel & Coding Copilot",
  maps: "Geospatial Radar & GPS",
  devices: "Digital Device Bridge",
  studio: "Creative AI Media Studio",
};

interface UltraCockpitDashboardProps {
  userProfile: UserProfile;
  onUpdateProfile?: (profile: UserProfile) => void;
  customization: DashboardCustomization;
  currentTheme?: QuantumThemeColor;
  coherence: number;
  isSpeaking: boolean;
  isListening: boolean;
  screenWorkMinutes: number;
  onOpenVoiceModal: () => void;
  onOpenAppsMatrix: () => void;
  onOpenModule?: (moduleId: MatrixModuleId) => void;
  activeProjectedModule?: MatrixModuleId | null;
  onCloseProjectedModule?: () => void;
  activeHubNotification?: HubPanelNotification | null;
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
  onClearSummary?: () => void;
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
  liveReplyText?: string;
  onSwitchGender?: (nextGender: "male" | "female") => void;
  onRenameGenderName?: (gender: "male" | "female", newName: string) => void;
  onOpenCharacterSettings?: () => void;
  detailViewNonce?: number;
  pausedByFullscreen?: boolean;
}

export const UltraCockpitDashboard: React.FC<UltraCockpitDashboardProps> = ({
  userProfile,
  onUpdateProfile,
  customization,
  coherence,
  isListening,
  onOpenVoiceModal,
  onOpenAppsMatrix,
  onOpenModule,
  activeProjectedModule = null,
  onCloseProjectedModule,
  activeHubNotification = null,
  onOpenSettings,
  onPrimeWakeMic,
  wakeReady,
  onLockScreen,
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
  onClearSummary,
  spectrumIndex = 0,
  energySurge = false,
  onShowIdentityVideo,
  onSpeakBriefing,
  liveReplyText = "",
  onSwitchGender,
  onRenameGenderName,
  onOpenCharacterSettings,
  detailViewNonce = 0,
  pausedByFullscreen = false,
}) => {
  const [soundOn, setSoundOn] = useState(soundEffects.soundEnabled);
  const [sidebarDrawer, setSidebarDrawer] = useState<"none" | "characters" | "summary">("none");
  const isMobileScreen = typeof window !== "undefined" && window.innerWidth < 768;
  const [isIconFlightActive, setIsIconFlightActive] = useState(!isMobileScreen);
  const summaryScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isIconFlightActive) return;
    const settleTimer = setTimeout(() => {
      setIsIconFlightActive(false);
    }, 2200);
    return () => clearTimeout(settleTimer);
  }, [isIconFlightActive]);

  useEffect(() => {
    if (detailViewNonce > 0) {
      setSidebarDrawer("summary");
    }
  }, [detailViewNonce]);

  const activeGender: "male" | "female" =
    customization.avatarConfig?.characterGender === "male" ? "male" : "female";
  const activeCharName = getCharacterDisplayName(customization.avatarConfig, activeGender);
  const maleCharName = getCharacterDisplayName(customization.avatarConfig, "male");
  const femaleCharName = getCharacterDisplayName(customization.avatarConfig, "female");
  const activeSpec = QUANTUM_SPECTRUMS[spectrumIndex % QUANTUM_SPECTRUMS.length];

  useEffect(() => {
    if (summaryScrollRef.current) {
      summaryScrollRef.current.scrollTop = summaryScrollRef.current.scrollHeight;
    }
  }, [cockpitSummaries, liveTranscript, sidebarDrawer]);

  const projectedTitle = activeProjectedModule
    ? MODULE_PROJECTED_TITLES[activeProjectedModule] || "Tech Hub Terminal"
    : null;

  const sideActions: {
    id: string;
    label: string;
    icon: React.ElementType;
    onClick: () => void;
    active?: boolean;
    badgeCount?: number;
    color: string;
    bgFrom: string;
    bgTo: string;
    borderHex: string;
    glowHex: string;
  }[] = [
    {
      id: "characters",
      label: "Characters & Views",
      icon: Users,
      active: sidebarDrawer === "characters",
      color: "#38bdf8",
      bgFrom: "rgba(6, 182, 212, 0.34)",
      bgTo: "rgba(14, 116, 144, 0.18)",
      borderHex: "rgba(56, 189, 248, 0.55)",
      glowHex: "rgba(56, 189, 248, 0.42)",
      onClick: () => {
        soundEffects.playClick();
        setSidebarDrawer((prev) => (prev === "characters" ? "none" : "characters"));
      },
    },
    {
      id: "identity_video",
      label: "Full View",
      icon: Film,
      color: "#e879f9",
      bgFrom: "rgba(168, 85, 247, 0.36)",
      bgTo: "rgba(217, 70, 239, 0.18)",
      borderHex: "rgba(232, 121, 249, 0.55)",
      glowHex: "rgba(217, 70, 239, 0.42)",
      onClick: () => {
        soundEffects.playBeepConfirm();
        setSidebarDrawer("none");
        onShowIdentityVideo?.();
      },
    },
    {
      id: "summary",
      label: "Summary Log",
      icon: ScrollText,
      active: sidebarDrawer === "summary",
      badgeCount: cockpitSummaries.length,
      color: "#fbbf24",
      bgFrom: "rgba(245, 158, 11, 0.36)",
      bgTo: "rgba(180, 83, 9, 0.18)",
      borderHex: "rgba(251, 191, 36, 0.55)",
      glowHex: "rgba(245, 158, 11, 0.42)",
      onClick: () => {
        soundEffects.playClick();
        setSidebarDrawer((prev) => (prev === "summary" ? "none" : "summary"));
      },
    },
    {
      id: "study",
      label: "Study & Labs",
      icon: GraduationCap,
      active: activeProjectedModule === "study",
      color: "#60a5fa",
      bgFrom: "rgba(59, 130, 246, 0.36)",
      bgTo: "rgba(29, 78, 216, 0.18)",
      borderHex: "rgba(96, 165, 250, 0.55)",
      glowHex: "rgba(59, 130, 246, 0.42)",
      onClick: () => {
        soundEffects.playClick();
        onOpenModule?.("study");
      },
    },
    {
      id: "business",
      label: "Business Hub",
      icon: Briefcase,
      active: activeProjectedModule === "business",
      color: "#fb923c",
      bgFrom: "rgba(249, 115, 22, 0.36)",
      bgTo: "rgba(234, 88, 12, 0.18)",
      borderHex: "rgba(251, 146, 60, 0.55)",
      glowHex: "rgba(249, 115, 22, 0.42)",
      onClick: () => {
        soundEffects.playClick();
        onOpenModule?.("business");
      },
    },
    {
      id: "finance",
      label: "Expenses Guard",
      icon: DollarSign,
      active: activeProjectedModule === "finance",
      color: "#34d399",
      bgFrom: "rgba(16, 185, 129, 0.36)",
      bgTo: "rgba(5, 150, 105, 0.18)",
      borderHex: "rgba(52, 211, 153, 0.55)",
      glowHex: "rgba(16, 185, 129, 0.42)",
      onClick: () => {
        soundEffects.playClick();
        onOpenModule?.("finance");
      },
    },
    {
      id: "apps",
      label: "All Apps Matrix",
      icon: LayoutGrid,
      color: "#c084fc",
      bgFrom: "rgba(139, 92, 246, 0.36)",
      bgTo: "rgba(192, 132, 252, 0.18)",
      borderHex: "rgba(192, 132, 252, 0.55)",
      glowHex: "rgba(168, 85, 247, 0.42)",
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
      active: activeProjectedModule === "desktop",
      color: "#22d3ee",
      bgFrom: "rgba(14, 165, 233, 0.36)",
      bgTo: "rgba(6, 182, 212, 0.18)",
      borderHex: "rgba(34, 211, 238, 0.55)",
      glowHex: "rgba(14, 165, 233, 0.42)",
      onClick: () => {
        soundEffects.playClick();
        onOpenModule?.("desktop");
      },
    },
    {
      id: "alerts",
      label: "Mobile Alerts",
      icon: Bell,
      active: activeProjectedModule === "comms",
      color: "#facc15",
      bgFrom: "rgba(234, 179, 8, 0.36)",
      bgTo: "rgba(202, 138, 4, 0.18)",
      borderHex: "rgba(250, 204, 21, 0.55)",
      glowHex: "rgba(234, 179, 8, 0.42)",
      onClick: () => {
        soundEffects.playClick();
        onOpenModule?.("comms");
      },
    },
    {
      id: "tasks",
      label: "Tasks & Memory",
      icon: CheckSquare,
      active: activeProjectedModule === "memory",
      color: "#2dd4bf",
      bgFrom: "rgba(20, 184, 166, 0.36)",
      bgTo: "rgba(13, 148, 136, 0.18)",
      borderHex: "rgba(45, 212, 191, 0.55)",
      glowHex: "rgba(20, 184, 166, 0.42)",
      onClick: () => {
        soundEffects.playClick();
        onOpenModule?.("memory");
      },
    },
    {
      id: "health",
      label: "Health Shield",
      icon: Heart,
      active: activeProjectedModule === "health",
      color: "#fb7185",
      bgFrom: "rgba(244, 63, 94, 0.38)",
      bgTo: "rgba(225, 29, 72, 0.18)",
      borderHex: "rgba(251, 113, 133, 0.58)",
      glowHex: "rgba(244, 63, 94, 0.44)",
      onClick: () => {
        soundEffects.playClick();
        onOpenModule?.("health");
      },
    },
    {
      id: "chat",
      label: "Voice Chat",
      icon: MessageSquare,
      color: "#a78bfa",
      bgFrom: "rgba(139, 92, 246, 0.36)",
      bgTo: "rgba(99, 102, 241, 0.18)",
      borderHex: "rgba(167, 139, 250, 0.55)",
      glowHex: "rgba(139, 92, 246, 0.42)",
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
      color: "#4ade80",
      bgFrom: "rgba(34, 197, 94, 0.36)",
      bgTo: "rgba(22, 163, 74, 0.18)",
      borderHex: "rgba(74, 222, 128, 0.55)",
      glowHex: "rgba(34, 197, 94, 0.45)",
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
      color: soundOn ? "#00f0ff" : "#94a3b8",
      bgFrom: soundOn ? "rgba(0, 240, 255, 0.32)" : "rgba(71, 85, 105, 0.28)",
      bgTo: soundOn ? "rgba(6, 182, 212, 0.16)" : "rgba(30, 41, 59, 0.2)",
      borderHex: soundOn ? "rgba(0, 240, 255, 0.5)" : "rgba(148, 163, 184, 0.35)",
      glowHex: soundOn ? "rgba(0, 240, 255, 0.38)" : "rgba(100, 116, 139, 0.25)",
      onClick: () => {
        const next = !soundEffects.soundEnabled;
        soundEffects.soundEnabled = next;
        setSoundOn(next);
        if (next) soundEffects.playKeyClick(880);
      },
    },
    {
      id: "settings",
      label: "Settings",
      icon: Settings,
      color: "#cbd5e1",
      bgFrom: "rgba(100, 116, 139, 0.38)",
      bgTo: "rgba(56, 189, 248, 0.16)",
      borderHex: "rgba(148, 163, 184, 0.55)",
      glowHex: "rgba(148, 163, 184, 0.38)",
      onClick: () => {
        soundEffects.playClick();
        onOpenSettings();
      },
    },
    {
      id: "lock",
      label: "Lock",
      icon: Lock,
      color: "#f87171",
      bgFrom: "rgba(239, 68, 68, 0.38)",
      bgTo: "rgba(185, 28, 28, 0.2)",
      borderHex: "rgba(248, 113, 113, 0.58)",
      glowHex: "rgba(239, 68, 68, 0.45)",
      onClick: () => {
        soundEffects.playAlert();
        triggerHaptic([35, 20, 35]);
        onLockScreen?.();
      },
    },
  ];

  const showDockLabels = customization.dockShowLabels !== false;
  const dockSize = customization.dockIconSize || "normal";

  return (
    <div
      id="core"
      className="relative flex flex-col items-center justify-center min-h-[100dvh] h-[100dvh] w-full overflow-hidden select-none"
    >
      {/* Top-Left Moving 3D Wasu's Jarvis Brand Logo */}
      <div className="q-hud-chrome fixed top-2.5 left-2.5 sm:top-4 sm:left-4 z-30 pointer-events-auto scale-90 origin-top-left sm:scale-100 transition-transform duration-300">
        <QDynamicsBrandLogo3D
          accentHex={activeSpec.hex}
          secondaryHex={activeSpec.secondaryHex}
          brandTitle={customization.brandTitle || "WASU'S JARVIS"}
          brandSubtitle={customization.brandSubtitle || "MOBILE QUANTUM OS"}
          logoStyle={customization.logoStyle || "reactor"}
        />
      </div>

      {/* ================================================================= */}
      {/* FULL-SCREEN STAGE: LIVING WASU & WASI KI JAN IN TECHNOLOGY HUB    */}
      {/* ================================================================= */}
      <DualCharacterHoloStage
        coherence={coherence}
        language={language}
        voiceGender={activeGender}
        cockpitPhase={cockpitPhase}
        assistantName={activeCharName}
        maleName={maleCharName}
        femaleName={femaleCharName}
        onRenameAssistant={onRenameAssistant}
        onSwitchGender={onSwitchGender}
        audioLevel={audioLevel}
        liveTranscript={liveTranscript}
        liveReplyText={liveReplyText}
        recordingSeconds={recordingSeconds}
        waWaveBars={waWaveBars}
        onCancelRecording={onCancelRecording}
        onSendRecording={onSendRecording}
        onStartManualRecording={onStartManualRecording}
        onSpeakBriefing={onSpeakBriefing}
        onShowIdentityVideo={onShowIdentityVideo}
        wakeReady={wakeReady}
        onPrimeWakeMic={onPrimeWakeMic}
        spectrumIndex={spectrumIndex}
        energySurge={energySurge}
        pausedByFullscreen={pausedByFullscreen || Boolean(activeProjectedModule)}
        activeHubNotification={activeHubNotification}
        activeProjectedTitle={projectedTitle}
      />

      {/* ================================================================= */}
      {/* PROJECTED BIG HUB SCREEN: CHARACTERS OPEN & CONTROL ALL PANELS    */}
      {/* ================================================================= */}
      {activeProjectedModule && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-2 sm:p-5 bg-[#020612]/90 md:backdrop-blur-lg animate-fadeIn">
          <div className="relative w-full max-w-5xl h-[88dvh] rounded-3xl bg-[#040a18] border border-cyan-400/45 shadow-2xl flex flex-col overflow-hidden text-slate-100">
            {/* Characters Live Working Terminal Bar */}
            <div className="px-4 sm:px-5 py-3 bg-[#071127]/95 border-b border-cyan-500/30 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-400/45 flex items-center justify-center text-cyan-300 shrink-0">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-orbitron font-bold text-xs sm:text-sm text-cyan-300 uppercase tracking-wider truncate">
                    {projectedTitle}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 truncate">
                    {cockpitPhase === "recording"
                      ? `LISTENING: "${liveTranscript || "Speak now..."}"`
                      : cockpitPhase === "processing"
                      ? "LOADING: Processing hub request..."
                      : cockpitPhase === "speaking"
                      ? `SPEAKING (${activeCharName}): ${liveReplyText || "Responding live..."}`
                      : `${activeCharName} & ${activeGender === "male" ? femaleCharName : maleCharName} operating Tech Hub Screen`}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    soundEffects.playBeepConfirm();
                    if (!wakeReady && onPrimeWakeMic) onPrimeWakeMic();
                    else onStartManualRecording?.();
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold border flex items-center gap-1.5 cursor-pointer transition ${
                    cockpitPhase === "recording"
                      ? "bg-emerald-500/25 border-emerald-400 text-emerald-200"
                      : "bg-slate-900 border-cyan-500/35 text-cyan-200 hover:bg-slate-800"
                  }`}
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>{cockpitPhase === "recording" ? "Listening" : "Talk"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEffects.playClick();
                    setSidebarDrawer("summary");
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-mono cursor-pointer transition"
                  title="Detail Summary"
                >
                  Summary
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEffects.playClick();
                    onCloseProjectedModule?.();
                  }}
                  className="px-3 py-1.5 rounded-xl bg-rose-950/75 hover:bg-rose-900 border border-rose-500/40 text-rose-200 text-xs font-mono font-bold flex items-center gap-1 cursor-pointer transition"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Close Panel</span>
                </button>
              </div>
            </div>

            {/* Active Workspace Body Rendered Directly on Hub Screen */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-5">
              {activeProjectedModule === "comms" && (
                <MobileCommsControlHub
                  language={language}
                  voiceGender={voiceGender}
                />
              )}
              {activeProjectedModule === "desktop" && (
                <DesktopManager language={language} voiceGender={voiceGender} />
              )}
              {activeProjectedModule === "study" && (
                <StudentStudyHub language={language} voiceGender={voiceGender} />
              )}
              {activeProjectedModule === "business" && (
                <BusinessAdvisorHub language={language} voiceGender={voiceGender} />
              )}
              {activeProjectedModule === "records" && (
                <LifeRecordsManager language={language} voiceGender={voiceGender} />
              )}
              {activeProjectedModule === "health" && (
                <HealthLifestyleGuard language={language} voiceGender={voiceGender} />
              )}
              {activeProjectedModule === "finance" && (
                <FinanceInvestManager language={language} voiceGender={voiceGender} />
              )}
              {activeProjectedModule === "focus" && (
                <QuantumFocusAnalytics language={language} voiceGender={voiceGender} />
              )}
              {activeProjectedModule === "memory" && (
                <PersonalMemoryBank
                  userProfile={userProfile}
                  onUpdateProfile={onUpdateProfile || (() => {})}
                  language={language}
                  voiceGender={voiceGender}
                />
              )}
              {activeProjectedModule === "automation" && (
                <WorkflowAutomationSuite language={language} voiceGender={voiceGender} />
              )}
              {activeProjectedModule === "communication" && (
                <CommunicationCodingSuite language={language} voiceGender={voiceGender} />
              )}
              {activeProjectedModule === "maps" && (
                <QuantumGeospatialMapSuite
                  language={language}
                  voiceGender={voiceGender}
                  onSelectDevice={() => onOpenModule?.("devices")}
                />
              )}
              {activeProjectedModule === "devices" && (
                <DigitalDeviceBridgeSuite
                  language={language}
                  voiceGender={voiceGender}
                  onOpenMapLocation={() => onOpenModule?.("maps")}
                />
              )}
              {activeProjectedModule === "studio" && (
                <CreativeMediaStudio language={language} voiceGender={voiceGender} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* SIDEBAR POPOVER DRAWER: CHARACTERS CUSTOMIZATION & VIEWS           */}
      {/* ================================================================= */}
      {sidebarDrawer === "characters" && (
        <div className="q-hud-chrome fixed z-40 bottom-16 left-1/2 -translate-x-1/2 md:translate-x-0 md:left-auto md:bottom-auto md:right-24 md:top-1/2 md:-translate-y-1/2 w-[min(340px,calc(100vw-24px))] rounded-2xl bg-[#070d1c]/95 border border-cyan-400/35 p-4 shadow-2xl space-y-3.5 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-slate-400/15 pb-2">
            <span className="font-orbitron font-bold text-xs tracking-wider text-cyan-300 uppercase flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              <span>Characters &amp; Stage Views</span>
            </span>
            <button
              type="button"
              onClick={() => setSidebarDrawer("none")}
              className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Full View & Detail View Controls */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                soundEffects.playBeepConfirm();
                setSidebarDrawer("none");
                onShowIdentityVideo?.();
              }}
              className="py-2 px-2.5 rounded-xl bg-purple-950/70 hover:bg-purple-900/80 border border-purple-400/45 text-purple-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Full View</span>
            </button>
            <button
              type="button"
              onClick={() => {
                soundEffects.playClick();
                setSidebarDrawer("summary");
              }}
              className="py-2 px-2.5 rounded-xl bg-cyan-950/70 hover:bg-cyan-900/80 border border-cyan-400/45 text-cyan-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Detail View</span>
            </button>
          </div>

          {onSpeakBriefing && (
            <button
              type="button"
              onClick={() => {
                soundEffects.playBeepConfirm();
                setSidebarDrawer("none");
                onSpeakBriefing();
              }}
              className="w-full py-2 px-3 rounded-xl bg-emerald-950/70 hover:bg-emerald-900/80 border border-emerald-400/45 text-emerald-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Sara Kuch Batao (Briefing)</span>
            </button>
          )}

          {/* Switch Active Character Voice */}
          <div className="space-y-1.5 pt-1 border-t border-slate-400/15">
            <div className="font-mono text-[10px] uppercase tracking-widest text-slate-400">
              Active Speaking Character
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  soundEffects.playQuantumWarp();
                  onSwitchGender?.("female");
                }}
                className={`py-2 px-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition ${
                  activeGender === "female"
                    ? "bg-cyan-500/25 border-cyan-400 text-cyan-100"
                    : "bg-slate-900/80 border-slate-700 text-slate-400 hover:text-white"
                }`}
              >
                <RefreshCw className="w-3 h-3" />
                <span className="truncate">{femaleCharName}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEffects.playQuantumWarp();
                  onSwitchGender?.("male");
                }}
                className={`py-2 px-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition ${
                  activeGender === "male"
                    ? "bg-amber-500/25 border-amber-400 text-amber-100"
                    : "bg-slate-900/80 border-slate-700 text-slate-400 hover:text-white"
                }`}
              >
                <RefreshCw className="w-3 h-3" />
                <span className="truncate">{maleCharName}</span>
              </button>
            </div>
          </div>

          {/* Customize Both Character Names */}
          <div className="space-y-2 pt-1 border-t border-slate-400/15">
            <div className="font-mono text-[10px] uppercase tracking-widest text-slate-400">
              Customize Character Names
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-cyan-300 mb-1">Female Name</label>
                <input
                  type="text"
                  value={customization.avatarConfig?.customFemaleName ?? "Wasi ki Jan"}
                  onChange={(e) => onRenameGenderName?.("female", e.target.value)}
                  maxLength={24}
                  placeholder="Wasi ki Jan"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 focus:border-cyan-400 text-slate-100 text-xs outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] text-amber-300 mb-1">Male Name</label>
                <input
                  type="text"
                  value={customization.avatarConfig?.customMaleName ?? "Wasu"}
                  onChange={(e) => onRenameGenderName?.("male", e.target.value)}
                  maxLength={24}
                  placeholder="Wasu"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 focus:border-amber-400 text-slate-100 text-xs outline-none"
                />
              </div>
            </div>
          </div>

          {/* Open Voice & Accent Settings */}
          <button
            type="button"
            onClick={() => {
              soundEffects.playClick();
              setSidebarDrawer("none");
              if (onOpenCharacterSettings) {
                onOpenCharacterSettings();
              } else {
                onOpenSettings();
              }
            }}
            className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-cyan-500/35 text-cyan-200 text-xs font-mono flex items-center justify-center gap-1.5 cursor-pointer transition"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Voice, Pitch &amp; Schedule Settings</span>
          </button>
        </div>
      )}

      {/* ================================================================= */}
      {/* SIDEBAR POPOVER DRAWER: NOTIFICATIONS & VOICE SUMMARY LOG         */}
      {/* ================================================================= */}
      {sidebarDrawer === "summary" && (
        <div className="q-hud-chrome fixed z-50 bottom-20 left-1/2 -translate-x-1/2 md:translate-x-0 md:left-auto md:bottom-auto md:right-40 md:top-1/2 md:-translate-y-1/2 w-[min(360px,calc(100vw-24px))] rounded-2xl bg-[#070d1c]/95 border border-slate-400/25 p-4 shadow-2xl animate-fadeIn">
          <div className="flex items-center justify-between border-b border-slate-400/15 pb-2 mb-2.5">
            <span className="font-orbitron font-bold text-xs tracking-wider text-amber-300 uppercase">
              Alerts &amp; Summary Log
            </span>
            <div className="flex items-center gap-1.5">
              {onClearSummary && cockpitSummaries.length > 0 && (
                <button
                  type="button"
                  onClick={onClearSummary}
                  title="Clear Log"
                  className="p-1 rounded-lg text-slate-400 hover:text-rose-400 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setSidebarDrawer("none")}
                className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
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
      {/* FIELD-COLORED 3D CRYSTAL ORBITAL DOCK WITH VISIBLE ICON LABELS    */}
      {/* ================================================================= */}
      <nav
        id="jarvis-orbital-dock"
        aria-label="Wasu's Jarvis Mobile Dock"
        className={`q-hud-chrome fixed z-30 bottom-[max(0.5rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 max-w-[96vw] md:max-w-none md:left-auto md:translate-x-0 md:bottom-auto md:right-3 md:top-1/2 md:-translate-y-1/2 flex flex-row md:flex-col items-stretch gap-1.5 md:gap-1 p-2 md:py-2.5 md:px-2 rounded-2xl md:rounded-3xl transition-opacity duration-300 ${
          isIconFlightActive
            ? "bg-transparent border border-transparent shadow-none overflow-visible"
            : "bg-[#040916]/90 border border-white/15 md:border-cyan-400/30 shadow-2xl md:backdrop-blur-md overflow-x-auto md:max-h-[86vh] md:overflow-y-auto"
        }`}
        style={{
          opacity: (customization.hudOpacity ?? 95) / 100,
        }}
      >
        {sideActions.map((item, idx) => {
          const IconComponent = item.icon;
          const total = sideActions.length;
          const norm = total > 1 ? idx / (total - 1) : 0.5;
          const curveX = -Math.round(Math.sin(norm * Math.PI) * 14);
          const floatDelay = `${(idx * 0.14).toFixed(2)}s`;

          const angle = (idx / total) * Math.PI * 2;
          const startX = `${(-44 - Math.abs(Math.cos(angle)) * 38).toFixed(1)}vw`;
          const startY = `${(Math.sin(angle * 2) * 38).toFixed(1)}vh`;
          const midX = `${(-16 - Math.abs(Math.sin(angle)) * 28).toFixed(1)}vw`;
          const midY = `${(Math.cos(angle * 2) * 20).toFixed(1)}vh`;
          const mobStartX = `${(Math.cos(angle) * 38).toFixed(1)}vw`;
          const mobStartY = `${(-42 - (idx % 4) * 10).toFixed(1)}vh`;
          const mobMidX = `${(Math.sin(angle) * 18).toFixed(1)}vw`;
          const mobMidY = `${(-14 - (idx % 3) * 6).toFixed(1)}vh`;
          const flyDelay = `${(idx * 0.04).toFixed(3)}s`;

          const iconSizeClass =
            dockSize === "large"
              ? "w-[22px] h-[22px]"
              : dockSize === "compact"
              ? "w-[16px] h-[16px]"
              : "w-[18px] h-[18px]";

          return (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              title={item.label}
              aria-label={item.label}
              style={
                {
                  "--orb-x": `${curveX}px`,
                  "--orb-delay": floatDelay,
                  "--fly-x0": startX,
                  "--fly-y0": startY,
                  "--fly-x1": midX,
                  "--fly-y1": midY,
                  "--fly-mx0": mobStartX,
                  "--fly-my0": mobStartY,
                  "--fly-mx1": mobMidX,
                  "--fly-my1": mobMidY,
                  "--fly-delay": flyDelay,
                  background: `linear-gradient(145deg, ${item.bgFrom}, ${item.bgTo})`,
                  borderColor: item.active ? item.color : item.borderHex,
                  color: "#ffffff",
                  boxShadow: item.active
                    ? `0 0 18px ${item.glowHex}, 0 0 0 1.5px ${item.color}, inset 0 1px 2px rgba(255,255,255,0.45)`
                    : `0 4px 14px -2px ${item.glowHex}, inset 0 1px 2px rgba(255,255,255,0.28)`,
                } as React.CSSProperties
              }
              className={`${
                isIconFlightActive ? "q-orbital-enter" : "q-orbital-item"
              } group relative min-w-[54px] min-h-[46px] md:min-w-[122px] md:min-h-[34px] px-2 py-1.5 md:px-2.5 md:py-1 rounded-2xl md:rounded-xl border flex flex-col md:flex-row items-center justify-center md:justify-start gap-1 md:gap-2 shrink-0 cursor-pointer transition-[filter,transform] duration-200 hover:scale-[1.06] hover:brightness-125`}
            >
              <IconComponent
                className={`relative z-10 ${iconSizeClass} shrink-0`}
                style={{
                  color: item.color,
                  filter: isMobileScreen ? undefined : `drop-shadow(0 0 6px ${item.color})`,
                }}
              />
              {showDockLabels && (
                <span className="relative z-10 text-[9px] md:text-[10px] font-mono font-semibold text-slate-100 leading-none tracking-tight whitespace-nowrap max-w-[66px] md:max-w-[96px] truncate">
                  {item.label}
                </span>
              )}
              {item.badgeCount !== undefined && item.badgeCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 z-20 px-1 min-w-[16px] h-4 rounded-full border border-[#040916] text-[9px] font-mono font-bold text-slate-950 flex items-center justify-center"
                  style={{ backgroundColor: item.color, boxShadow: `0 0 8px ${item.color}` }}
                >
                  {item.badgeCount > 99 ? "99+" : item.badgeCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

