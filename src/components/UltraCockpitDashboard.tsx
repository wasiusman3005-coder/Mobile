import React, { useState, useEffect } from "react";
import {
  Shield,
  Lock,
  Eye,
  EyeOff,
  Terminal,
  FileCode,
  HardDrive,
  Wifi,
  WifiOff,
  Sparkles,
  Layers,
  Database,
  Smartphone,
  MapPin,
  Settings,
  Radio,
  GraduationCap,
  Heart,
  DollarSign,
  Zap,
  Clock,
  User,
  Film,
  Fingerprint,
  ScanFace,
  BatteryCharging,
  Flashlight,
  Vibrate,
  Sun,
  Download,
  Bell,
  Mic,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { soundEffects } from "../services/soundEffects";
import { speechService } from "../services/speechService";
import {
  readPhoneHardwareTelemetry,
  PhoneHardwareTelemetry,
} from "../services/systemTelemetry";
import {
  getPhoneStorageStats,
  loadMobileVaultFiles,
  togglePhoneFlashlight,
  toggleScreenWakeLock,
  triggerHaptic,
  PhoneStorageStats,
  MobileVaultFile,
} from "../services/mobileDeviceActions";
import { getStoredSecurityConfig } from "../services/biometricAuth";
import { PWAInstallButton } from "./PWAInstallButton";
import { UserProfile, DashboardCustomization, LanguageCode, VoiceGender, JarvisInterfaceThemeId } from "../types";
import { QuantumThemeColor } from "./AutoMorphingQuantumLogo";
import { ALL_JARVIS_THEMES } from "./themes/themesData";
import { QuantumFieldsBar } from "./QuantumFieldsBar";
import {
  CentralQuantumCoreHologram,
  QuantumCoreDesign,
  QuantumColorPalette,
  QUANTUM_DESIGNS,
  QUANTUM_PALETTES,
} from "./CentralQuantumCoreHologram";

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
      | "automation"
      | "communication"
      | "maps"
      | "devices"
      | "studio"
  ) => void;
  onOpenSettings: () => void;
  onOpenHumanoidStage?: () => void;
  onTriggerWakeWord?: () => void;
  onPrimeWakeMic?: () => void;
  wakeStatusText?: string;
  onTriggerHealthLockdown: () => void;
  onLockScreen?: () => void;
  onToggleAwayMode?: () => void;
  isAwayMode?: boolean;
  onSelectTheme?: (themeId: JarvisInterfaceThemeId) => void;
  onOpenPhoneInstall?: (tab?: "android" | "ios" | "apk") => void;
  language: LanguageCode;
  voiceGender: VoiceGender;
}

export const UltraCockpitDashboard: React.FC<UltraCockpitDashboardProps> = ({
  userProfile,
  customization,
  coherence,
  screenWorkMinutes,
  onOpenAppsMatrix,
  onOpenModule,
  onOpenSettings,
  onOpenHumanoidStage,
  onTriggerWakeWord,
  onPrimeWakeMic,
  wakeStatusText,
  onTriggerHealthLockdown,
  onLockScreen,
  onToggleAwayMode,
  onSelectTheme,
  onOpenPhoneInstall,
  language,
  voiceGender,
}) => {
  const [isPrivacyCloakActive, setIsPrivacyCloakActive] = useState(false);
  const [isAirGapActive, setIsAirGapActive] = useState(false);
  const [isThemeDropdownOpen, setIsThemeDropdownOpen] = useState(false);
  const [cipherRotationTimer, setCipherRotationTimer] = useState(26);
  const [activeCipherKey, setActiveCipherKey] = useState("0x7F4A...B9C2_MOBILE");

  // Live Mobile Phone Telemetry & Storage
  const [phoneTelemetry, setPhoneTelemetry] = useState<PhoneHardwareTelemetry | null>(null);
  const [storageStats, setStorageStats] = useState<PhoneStorageStats | null>(null);
  const [vaultFiles, setVaultFiles] = useState<MobileVaultFile[]>([]);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [torchActive, setTorchActive] = useState(false);

  // Continuously Morphing Quantum Logo Design & Color States
  const [activeQuantumPalette, setActiveQuantumPalette] = useState<QuantumColorPalette>(QUANTUM_PALETTES[0]);
  const [activeQuantumDesign, setActiveQuantumDesign] = useState<QuantumCoreDesign>(QUANTUM_DESIGNS[0]);
  const [isOverdriveMode, setIsOverdriveMode] = useState(false);

  // Time & Date String
  const [timeStr, setTimeStr] = useState("");
  const [dateStr, setDateStr] = useState("");

  const secCfg = customization.securityConfig || getStoredSecurityConfig();
  const hasBiometric = secCfg.fingerprintEnabled || secCfg.faceUnlockEnabled;

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
      setDateStr(
        now.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Cipher Key rotation timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCipherRotationTimer((prev) => (prev <= 1 ? 30 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (cipherRotationTimer === 30) {
      const hex = "0x" + Math.random().toString(16).substring(2, 6).toUpperCase() + "...AES4096";
      setActiveCipherKey(hex);
    }
  }, [cipherRotationTimer]);

  // Poll Live Smartphone Hardware, Battery, Storage Quota & Mobile Vault Files
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      const [phone, storage] = await Promise.all([
        readPhoneHardwareTelemetry(),
        getPhoneStorageStats(),
      ]);
      if (!cancelled) {
        setPhoneTelemetry(phone);
        setStorageStats(storage);
        setVaultFiles(loadMobileVaultFiles());
      }
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isAirGapActive]);

  // Listen to remote / voice privacy events
  useEffect(() => {
    const handleCloak = () => setIsPrivacyCloakActive((prev) => !prev);
    const handleAirGap = () => setIsAirGapActive((prev) => !prev);

    window.addEventListener("toggle-privacy-cloak", handleCloak);
    window.addEventListener("toggle-air-gap", handleAirGap);

    return () => {
      window.removeEventListener("toggle-privacy-cloak", handleCloak);
      window.removeEventListener("toggle-air-gap", handleAirGap);
    };
  }, []);

  const mask = (value: string | number, cloakedReplacement = "████████") => {
    if (isPrivacyCloakActive) return cloakedReplacement;
    return String(value);
  };

  const togglePrivacyCloak = () => {
    soundEffects.playAlert();
    triggerHaptic([30, 20, 40]);
    const next = !isPrivacyCloakActive;
    setIsPrivacyCloakActive(next);
    const speech =
      language === "pa"
        ? next
          ? "Maximum Privacy Cloak Active! Saara mobile data redact ho gaya ae."
          : "Privacy Cloak Disengaged. Normal screen restored."
        : next
        ? "Privacy Cloak chalu ho gaya hai! Screen ka sara private data hide kar diya gaya."
        : "Privacy Cloak band ho gaya hai. Normal screen wapas aa gayi.";
    speechService.speak(speech, { lang: language, gender: voiceGender });
  };

  const toggleAirGap = () => {
    soundEffects.playBeepConfirm();
    triggerHaptic(25);
    setIsAirGapActive((prev) => !prev);
  };

  const handleQuickWakeLock = async (e: React.MouseEvent) => {
    e.stopPropagation();
    soundEffects.playClick();
    triggerHaptic(20);
    const active = await toggleScreenWakeLock(!wakeLockActive);
    setWakeLockActive(active);
  };

  const handleQuickFlashlight = async (e: React.MouseEvent) => {
    e.stopPropagation();
    soundEffects.playClick();
    triggerHaptic(20);
    const res = await togglePhoneFlashlight(!torchActive);
    setTorchActive(res.active);
    if (!res.ok) {
      speechService.speak(res.message, { lang: language, gender: voiceGender });
    }
  };

  // Mobile Phone Quick Vault & Shortcut Capsules (6 tiles)
  const assetCapsules =
    vaultFiles.length >= 6
      ? vaultFiles.slice(0, 6).map((f) => ({
          name: f.name,
          size: f.size,
          mod: "desktop",
        }))
      : [
          ...vaultFiles.map((f) => ({ name: f.name, size: f.size, mod: "desktop" })),
          { name: "Phone Vault", size: `${vaultFiles.length} Files`, mod: "desktop" },
          { name: "GPS Radar", size: "Live", mod: "maps" },
          { name: "Phone Bridge", size: "Sync", mod: "devices" },
          { name: "Life Notes", size: "Vault", mod: "records" },
          { name: "Health Guard", size: "8-Glass", mod: "health" },
          { name: "Voice Macros", size: "Auto", mod: "automation" },
        ].slice(0, 6);

  const directAppUrl =
    typeof window !== "undefined"
      ? (window.location.origin || "").replace("https://ais-dev-", "https://ais-pre-")
      : "";

  return (
    <div className="relative w-full min-h-screen bg-[#02040a] text-slate-100 flex flex-col justify-between p-2 md:p-4 select-none font-rajdhani overflow-x-hidden">
      {/* AI STUDIO IFRAME BREAKOUT BANNER (Fixes Chrome installing AI Studio instead of Q-NEXUS!) */}
      {phoneTelemetry?.inIframeWrapper && directAppUrl && (
        <div className="relative z-40 mb-2 p-2.5 sm:px-4 rounded-2xl bg-gradient-to-r from-amber-950/90 via-slate-950 to-cyan-950/90 border border-amber-400/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono shadow-xl">
          <div className="flex items-start sm:items-center gap-2 text-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
            <span>
              <strong>AI Studio Frame Active:</strong> Agar aap yahan Chrome se Install / Shortcut banayenge to <strong>AI Studio</strong> install hoga. Asli Q-NEXUS app install karne ke liye pehle Direct Link kholein:
            </span>
          </div>
          <a
            href={directAppUrl}
            target="_top"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-orbitron font-extrabold text-[11px] flex items-center justify-center gap-1.5 shrink-0"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>OPEN DIRECT Q-NEXUS</span>
          </a>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TOP FLOATING MOBILE-FIRST HOLOGRAPHIC HUD BAR */}
      {/* ------------------------------------------------------------- */}
      <header className="relative z-30 flex flex-wrap items-center justify-between gap-2.5 px-3 sm:px-4 py-2.5 rounded-2xl bg-slate-950/90 border border-cyan-500/35 backdrop-blur-2xl shadow-[0_0_30px_rgba(6,182,212,0.15)] shrink-0">
        {/* Left: Brand & Mobile Clearance */}
        <div className="flex items-center gap-2.5">
          <div className="relative w-9 h-9 rounded-xl bg-cyan-950 border border-cyan-400 flex items-center justify-center text-cyan-300 shadow-md shadow-cyan-500/30 shrink-0">
            <Smartphone className="w-5 h-5 text-cyan-400 animate-pulse" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          </div>

          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-orbitron font-extrabold text-xs sm:text-sm text-cyan-300 tracking-wider glow-text-cyan">
                Q-NEXUS MOBILE OS
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-bold uppercase">
                PHONE HUD
              </span>
            </div>
            <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1.5 flex-wrap">
              <span>
                Commander: <strong className="text-slate-200">{mask(userProfile?.displayName || userProfile?.username || "WASI")}</strong>
              </span>
              <span>•</span>
              <span className="text-emerald-400">
                {phoneTelemetry?.batteryPercent !== null && phoneTelemetry?.batteryPercent !== undefined
                  ? `BAT ${phoneTelemetry.batteryPercent}%${phoneTelemetry.isCharging ? "⚡" : ""}`
                  : `SYNC ${coherence.toFixed(1)}%`}
              </span>
              {phoneTelemetry?.networkType && (
                <>
                  <span>•</span>
                  <span className="text-cyan-300">{phoneTelemetry.networkType}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Center: Live Clock & Screen Time Rest */}
        <div className="hidden md:flex items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span className="text-cyan-300 font-bold font-orbitron">{timeStr}</span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-400">{dateStr}</span>
          </div>

          <button
            type="button"
            onClick={onTriggerHealthLockdown}
            title="Mobile Screen Time Eye-Rest Guard"
            className="px-2.5 py-1 rounded-xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-amber-400/50 text-slate-400 hover:text-amber-300 transition flex items-center gap-1.5 cursor-pointer"
          >
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Eye Rest: {screenWorkMinutes}m</span>
          </button>

          <div
            className="hidden xl:flex items-center gap-2 px-3 py-1 rounded-xl border backdrop-blur-md transition-all duration-700"
            style={{
              backgroundColor: `${activeQuantumPalette.hex}15`,
              borderColor: `${activeQuantumPalette.hex}60`,
              boxShadow: `0 0 15px ${activeQuantumPalette.glow}`,
            }}
          >
            <span
              className="w-2 h-2 rounded-full animate-ping"
              style={{ backgroundColor: activeQuantumPalette.hex }}
            />
            <span className="text-[10px] font-orbitron font-bold" style={{ color: activeQuantumPalette.hex }}>
              CORE: {activeQuantumDesign.name.toUpperCase()}
            </span>
            <span className="text-[9px] font-mono text-slate-300 px-1.5 py-0.2 rounded bg-black/60 border border-slate-700">
              {activeQuantumPalette.name}
            </span>
            {isOverdriveMode && (
              <span className="text-[9px] font-mono text-amber-300 font-bold px-1.5 py-0.2 rounded bg-rose-950 border border-rose-500 animate-pulse">
                WARP 3.5X
              </span>
            )}
          </div>
        </div>

        {/* Right: Install Phone App, Themes, Cloak, Biometric Settings, Lock */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <PWAInstallButton compact />

          {onOpenPhoneInstall && (
            <button
              type="button"
              onClick={() => {
                soundEffects.playClick();
                triggerHaptic(15);
                onOpenPhoneInstall();
              }}
              className="px-2.5 py-1.5 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-400/60 text-emerald-200 text-xs font-mono flex items-center gap-1.5 cursor-pointer shadow-[0_0_12px_rgba(16,185,129,0.25)]"
              title="Phone Install Guide (Android & iPhone)"
            >
              <Download className="w-3.5 h-3.5 text-emerald-300" />
              <span className="hidden sm:inline">PHONE GUIDE</span>
            </button>
          )}

          {/* Quick Theme Switcher Button */}
          {onSelectTheme && (
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  soundEffects.playClick();
                  setIsThemeDropdownOpen(!isThemeDropdownOpen);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-400/60 text-cyan-200 text-xs font-mono flex items-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(0,245,255,0.25)]"
                title="Switch between 7 Iconic Sci-Fi Interfaces"
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
                <span className="hidden sm:inline">THEMES</span>
              </button>

              {isThemeDropdownOpen && (
                <div className="absolute right-0 top-10 w-72 bg-[#02040f]/95 border-2 border-cyan-400 rounded-2xl p-2 shadow-2xl z-50 flex flex-col gap-1.5 backdrop-blur-2xl">
                  <div className="text-[10px] font-bold text-cyan-400 px-2 py-1 border-b border-slate-800">
                    SWITCH MOBILE INTERFACE THEME
                  </div>
                  {ALL_JARVIS_THEMES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        soundEffects.playBeepConfirm();
                        triggerHaptic(15);
                        onSelectTheme(t.id);
                        setIsThemeDropdownOpen(false);
                      }}
                      className={`flex items-center gap-2 p-1.5 rounded-xl text-left text-xs transition cursor-pointer ${
                        t.id === (customization.activeInterfaceTheme || "quantum_cockpit")
                          ? "bg-cyan-950 text-cyan-300 border border-cyan-400 font-bold"
                          : "hover:bg-slate-900 text-slate-300"
                      }`}
                    >
                      <img src={t.imagePath} alt={t.name} className="w-8 h-8 rounded-lg object-cover border border-slate-700" />
                      <div>
                        <div className="font-bold text-[11px]">{t.name}</div>
                        <div className="text-[9px] text-slate-400 truncate max-w-[170px]">{t.tagline}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Privacy Cloak Button */}
          <button
            type="button"
            onClick={togglePrivacyCloak}
            title="Toggle Screen Privacy Cloak"
            className={`px-2.5 py-1.5 rounded-xl text-xs font-mono font-bold transition flex items-center gap-1 cursor-pointer ${
              isPrivacyCloakActive
                ? "bg-red-500 text-slate-950 border border-red-400 shadow-md shadow-red-500/50 animate-pulse"
                : "bg-slate-900 hover:bg-cyan-950 border border-cyan-500/40 text-cyan-300"
            }`}
          >
            {isPrivacyCloakActive ? <EyeOff className="w-3.5 h-3.5 text-slate-950" /> : <Eye className="w-3.5 h-3.5 text-cyan-400" />}
            <span className="hidden md:inline">{isPrivacyCloakActive ? "CLOAK ON" : "CLOAK"}</span>
          </button>

          {/* Air-Gap / Airplane Guard */}
          <button
            type="button"
            onClick={toggleAirGap}
            title="Airplane Isolation Guard"
            className={`px-2 py-1.5 rounded-xl text-xs font-mono transition flex items-center gap-1 cursor-pointer ${
              isAirGapActive
                ? "bg-amber-500 text-slate-950 font-bold border border-amber-400"
                : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            {isAirGapActive ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5 text-emerald-400" />}
          </button>

          {/* Apps Matrix */}
          <button
            type="button"
            onClick={() => {
              soundEffects.playClick();
              onOpenAppsMatrix();
            }}
            className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-cyan-950 border border-cyan-500/40 text-cyan-300 text-xs font-mono transition flex items-center gap-1.5 cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">APPS</span>
          </button>

          {/* Settings Modal (Includes Fingerprint & Face Unlock) */}
          <button
            type="button"
            onClick={() => {
              soundEffects.playClick();
              onOpenSettings();
            }}
            className="p-2 rounded-xl bg-slate-900 hover:bg-purple-950 border border-slate-800 hover:border-purple-400 text-slate-400 hover:text-purple-300 transition cursor-pointer relative"
            title="Settings (Fingerprint & Face Unlock, Voice, Password)"
          >
            <Settings className="w-4 h-4" />
            {hasBiometric && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400"></span>
            )}
          </button>

          {/* Away Standby Mode */}
          {onToggleAwayMode && (
            <button
              type="button"
              onClick={() => {
                soundEffects.playClick();
                onToggleAwayMode();
              }}
              className="hidden sm:flex p-2 rounded-xl bg-slate-900 hover:bg-amber-950 border border-slate-800 hover:border-amber-400 text-slate-400 hover:text-amber-300 transition cursor-pointer"
              title="Phone Standby Screensaver"
            >
              <Shield className="w-4 h-4" />
            </button>
          )}

          {/* Humanoid Stage Quick Launch */}
          {onOpenHumanoidStage && (
            <button
              type="button"
              onClick={() => {
                soundEffects.playBeepConfirm();
                onOpenHumanoidStage();
              }}
              className="px-2.5 py-1.5 rounded-xl bg-purple-950/80 hover:bg-purple-900 border border-purple-400/60 text-purple-200 text-xs font-mono flex items-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(168,85,247,0.3)]"
              title="Open Zoya 3D Hologram Stage"
            >
              <User className="w-3.5 h-3.5 text-purple-300" />
              <span className="hidden sm:inline">ZOYA 3D</span>
            </button>
          )}

          {/* Wake Word Trigger Quick Button */}
          {onTriggerWakeWord && (
            <button
              type="button"
              onClick={() => {
                soundEffects.playClick();
                onTriggerWakeWord();
              }}
              className="hidden md:flex px-2.5 py-1.5 rounded-xl bg-amber-950/80 hover:bg-amber-900 border border-amber-400/60 text-amber-200 text-xs font-mono items-center gap-1 cursor-pointer"
              title="Trigger Wake Word Engine Instantly"
            >
              <Radio className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
              <span>WAKE</span>
            </button>
          )}

          {/* Biometric Lock Core */}
          {onLockScreen && (
            <button
              type="button"
              onClick={() => {
                soundEffects.playAlert();
                triggerHaptic([40, 20, 40]);
                onLockScreen();
              }}
              className="px-2.5 py-1.5 rounded-xl bg-red-950/80 hover:bg-red-900 border border-red-500/50 hover:border-red-400 text-red-300 text-xs font-mono font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-red-950"
              title="Lock Phone Core (Fingerprint / Face / Password)"
            >
              {hasBiometric ? (
                <Fingerprint className="w-3.5 h-3.5 text-emerald-300" />
              ) : (
                <Lock className="w-3.5 h-3.5 text-red-400" />
              )}
              <span>LOCK</span>
            </button>
          )}
        </div>
      </header>

      {/* QUANTUM FIELDS BAR */}
      {onSelectTheme && (
        <div className="my-1.5 relative z-20">
          <QuantumFieldsBar
            activeThemeId={customization.activeInterfaceTheme || "quantum_cockpit"}
            onSelectTheme={onSelectTheme}
          />
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MAIN MOBILE-FIRST SPATIAL COCKPIT */}
      {/* ------------------------------------------------------------- */}
      <div className="relative flex-1 w-full my-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-center md:min-h-[640px]">
        {/* SVG RADIATING CIRCUIT TRACES */}
        <svg
          className="hidden md:block absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible opacity-75"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="traceCyan" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={activeQuantumPalette.hex} stopOpacity="0.95" />
              <stop offset="100%" stopColor={activeQuantumPalette.secondaryHex} stopOpacity="0.25" />
            </linearGradient>
            <linearGradient id="traceMint" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={isOverdriveMode ? "#f43f5e" : activeQuantumPalette.hex} stopOpacity="0.9" />
              <stop offset="100%" stopColor={activeQuantumPalette.secondaryHex} stopOpacity="0.25" />
            </linearGradient>
            <linearGradient id="traceViolet" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={isOverdriveMode ? "#f59e0b" : activeQuantumPalette.secondaryHex} stopOpacity="0.95" />
              <stop offset="100%" stopColor={activeQuantumPalette.hex} stopOpacity="0.2" />
            </linearGradient>
          </defs>

          <path d="M 50% 50% L 36% 38% L 24% 20% L 16% 20%" fill="none" stroke="url(#traceCyan)" strokeWidth={isOverdriveMode ? "2.5" : "2"} className={isOverdriveMode ? "circuit-overdrive" : "circuit-animated"} />
          <path d="M 50% 50% L 34% 48% L 26% 48% L 16% 48%" fill="none" stroke="url(#traceMint)" strokeWidth={isOverdriveMode ? "2.5" : "2"} className={isOverdriveMode ? "circuit-overdrive" : "circuit-animated"} />
          <path d="M 50% 50% L 38% 62% L 28% 74% L 16% 74%" fill="none" stroke="url(#traceCyan)" strokeWidth={isOverdriveMode ? "2.2" : "1.8"} className={isOverdriveMode ? "circuit-overdrive" : "circuit-animated"} />
          <path d="M 50% 50% L 50% 28% L 50% 18%" fill="none" stroke="url(#traceCyan)" strokeWidth={isOverdriveMode ? "2.5" : "2"} className={isOverdriveMode ? "circuit-overdrive" : "circuit-animated"} />
          <path d="M 50% 50% L 64% 38% L 76% 20% L 84% 20%" fill="none" stroke="url(#traceCyan)" strokeWidth={isOverdriveMode ? "2.5" : "2"} className={isOverdriveMode ? "circuit-overdrive" : "circuit-animated"} />
          <path d="M 50% 50% L 66% 48% L 74% 48% L 84% 48%" fill="none" stroke="url(#traceViolet)" strokeWidth={isOverdriveMode ? "2.5" : "2"} className={isOverdriveMode ? "circuit-overdrive" : "circuit-animated"} />
          <path d="M 50% 50% L 62% 62% L 72% 74% L 84% 74%" fill="none" stroke="url(#traceCyan)" strokeWidth={isOverdriveMode ? "2.2" : "1.8"} className={isOverdriveMode ? "circuit-overdrive" : "circuit-animated"} />
        </svg>

        {/* CENTER MORPHING QUANTUM 3D CORE */}
        <div className="relative md:absolute z-10 flex flex-col items-center justify-center pointer-events-auto order-1 md:order-none my-1 md:my-0">
          <CentralQuantumCoreHologram
            coherence={coherence}
            language={language}
            voiceGender={voiceGender}
            activeInterfaceTheme={customization.activeInterfaceTheme || "quantum_cockpit"}
            onColorChange={setActiveQuantumPalette}
            onDesignChange={setActiveQuantumDesign}
            isOverdriveActive={isOverdriveMode}
            onToggleOverdrive={() => setIsOverdriveMode(!isOverdriveMode)}
          />
        </div>

        {/* TOP-CENTER: MOBILE MESH & SENSOR CONSTELLATION */}
        <div
          onClick={() => onOpenModule && onOpenModule("devices")}
          className="absolute top-2 z-20 hidden md:flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-950/85 border border-cyan-500/40 hover:border-cyan-400 backdrop-blur-xl shadow-xl shadow-cyan-950/50 cursor-pointer transition hover:scale-105"
        >
          <div className="flex items-center gap-2 mb-1">
            <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span className="text-[11px] font-orbitron font-bold text-cyan-300">
              MOBILE SENSOR MESH
            </span>
            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-950 text-emerald-400 border border-cyan-500/30">
              LIVE PHONE
            </span>
          </div>

          <div className="w-48 h-16 relative flex items-center justify-center">
            <svg className="w-full h-full" viewBox="0 0 180 60">
              <line x1="90" y1="30" x2="30" y2="15" stroke="#00f5ff" strokeWidth="1.2" opacity="0.6" />
              <line x1="90" y1="30" x2="35" y2="45" stroke="#00f5ff" strokeWidth="1.2" opacity="0.6" />
              <line x1="90" y1="30" x2="150" y2="15" stroke="#a855f7" strokeWidth="1.2" opacity="0.6" />
              <line x1="90" y1="30" x2="145" y2="45" stroke="#a855f7" strokeWidth="1.2" opacity="0.6" />
              <line x1="90" y1="30" x2="90" y2="8" stroke="#00ffcc" strokeWidth="1.2" opacity="0.6" />
              <circle cx="90" cy="30" r="6" fill="#00f5ff" />
              <circle cx="90" cy="30" r="10" fill="none" stroke="#00f5ff" strokeWidth="1" opacity="0.5" />
              <circle cx="30" cy="15" r="3.5" fill="#00ffcc" />
              <circle cx="35" cy="45" r="3.5" fill="#06b6d4" />
              <circle cx="150" cy="15" r="3.5" fill="#a855f7" />
              <circle cx="145" cy="45" r="3.5" fill="#3b82f6" />
              <circle cx="90" cy="8" r="3.5" fill="#ffffff" />
            </svg>
          </div>
        </div>

        {/* LEFT WING: MOBILE TELEMETRY, BIOMETRICS & VAULT */}
        <div className="relative md:absolute md:left-0 md:top-0 md:bottom-16 w-full md:w-[320px] flex flex-col justify-between pointer-events-auto space-y-2 z-10 md:pr-1 order-2 md:order-none">
          {/* Card 1: Mobile Commander Profile & Biometric Status */}
          <div
            onClick={onOpenSettings}
            className="p-3.5 rounded-2xl bg-slate-950/85 border border-cyan-500/40 hover:border-cyan-400 backdrop-blur-xl shadow-xl shadow-cyan-950/40 transition cursor-pointer"
          >
            <div className="flex items-center justify-between text-xs font-mono mb-2">
              <span className="flex items-center gap-1.5 text-cyan-300 font-bold">
                <Fingerprint className="w-4 h-4 text-emerald-400" />
                <span>MOBILE_BIOMETRIC_GUARD</span>
              </span>
              <span
                className={`text-[9px] px-1.5 py-0.2 rounded font-bold border ${
                  hasBiometric
                    ? "bg-emerald-950 text-emerald-300 border-emerald-500/40"
                    : "bg-amber-950 text-amber-300 border-amber-500/40"
                }`}
              >
                {hasBiometric ? "ACTIVE" : "SETUP"}
              </span>
            </div>

            <div className="space-y-1 text-xs font-mono text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-500">Fingerprint Unlock:</span>
                <span className={secCfg.fingerprintEnabled ? "text-emerald-400 font-bold" : "text-slate-400"}>
                  {secCfg.fingerprintEnabled ? "ENABLED ✓" : "OFF (Tap to Setup)"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Face Unlock ID:</span>
                <span className={secCfg.faceUnlockEnabled ? "text-cyan-300 font-bold" : "text-slate-400"}>
                  {secCfg.faceUnlockEnabled ? "ENABLED ✓" : "OFF (Tap to Setup)"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Session Token:</span>
                <span className="text-cyan-400 truncate max-w-[140px]">{mask(activeCipherKey, "████-ENCRYPTED")}</span>
              </div>
            </div>

            <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleQuickWakeLock}
                className={`flex-1 py-1 rounded-lg text-[10px] font-mono font-bold border flex items-center justify-center gap-1 cursor-pointer ${
                  wakeLockActive
                    ? "bg-amber-950 border-amber-400 text-amber-300"
                    : "bg-slate-900 border-slate-800 text-slate-300 hover:border-cyan-500/50"
                }`}
              >
                <Sun className="w-3 h-3" />
                <span>{wakeLockActive ? "SCREEN AWAKE ON" : "KEEP AWAKE"}</span>
              </button>
              <button
                type="button"
                onClick={handleQuickFlashlight}
                className={`flex-1 py-1 rounded-lg text-[10px] font-mono font-bold border flex items-center justify-center gap-1 cursor-pointer ${
                  torchActive
                    ? "bg-cyan-500 border-cyan-300 text-slate-950"
                    : "bg-slate-900 border-slate-800 text-slate-300 hover:border-cyan-500/50"
                }`}
              >
                <Flashlight className="w-3 h-3" />
                <span>{torchActive ? "TORCH ON" : "TORCH"}</span>
              </button>
            </div>
          </div>

          {/* Card 2: Mobile Vault & Quick Modules (2x3 Grid) */}
          <div className="p-3.5 rounded-2xl bg-slate-950/85 border border-cyan-500/40 hover:border-cyan-400 backdrop-blur-xl shadow-xl shadow-cyan-950/40">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-orbitron font-bold text-cyan-300">
                <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                <span>MOBILE VAULT CAPSULES</span>
              </div>
              <span className="text-[9px] font-mono text-slate-400">Tap to Open</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {assetCapsules.map((cap, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    triggerHaptic(15);
                    onOpenModule && onOpenModule(cap.mod as any);
                  }}
                  className="p-2 rounded-xl bg-slate-900/90 hover:bg-cyan-950 border border-slate-800 hover:border-cyan-500/60 text-left transition cursor-pointer flex flex-col justify-between group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <FileCode className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition" />
                    <span className="text-[8px] font-mono text-slate-500">{mask(cap.size, "█ KB")}</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-200 truncate font-semibold">
                    {mask(cap.name, "encrypted.bin")}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Card 3: COMPLETE REAL PHONE HARDWARE TELEMETRY (Zero Fake Data) */}
          <div
            onClick={() => onOpenModule && onOpenModule("devices")}
            className="p-3.5 rounded-2xl bg-slate-950/90 border border-cyan-500/45 hover:border-cyan-400 backdrop-blur-xl shadow-xl shadow-cyan-950/40 transition cursor-pointer"
          >
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2 gap-2">
              <span className="flex items-center gap-1.5 text-emerald-400 font-bold shrink-0">
                <BatteryCharging className="w-3.5 h-3.5" />
                <span>LIVE PHONE SPECS</span>
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30 truncate max-w-[165px] font-bold">
                {phoneTelemetry?.deviceName || "Detecting Phone..."}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] font-mono text-slate-300">
              <div className="truncate">
                <span className="text-slate-500">OS: </span>
                <span className="text-cyan-200">{phoneTelemetry?.osLabel || "--"}</span>
              </div>
              <div className="truncate text-right">
                <span className="text-slate-500">CPU: </span>
                <span className="text-emerald-300">{phoneTelemetry?.cpuThreads ?? "--"} Cores</span>
              </div>
              <div className="col-span-2 truncate">
                <span className="text-slate-500">GPU: </span>
                <span className="text-purple-300">{phoneTelemetry?.gpuRenderer || "--"}</span>
              </div>
              <div className="truncate">
                <span className="text-slate-500">RAM: </span>
                <span className="text-cyan-300">
                  {phoneTelemetry?.ramApproxGb ? `${phoneTelemetry.ramApproxGb} GB` : "Browser N/A"}
                </span>
              </div>
              <div className="truncate text-right">
                <span className="text-slate-500">Battery: </span>
                <span className="text-emerald-300 font-bold">
                  {phoneTelemetry?.batteryPercent !== null && phoneTelemetry?.batteryPercent !== undefined
                    ? `${phoneTelemetry.batteryPercent}%${phoneTelemetry.isCharging ? " ⚡" : ""}${phoneTelemetry.batteryTempC ? ` ${phoneTelemetry.batteryTempC}°C` : ""}`
                    : "OS Hidden"}
                </span>
              </div>
              <div className="truncate">
                <span className="text-slate-500">Storage: </span>
                <span className="text-amber-300">
                  {phoneTelemetry?.storageAvailGb !== null && phoneTelemetry?.storageTotalGb
                    ? `${phoneTelemetry.storageAvailGb}/${phoneTelemetry.storageTotalGb} GB`
                    : storageStats
                    ? `${storageStats.quotaGb}GB Quota`
                    : "--"}
                </span>
              </div>
              <div className="truncate text-right">
                <span className="text-slate-500">Screen: </span>
                <span className="text-slate-200">
                  {phoneTelemetry ? `${phoneTelemetry.screenResolution} (${phoneTelemetry.pixelRatio}x)` : "--"}
                </span>
              </div>
              <div className="truncate">
                <span className="text-slate-500">Net: </span>
                <span className="text-cyan-300">
                  {phoneTelemetry?.networkType || "--"}
                  {phoneTelemetry?.downlinkMbps ? ` ${phoneTelemetry.downlinkMbps}Mb` : ""}
                  {phoneTelemetry?.rttMs ? ` ${phoneTelemetry.rttMs}ms` : ""}
                </span>
              </div>
              <div className="truncate text-right">
                <span className="text-slate-500">Sensors: </span>
                <span className="text-emerald-300">
                  {phoneTelemetry ? `${phoneTelemetry.cameraCount}Cam/${phoneTelemetry.micCount}Mic/${phoneTelemetry.touchPoints}Touch` : "--"}
                </span>
              </div>
              <div className="col-span-2 flex justify-between border-t border-slate-800/80 pt-1 mt-0.5 text-[9px]">
                <span className="text-slate-400">TZ: {phoneTelemetry?.timezone || "Local"}</span>
                <span className={phoneTelemetry?.isNativeApk ? "text-emerald-400 font-bold" : "text-amber-300 font-bold"}>
                  {phoneTelemetry?.isNativeApk ? "ANDROID APK NATIVE" : "CHROME PWA MODE"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT WING: SECURITY, AUTOMATION & BIO SCAN */}
        <div className="relative md:absolute md:right-0 md:top-0 md:bottom-16 w-full md:w-[320px] flex flex-col justify-between pointer-events-auto space-y-2 z-10 md:pl-1 order-3 md:order-none">
          {/* Card 4: Mobile Security & Privacy Shield */}
          <div
            onClick={togglePrivacyCloak}
            className="p-3.5 rounded-2xl bg-slate-950/85 border border-cyan-500/40 hover:border-cyan-400 backdrop-blur-xl shadow-xl shadow-cyan-950/40 transition cursor-pointer"
          >
            <div className="flex items-center justify-between text-xs font-mono mb-2">
              <span className="flex items-center gap-1.5 text-cyan-300 font-bold">
                <Shield className="w-4 h-4 text-cyan-400" />
                <span>QUANTUM_PRIVACY_SHIELD</span>
              </span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-bold">
                PHONE PROTECTED
              </span>
            </div>

            <div className="space-y-1 text-xs font-mono text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-500">Auto-Lock Timer:</span>
                <span className="text-cyan-400 font-bold">
                  {secCfg.autoLockMinutes ? `${secCfg.autoLockMinutes} min` : "Manual"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Lattice Cipher:</span>
                <span className="text-emerald-400 font-semibold">{cipherRotationTimer}s AES-4096</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Biometric Sensor:</span>
                <span className="text-purple-300 flex items-center gap-1">
                  <ScanFace className="w-3 h-3" />
                  <span>{hasBiometric ? "FINGER + FACE" : "PASSWORD"}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Card 5: Hands-Free "Hi Jarvis" / "Wake up Jarvis" Mic Engine */}
          <div
            onClick={() => {
              soundEffects.playClick();
              onPrimeWakeMic ? onPrimeWakeMic() : onTriggerWakeWord?.();
            }}
            className="p-3 rounded-2xl bg-slate-950/90 border border-emerald-500/45 hover:border-emerald-400 backdrop-blur-xl shadow-xl transition cursor-pointer"
          >
            <div className="flex items-center justify-between text-xs font-orbitron font-bold text-emerald-300 mb-1.5">
              <span className="flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span>HANDS-FREE &quot;HI JARVIS&quot;</span>
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                AUTO RECORD
              </span>
            </div>
            <p className="text-[10px] font-mono text-slate-300 leading-snug mb-2">
              {wakeStatusText || "Tap once to keep mic listening for 'Hi Jarvis' & 'Wake up Jarvis' — auto-records your command!"}
            </p>
            <div className="flex items-center gap-1.5 text-[10px] font-mono">
              <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                &quot;Hi Jarvis&quot;
              </span>
              <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500/40">
                &quot;Wake up Jarvis&quot;
              </span>
            </div>
          </div>

          {/* Card 6: All-App Messages, Calls & Auto-Reply Control */}
          <div
            onClick={() => onOpenModule && onOpenModule("comms")}
            className="p-3 rounded-2xl bg-gradient-to-br from-emerald-950/50 to-slate-950 border border-cyan-400/50 hover:border-emerald-400 backdrop-blur-xl shadow-xl transition cursor-pointer font-mono text-[11px]"
          >
            <div className="flex items-center justify-between text-cyan-300 mb-1 border-b border-slate-800 pb-1">
              <span className="flex items-center gap-1.5 font-orbitron font-bold">
                <Bell className="w-3.5 h-3.5 text-emerald-400" />
                <span>MSGS, CALLS &amp; AUTO-REPLY</span>
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-900 text-amber-300 border border-amber-500/40">
                {phoneTelemetry?.isNativeApk ? "APK LIVE" : "OPEN HUB"}
              </span>
            </div>
            <p className="text-[10px] text-slate-300 leading-relaxed">
              WhatsApp, Messenger, SMS, Call Logs &amp; Background &quot;Wake up Jarvis&quot; Android APK Bridge. Tap to configure or read aloud.
            </p>
          </div>

          {/* Card 7: Mobile Resource Analytics Donut */}
          <div
            onClick={() => onOpenModule && onOpenModule("desktop")}
            className="p-3 rounded-2xl bg-slate-950/85 border border-cyan-500/40 hover:border-cyan-400 backdrop-blur-xl shadow-xl shadow-cyan-950/40 flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="relative w-14 h-14 shrink-0">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path className="text-slate-800" strokeWidth="4" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  <path className="text-cyan-400" strokeDasharray="65, 100" strokeWidth="4" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  <path className="text-purple-500" strokeDasharray="22, 100" strokeDashoffset="-65" strokeWidth="4" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  <path className="text-emerald-400" strokeDasharray="13, 100" strokeDashoffset="-87" strokeWidth="4" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono font-bold text-cyan-300">
                  {phoneTelemetry?.batteryPercent ?? 88}%
                </div>
              </div>

              <div>
                <span className="font-orbitron font-bold text-xs text-slate-200">
                  PHONE HEALTH ANALYTICS
                </span>
                <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                  Signal: <strong className="text-cyan-300">{phoneTelemetry?.networkType || "4G"}</strong> • Quota: <strong className="text-emerald-300">{storageStats?.quotaGb ?? 64} GB</strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM-LEFT QUICK LOCK PEDESTAL (Desktop/Tablet screens) */}
        <div
          onClick={() => (onLockScreen ? onLockScreen() : onOpenSettings())}
          title="Click to Trigger Fingerprint & Face Lock Gate"
          className="absolute left-4 bottom-2 z-20 hidden lg:flex items-center gap-3 p-3 rounded-2xl bg-slate-950/90 border border-cyan-400/60 shadow-[0_0_30px_rgba(6,182,212,0.5)] cursor-pointer group backdrop-blur-xl transition hover:scale-105"
        >
          <div className="relative w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-950 to-blue-900 border-2 border-cyan-300 flex items-center justify-center shadow-lg shadow-cyan-400/40">
            <Fingerprint className="w-6 h-6 text-cyan-300 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-[9px] font-mono text-cyan-400 font-bold uppercase">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span>BIOMETRIC GATE</span>
            </div>
            <div className="font-orbitron font-extrabold text-xs text-slate-100">
              {hasBiometric ? "FINGERPRINT & FACE READY" : "TAP TO LOCK PHONE"}
            </div>
            <span className="text-[9px] font-mono text-slate-400">Hardware WebAuthn Guard</span>
          </div>
        </div>

        {/* BOTTOM-RIGHT STATUS CHIP */}
        <div className="absolute right-4 bottom-2 z-20 hidden lg:flex items-center gap-3 p-2.5 rounded-2xl bg-slate-950/90 border border-slate-800 text-xs font-mono text-slate-400">
          <HardDrive className="w-4 h-4 text-cyan-400" />
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>MOBILE VAULT: ONLINE</span>
          </div>
        </div>

        {/* CENTER-BOTTOM MOBILE MESH LEGEND */}
        <div className="absolute bottom-2 z-10 hidden xl:flex items-center gap-4 px-4 py-2 rounded-2xl bg-slate-950/80 border border-cyan-500/30 backdrop-blur-md text-xs font-mono">
          <span className="text-cyan-400 font-bold flex items-center gap-1">
            <Radio className="w-3.5 h-3.5" />
            <span>MOBILE QUANTUM MESH:</span>
          </span>
          <span className="text-slate-300">Phone Core</span>
          <span className="text-cyan-500">↔</span>
          <span className="text-purple-300">Zoya 3D Voice</span>
          <span className="text-cyan-500">↔</span>
          <span className="text-emerald-300">Sensors &amp; GPS</span>
          <span className="text-slate-500">|</span>
          <span className="text-emerald-400 font-bold">Zero Leaks</span>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* FOREGROUND MOBILE TOUCH LAUNCH DOCK */}
      {/* ------------------------------------------------------------- */}
      <div className="relative z-20 w-full mt-1 perspective-1200 shrink-0">
        <div className="desk-transform p-3 md:p-3.5 rounded-3xl bg-slate-950/95 border-2 border-cyan-500/50 backdrop-blur-2xl shadow-[0_0_50px_rgba(6,182,212,0.25)] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2 text-xs font-mono text-slate-400 flex-wrap gap-1">
            <span className="flex items-center gap-2 text-cyan-300 font-orbitron font-bold">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>MOBILE COMMAND DOCK &amp; QUICK LAUNCHER</span>
            </span>
            <span className="text-[10px] text-emerald-400 font-bold">
              TOUCH READY • {allModulesList.length} MOBILE MODULES
            </span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-11 gap-2 text-center text-xs font-mono">
            {allModulesList.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  soundEffects.playBeepConfirm();
                  triggerHaptic(15);
                  if (item.id === "humanoid" && onOpenHumanoidStage) {
                    onOpenHumanoidStage();
                  } else if (onOpenModule) {
                    onOpenModule(item.id as any);
                  }
                }}
                className={`p-2 rounded-xl border transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${item.color}`}
              >
                {item.icon}
                <span className="text-[10px] font-bold tracking-wider truncate w-full">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// 12 Pure Mobile Command Modules
const allModulesList = [
  { id: "comms", label: "Phone Alerts", icon: <Bell className="w-4 h-4 text-emerald-400" />, color: "bg-emerald-950/70 border-emerald-500/50 hover:border-emerald-400 text-emerald-300" },
  { id: "humanoid", label: "Zoya 3D", icon: <User className="w-4 h-4 text-pink-400" />, color: "bg-pink-950/60 border-pink-500/40 hover:border-pink-400 text-pink-300" },
  { id: "desktop", label: "Phone Hub", icon: <Smartphone className="w-4 h-4 text-cyan-400" />, color: "bg-cyan-950/60 border-cyan-500/40 hover:border-cyan-400 text-cyan-300" },
  { id: "studio", label: "Reels AI", icon: <Film className="w-4 h-4 text-rose-400" />, color: "bg-rose-950/60 border-rose-500/40 hover:border-rose-400 text-rose-300" },
  { id: "study", label: "Study Hub", icon: <GraduationCap className="w-4 h-4 text-purple-400" />, color: "bg-purple-950/60 border-purple-500/40 hover:border-purple-400 text-purple-300" },
  { id: "records", label: "Life Vault", icon: <Database className="w-4 h-4 text-indigo-400" />, color: "bg-indigo-950/60 border-indigo-500/40 hover:border-indigo-400 text-indigo-300" },
  { id: "health", label: "Health", icon: <Heart className="w-4 h-4 text-emerald-400" />, color: "bg-emerald-950/60 border-emerald-500/40 hover:border-emerald-400 text-emerald-300" },
  { id: "finance", label: "Wallet", icon: <DollarSign className="w-4 h-4 text-amber-400" />, color: "bg-amber-950/60 border-amber-500/40 hover:border-amber-400 text-amber-300" },
  { id: "automation", label: "Routines", icon: <Terminal className="w-4 h-4 text-cyan-400" />, color: "bg-cyan-950/60 border-cyan-500/40 hover:border-cyan-400 text-cyan-300" },
  { id: "communication", label: "Msgs & AI", icon: <Zap className="w-4 h-4 text-purple-400" />, color: "bg-purple-950/60 border-purple-500/40 hover:border-purple-400 text-purple-300" },
  { id: "maps", label: "GPS Maps", icon: <MapPin className="w-4 h-4 text-blue-400" />, color: "bg-blue-950/60 border-blue-500/40 hover:border-blue-400 text-blue-300" },
  { id: "devices", label: "Bridges", icon: <Radio className="w-4 h-4 text-emerald-400" />, color: "bg-emerald-950/60 border-emerald-500/40 hover:border-emerald-400 text-emerald-300" },
];
