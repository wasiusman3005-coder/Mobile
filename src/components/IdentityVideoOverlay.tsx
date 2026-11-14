import React, { useEffect, useRef, useState } from "react";
import {
  X,
  Volume2,
  Mic,
  RefreshCw,
  CheckSquare,
  Heart,
  Bell,
  Smartphone,
  LayoutGrid,
  Settings,
  Zap,
  ShieldCheck,
  Activity,
} from "lucide-react";
import { speechService } from "../services/speechService";
import { soundEffects } from "../services/soundEffects";
import { storageService } from "../services/storage";
import { readPhoneHardwareTelemetry, PhoneHardwareTelemetry } from "../services/systemTelemetry";
import { MatrixModuleId } from "./QuantumAppsMatrix";

interface IdentityVideoOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  maleName?: string;
  femaleName?: string;
  activeGender?: "male" | "female";
  onSwitchGender?: (nextGender: "male" | "female") => void;
  onTriggerVoice?: () => void;
  onOpenModule?: (moduleId: MatrixModuleId) => void;
  onOpenAppsMatrix?: () => void;
  onOpenSettings?: () => void;
}

export const IDENTITY_REVEAL_VIDEO_SRC = "/assets/aistudio/gemini_generated_video_0cd468c8_a6b6456c.mp4";

const HOLO_AURAS = [
  { name: "Dual Cyber", left: "#38bdf8", right: "#f59e0b", border: "rgba(56,189,248,0.45)" },
  { name: "Indigo Pulse", left: "#8b5cf6", right: "#ec4899", border: "rgba(139,92,246,0.45)" },
  { name: "Emerald Core", left: "#10b981", right: "#06b6d4", border: "rgba(16,185,129,0.45)" },
  { name: "Solar Nova", left: "#f97316", right: "#facc15", border: "rgba(249,115,22,0.45)" },
];

interface AutonomousActionItem {
  id: string;
  label: string;
  detail: string;
  tag: string;
}

export const IdentityVideoOverlay: React.FC<IdentityVideoOverlayProps> = ({
  isOpen,
  onClose,
  maleName = "Wasu",
  femaleName = "Wasi ki Jan",
  activeGender = "female",
  onSwitchGender,
  onTriggerVoice,
  onOpenModule,
  onOpenAppsMatrix,
  onOpenSettings,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const [isMuted, setIsMuted] = useState(false);
  const [autoplayAudioBlocked, setAutoplayAudioBlocked] = useState(false);
  const [auraIndex, setAuraIndex] = useState(0);
  const [actionIndex, setActionIndex] = useState(0);
  const [cycleCount, setCycleCount] = useState(1);
  const [telemetry, setTelemetry] = useState<PhoneHardwareTelemetry | null>(null);
  const [liveFeed, setLiveFeed] = useState<AutonomousActionItem[]>([
    {
      id: "boot",
      label: "HOLOGRAPHIC CORE ACTIVE",
      detail: "Pakistani Urdu Dual Engine Synchronized",
      tag: "LIVE",
    },
  ]);

  // Initialize and play full MP4 continuously ONLY when overlay opens — never reset on parent re-renders
  useEffect(() => {
    if (!isOpen) return;

    speechService.cancelSpeech();
    setAutoplayAudioBlocked(false);
    setIsMuted(false);

    const vid = videoRef.current;
    let stallWatchdog: ReturnType<typeof setInterval> | null = null;

    if (vid) {
      vid.currentTime = 0;
      vid.loop = true;
      vid.muted = false;
      vid.play().catch(() => {
        vid.muted = true;
        setIsMuted(true);
        setAutoplayAudioBlocked(true);
        vid.play().catch(() => {});
      });

      // Gentle playback watchdog: keeps continuous motion without resetting currentTime
      stallWatchdog = setInterval(() => {
        if (vid.paused && !vid.seeking) {
          vid.play().catch(() => {});
        }
      }, 1500);
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      if (stallWatchdog) clearInterval(stallWatchdog);
      window.removeEventListener("keydown", onKeyDown);
      if (vid) {
        vid.pause();
      }
    };
  }, [isOpen]);

  // Continuous Autonomous Multi-Action Engine performing real live checks while video loops
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    const refreshAutonomousActions = async () => {
      const tel = await readPhoneHardwareTelemetry().catch(() => null);
      if (cancelled) return;
      if (tel) setTelemetry(tel);

      const tasks = storageService.getTasks();
      const pendingTasks = tasks.filter((t) => !t.completed);
      const health = storageService.getHealth();
      const hasHealth =
        health.waterDrankGlasses > 0 ||
        health.mealsLogged.length > 0 ||
        health.sleepHoursLastNight > 0 ||
        health.dailySteps > 0;

      let lifeCount = 0;
      try {
        const raw = localStorage.getItem("q_nexus_life_records");
        const parsed = raw ? JSON.parse(raw) : [];
        lifeCount = Array.isArray(parsed) ? parsed.length : 0;
      } catch {}

      const cust = storageService.getCustomization();
      const sched = cust.avatarConfig?.voiceSchedule;
      const activeSpeaker = activeGender === "male" ? maleName : femaleName;

      const items: AutonomousActionItem[] = [
        {
          id: "hw",
          label: "DEVICE & BATTERY DIAGNOSTICS",
          detail: tel
            ? `${tel.deviceName} · Battery ${tel.batteryPercent !== null ? `${tel.batteryPercent}%` : "AC"} · ${tel.cpuThreads} Cores · ${tel.networkType}`
            : "Hardware & Network Telemetry Online",
          tag: "SCAN",
        },
        {
          id: "tasks",
          label: "TASKS & LIFE ROUTINE MONITOR",
          detail:
            pendingTasks.length > 0
              ? `${pendingTasks.length} Pending · Next: ${pendingTasks[0].title}`
              : lifeCount > 0
              ? `${lifeCount} Saved Life Routine Records Active`
              : "Zero Sample Data · Ready for Your Personal Tasks",
          tag: "TASKS",
        },
        {
          id: "health",
          label: "HEALTH & HYDRATION GUARDIAN",
          detail: hasHealth
            ? `Water ${health.waterDrankGlasses} gls · Sleep ${health.sleepHoursLastNight}h · ${health.dailySteps} steps`
            : "Health Monitor Armed · Log Water or Sleep Anytime",
          tag: "HEALTH",
        },
        {
          id: "voice",
          label: "PAKISTANI URDU VOICE CORE",
          detail: `Active: ${activeSpeaker} · Dual: ${femaleName} & ${maleName} · ${
            sched?.enabled ? `Auto (${sched.mode})` : "Instant Switch Ready"
          }`,
          tag: "VOICE",
        },
        {
          id: "shield",
          label: "QUANTUM SHIELD & WAKE GUARD",
          detail: `99.98% Coherence · Say 'Hi Jarvis', 'Hi ${maleName}' or 'Hi ${femaleName}'`,
          tag: "SHIELD",
        },
      ];

      setLiveFeed(items);
    };

    refreshAutonomousActions();
    const refreshTimer = setInterval(refreshAutonomousActions, 8000);
    const cycleTimer = setInterval(() => {
      setActionIndex((prev) => prev + 1);
      setCycleCount((c) => c + 1);
      setAuraIndex((a) => (a + 1) % HOLO_AURAS.length);
    }, 4000);

    return () => {
      cancelled = true;
      clearInterval(refreshTimer);
      clearInterval(cycleTimer);
    };
  }, [isOpen, activeGender, maleName, femaleName]);

  if (!isOpen) return null;

  const enableSoundIfBlocked = () => {
    const vid = videoRef.current;
    if (!vid || !autoplayAudioBlocked) return;
    vid.muted = false;
    setIsMuted(false);
    setAutoplayAudioBlocked(false);
    if (vid.paused) {
      vid.play().catch(() => {});
    }
  };

  const aura = HOLO_AURAS[auraIndex % HOLO_AURAS.length];
  const currentAction = liveFeed[actionIndex % Math.max(1, liveFeed.length)] || liveFeed[0];
  const activeSpeaker = activeGender === "male" ? maleName : femaleName;

  const launchModuleFromOverlay = (mod: MatrixModuleId) => {
    soundEffects.playBeepConfirm();
    onCloseRef.current();
    onOpenModule?.(mod);
  };

  return (
    <div
      className="fixed inset-0 z-50 w-screen h-screen bg-black flex items-center justify-center overflow-hidden select-none font-rajdhani"
      role="dialog"
      aria-modal="true"
      aria-label={`${femaleName} and ${maleName} Full View Continuous Hologram`}
      onClick={enableSoundIfBlocked}
    >
      {/* Full-View Unobstructed Continuous Looping MP4 Video (Zero Play/Pause/Replay Buttons) */}
      <video
        ref={videoRef}
        src={IDENTITY_REVEAL_VIDEO_SRC}
        autoPlay
        loop
        playsInline
        preload="auto"
        muted={isMuted}
        disablePictureInPicture
        className="w-full h-full object-contain bg-black"
      />

      {/* Subtle Perimeter Cybernetic Holographic Energy Aura (Never blocks central video) */}
      <div
        className="pointer-events-none fixed inset-0 transition-all duration-1000"
        style={{
          boxShadow: `inset 0 0 60px ${aura.left}26, inset 0 0 110px ${aura.right}18`,
        }}
      />

      {/* Top-Left Minimal Live Status Badge */}
      <div className="fixed top-3 left-3 sm:top-4 sm:left-4 z-10 pointer-events-none flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/55 border border-white/15 backdrop-blur-md">
        <span
          className="w-2 h-2 rounded-full animate-pulse"
          style={{ backgroundColor: aura.left, boxShadow: `0 0 10px ${aura.left}` }}
        />
        <span className="font-orbitron font-bold text-[10px] sm:text-xs tracking-wider text-white">
          {femaleName} &amp; {maleName}
        </span>
        <span className="hidden sm:inline font-mono text-[10px] text-cyan-300/90">
          · {activeSpeaker} Active
        </span>
      </div>

      {/* Sound Unlock Prompt ONLY when browser autoplay blocks initial unmuted sound */}
      {autoplayAudioBlocked && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            enableSoundIfBlocked();
          }}
          className="fixed top-14 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-xl bg-cyan-500/95 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg cursor-pointer whitespace-nowrap"
        >
          <Volume2 className="w-4 h-4" />
          <span>Tap Anywhere for Sound</span>
        </button>
      )}

      {/* Top-Right Close Button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          soundEffects.playClick();
          onCloseRef.current();
        }}
        aria-label="Close Full View"
        className="fixed top-3 right-3 sm:top-4 sm:right-4 z-20 p-2.5 rounded-xl bg-black/60 hover:bg-black/85 border border-white/20 text-white/90 hover:text-white transition cursor-pointer backdrop-blur-md"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Right-Edge Interactive Autonomous Function Dock (No Play/Pause/Replay) */}
      <div
        className="fixed right-2.5 sm:right-4 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-2 p-1.5 rounded-2xl bg-black/50 border border-white/15 backdrop-blur-md"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => {
            soundEffects.playBeepConfirm();
            onCloseRef.current();
            onTriggerVoice?.();
          }}
          title="Speak Command (Voice Mic)"
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/40 border border-cyan-400/45 text-cyan-200 flex items-center justify-center transition cursor-pointer"
        >
          <Mic className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => {
            soundEffects.playQuantumWarp();
            const next = activeGender === "male" ? "female" : "male";
            onSwitchGender?.(next);
          }}
          title={`Switch Voice (${maleName} ⇄ ${femaleName})`}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500/20 hover:bg-amber-500/40 border border-amber-400/45 text-amber-200 flex items-center justify-center transition cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => {
            soundEffects.playShockwave();
            setAuraIndex((a) => (a + 1) % HOLO_AURAS.length);
            setActionIndex((prev) => prev + 1);
            setCycleCount((c) => c + 1);
          }}
          title="Cycle Hologram Aura & Scan"
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-purple-500/20 hover:bg-purple-500/40 border border-purple-400/45 text-purple-200 flex items-center justify-center transition cursor-pointer"
        >
          <Zap className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => launchModuleFromOverlay("memory")}
          title="Tasks & Routine"
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-900/75 hover:bg-cyan-500/30 border border-white/15 text-slate-200 flex items-center justify-center transition cursor-pointer"
        >
          <CheckSquare className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => launchModuleFromOverlay("health")}
          title="Health Guardian"
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-900/75 hover:bg-emerald-500/30 border border-white/15 text-slate-200 flex items-center justify-center transition cursor-pointer"
        >
          <Heart className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => launchModuleFromOverlay("comms")}
          title="Phone Alerts & Calls"
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-900/75 hover:bg-cyan-500/30 border border-white/15 text-slate-200 flex items-center justify-center transition cursor-pointer"
        >
          <Bell className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => launchModuleFromOverlay("desktop")}
          title="Phone Info & Bridge"
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-900/75 hover:bg-cyan-500/30 border border-white/15 text-slate-200 flex items-center justify-center transition cursor-pointer"
        >
          <Smartphone className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => {
            soundEffects.playClick();
            onCloseRef.current();
            onOpenAppsMatrix?.();
          }}
          title="All Quantum Apps"
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-900/75 hover:bg-cyan-500/30 border border-white/15 text-slate-200 flex items-center justify-center transition cursor-pointer"
        >
          <LayoutGrid className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => {
            soundEffects.playClick();
            onCloseRef.current();
            onOpenSettings?.();
          }}
          title="Voice & Schedule Settings"
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-900/75 hover:bg-cyan-500/30 border border-white/15 text-slate-200 flex items-center justify-center transition cursor-pointer"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Bottom-Edge Live Continuous Autonomous Action Feed */}
      <div
        className="pointer-events-none fixed bottom-3 left-3 right-14 sm:left-4 sm:right-20 z-10 flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-2xl bg-black/55 border border-white/15 backdrop-blur-md"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Activity className="w-4 h-4 shrink-0 animate-pulse" style={{ color: aura.left }} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span
                className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/10 uppercase tracking-wider"
                style={{ color: aura.left }}
              >
                {currentAction?.tag || "LIVE"}
              </span>
              <span className="font-orbitron font-bold text-[10px] sm:text-xs text-slate-100 truncate">
                {currentAction?.label}
              </span>
            </div>
            <p className="font-mono text-[10px] sm:text-[11px] text-slate-300/90 truncate">
              {currentAction?.detail}
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 font-mono text-[10px] text-slate-300 shrink-0">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>AUTO-OPS #{cycleCount}</span>
          {telemetry?.batteryPercent !== null && telemetry?.batteryPercent !== undefined && (
            <span className="text-cyan-300">· {telemetry.batteryPercent}% BAT</span>
          )}
        </div>
      </div>
    </div>
  );
};

