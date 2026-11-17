import React, { useState, useRef, useEffect } from "react";
import {
  X,
  Sparkles,
  Wallpaper,
  Clock,
  SlidersHorizontal,
  Fingerprint,
  LayoutGrid,
  Zap,
  Check,
  Smartphone,
  Shield,
  Layers,
  Play,
  Upload,
  Trash2,
  ScanFace,
  Activity,
  BellRing,
  UserPlus,
  Waves,
  CheckCheck,
  Lock,
  RefreshCw,
} from "lucide-react";
import type {
  OneUiStudioConfig,
  ProactiveAlertConfig,
  UserActivityState,
  DynamicBarAnchor,
  VipContactRule,
} from "../types";
import {
  LIVE_WALLPAPER_PRESETS,
  LOCK_DESIGN_PRESETS,
  CLOCK_STYLE_PRESETS,
  DYNAMIC_BAR_PRESETS,
  FINGERPRINT_ANIM_PRESETS,
  FACE_ANIM_PRESETS,
  UNLOCK_BAR_ANIM_PRESETS,
  WAVE_VISUALIZER_PRESETS,
  WAVE_COLOR_THEMES,
  CHARGING_ANIM_PRESETS,
  HOME_LAYOUT_PRESETS,
  APP_ICON_STYLE_PRESETS,
  QUICK_PANEL_STYLE_PRESETS,
  EDGE_LIGHTING_PRESETS,
  AOD_STYLE_PRESETS,
  ACCENT_SWATCHES,
  DEFAULT_APP_ALERT_RULES,
} from "../data/oneUi9Catalog";
import {
  LiveWallpaperCanvas,
  renderPhoneWallpaperBitmapDataUrlAsync,
} from "./LiveWallpaperCanvas";
import { OneUiClockPreview } from "./OneUiClockPreview";
import { FingerprintAnimView } from "./FingerprintAnimView";
import { getIconShapeStyle } from "./OneUiHomeGrid";
import { ColorfulWaveVisualizer } from "./ColorfulWaveVisualizer";
import {
  compressGalleryImageFile,
  sanitizeUserInput,
} from "../services/securityHardening";
import {
  applyLiveWallpaperOnPhoneAndroid,
  applyBitmapWallpaperOnPhoneAndroid,
  syncOneUiOverlayConfigAndroid,
  syncCustomMediaImageAndroid,
  openOverlayPermissionSettingsAndroid,
  openAccessibilitySettingsAndroid,
  getAccessibilityStatusAndroid,
  getNativeBackgroundStatus,
  triggerDynamicBarUnlockEffectAndroid,
  triggerChargingOverlayTestAndroid,
  acknowledgeVipRemindersAndroid,
} from "../services/nativeAndroidBridge";

const DEFAULT_BIO_PORTRAIT =
  "/assets/aistudio/Gemini_Generated_Image_55uicz55uicz55ui_f744178a.jpg";

type StudioCategory =
  | "wallpapers"
  | "lock_clock"
  | "dynamic_bar"
  | "bio_charge"
  | "home_icons"
  | "switches_aod"
  | "vip_activity";

interface OneUi9StudioProps {
  isOpen: boolean;
  onClose: () => void;
  config: OneUiStudioConfig;
  onUpdateConfig: (next: OneUiStudioConfig) => void;
  proactiveAlerts?: ProactiveAlertConfig;
  onUpdateProactiveAlerts?: (next: ProactiveAlertConfig) => void;
  activityState?: UserActivityState;
  onTestChargingAnim: () => void;
  onTestUnlockEffect?: (method?: "Fingerprint" | "Face") => void;
  onOpenQuickPanel: () => void;
  onOpenHomeMode: () => void;
  onOpenLockPreview: () => void;
  onToast: (msg: string) => void;
}

const DEFAULT_ALERTS_FALLBACK: ProactiveAlertConfig = {
  incomingNotifications: true,
  speakNotificationsAloud: true,
  lowBatteryThreshold: 20,
  taskReminders: true,
  networkAlerts: true,
  vipContacts: [],
  appRules: DEFAULT_APP_ALERT_RULES,
  taskUrgentRepeatMinutes: 5,
  activityAwareMode: true,
  autoCallVoiceControl: true,
};

export const OneUi9Studio: React.FC<OneUi9StudioProps> = ({
  isOpen,
  onClose,
  config,
  onUpdateConfig,
  proactiveAlerts,
  onUpdateProactiveAlerts,
  activityState = "sitting_stationary",
  onTestChargingAnim,
  onTestUnlockEffect,
  onOpenQuickPanel,
  onOpenHomeMode,
  onOpenLockPreview,
  onToast,
}) => {
  const [tab, setTab] = useState<StudioCategory>("wallpapers");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [overlayGranted, setOverlayGranted] = useState<boolean | null>(null);
  const [accessibilityEnabled, setAccessibilityEnabled] = useState<boolean | null>(null);
  const [customLabelDraft, setCustomLabelDraft] = useState(
    config.dynamicBarCustomLabel || "Wasu's Jarvis"
  );
  const [vipNameDraft, setVipNameDraft] = useState("");
  const [vipPhoneDraft, setVipPhoneDraft] = useState("");
  const [vipRepeatDraft, setVipRepeatDraft] = useState(2);
  const [vipPriorityDraft, setVipPriorityDraft] = useState<"critical" | "high">("critical");

  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const bioImgInputRef = useRef<HTMLInputElement | null>(null);
  const syncTimerRef = useRef<number | null>(null);

  const refreshOverlayPermissions = async () => {
    try {
      const [bg, acc] = await Promise.all([
        getNativeBackgroundStatus().catch(() => null),
        getAccessibilityStatusAndroid().catch(() => false),
      ]);
      if (bg && typeof bg.overlayGranted === "boolean") {
        setOverlayGranted(bg.overlayGranted);
      }
      if (typeof acc === "boolean") {
        setAccessibilityEnabled(acc || Boolean(bg?.accessibilityEnabled));
      } else if (bg && typeof bg.accessibilityEnabled === "boolean") {
        setAccessibilityEnabled(bg.accessibilityEnabled);
      }
    } catch {}
  };

  useEffect(() => {
    if (!isOpen) return;
    refreshOverlayPermissions();
  }, [isOpen]);

  if (!isOpen) return null;

  const alertsCfg: ProactiveAlertConfig = proactiveAlerts || DEFAULT_ALERTS_FALLBACK;
  const appRules =
    alertsCfg.appRules && alertsCfg.appRules.length > 0
      ? alertsCfg.appRules
      : DEFAULT_APP_ALERT_RULES;

  const syncFullToNative = (
    nextCfg: OneUiStudioConfig,
    nextAlerts: ProactiveAlertConfig = alertsCfg
  ) => {
    if (syncTimerRef.current) {
      window.clearTimeout(syncTimerRef.current);
    }
    syncTimerRef.current = window.setTimeout(() => {
      syncOneUiOverlayConfigAndroid({
        dynamicBarStyle: nextCfg.dynamicBarStyleId,
        dynamicBarAnchor: nextCfg.dynamicBarAnchor,
        dynamicBarOffsetX: nextCfg.dynamicBarOffsetX,
        dynamicBarOffsetY: nextCfg.dynamicBarOffsetY,
        dynamicBarCameraGapPx: nextCfg.dynamicBarCameraGapPx ?? 34,
        dynamicBarCustomLabel: nextCfg.dynamicBarCustomLabel,
        dynamicBarShowOutsideApp: nextCfg.dynamicBarShowOutsideApp,
        unlockBarAnimStyle: nextCfg.unlockBarAnimStyle,
        fingerprintAnimId: nextCfg.fingerprintAnimId,
        faceAnimId: nextCfg.faceAnimId,
        fingerprintOnAnyWallpaper: nextCfg.fingerprintOnAnyWallpaper !== false,
        biometricUnlockAnimDisplay: nextCfg.biometricUnlockAnimDisplay || "auto",
        chargingAnim: nextCfg.chargingAnimId,
        chargingOverlayEnabled: nextCfg.chargingOverlayEnabled,
        accentHex: nextCfg.accentColorHex,
        liveWallpaperStyle: nextCfg.liveWallpaperId,
        clockHex: nextCfg.clockColorHex,
        waveVisualizerStyle: nextCfg.waveVisualizerStyle,
        waveColorTheme: nextCfg.waveColorTheme,
        followUpListeningEnabled: nextCfg.followUpListeningEnabled,
        vipContactsJson: JSON.stringify(nextAlerts.vipContacts || []),
        perAppRulesJson: JSON.stringify(nextAlerts.appRules || DEFAULT_APP_ALERT_RULES),
      }).catch(() => {});
    }, 200);
  };

  const update = (patch: Partial<OneUiStudioConfig>, toastMsg?: string) => {
    const next = { ...config, ...patch };
    onUpdateConfig(next);
    syncFullToNative(next, alertsCfg);
    if (toastMsg) onToast(toastMsg);
  };

  const updateAlerts = (patch: Partial<ProactiveAlertConfig>, toastMsg?: string) => {
    const nextAlerts: ProactiveAlertConfig = { ...alertsCfg, ...patch };
    onUpdateProactiveAlerts?.(nextAlerts);
    syncFullToNative(config, nextAlerts);
    if (toastMsg) onToast(toastMsg);
  };

  const handleGalleryWallpaperUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setBusyAction("gallery_upload");
      const dataUrl = await compressGalleryImageFile(file, {
        maxWidth: 900,
        maxHeight: 1600,
        quality: 0.80,
      });
      await syncCustomMediaImageAndroid("wallpaper", dataUrl).catch(() => {});
      update({ galleryWallpaperDataUrl: dataUrl }, "Gallery wallpaper loaded! Tap Apply Home / Lock / Both.");
    } catch (err: any) {
      onToast(err?.message || "Image load nahi ho saki.");
    } finally {
      setBusyAction(null);
    }
  };

  const handleBioImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setBusyAction("bio_upload");
      const dataUrl = await compressGalleryImageFile(file, {
        maxWidth: 300,
        maxHeight: 300,
        quality: 0.80,
        preferPng: false,
      });
      await syncCustomMediaImageAndroid("bio", dataUrl).catch(() => {});
      update(
        { customBiometricImageDataUrl: dataUrl },
        "Custom Biometric & Charging photo applied to Fingerprint, Face & Charging animations!"
      );
    } catch (err: any) {
      onToast(err?.message || "Biometric photo load nahi ho saka.");
    } finally {
      setBusyAction(null);
    }
  };

  const handleApplyLiveWallpaper = async () => {
    setBusyAction("live_wp");
    const res = await applyLiveWallpaperOnPhoneAndroid({
      style: config.liveWallpaperId,
      accentHex: config.accentColorHex,
      clockHex: config.clockColorHex,
      showClock: true,
    });
    setBusyAction(null);
    onToast(res.message);
  };

  const handleApplyStaticWallpaper = async (target: "home" | "lock" | "both") => {
    setBusyAction(target);
    const dataUrl = await renderPhoneWallpaperBitmapDataUrlAsync({
      styleId: config.liveWallpaperId,
      accentHex: config.accentColorHex,
      clockHex: config.clockColorHex,
      clockStyleId: config.clockStyleId,
      includeClock: target === "lock" || target === "both",
      galleryImageUrl: config.galleryWallpaperDataUrl || undefined,
    });
    const res = await applyBitmapWallpaperOnPhoneAndroid(dataUrl, target);
    setBusyAction(null);
    onToast(res.message);
  };

  const handleTestUnlock = async (method: "Fingerprint" | "Face" = "Fingerprint") => {
    await triggerDynamicBarUnlockEffectAndroid(method);
    onTestUnlockEffect?.(method);
    onToast(`${method} unlock animation triggered on Dynamic Bar!`);
  };

  const handleTestCharging = async () => {
    await triggerChargingOverlayTestAndroid();
    onTestChargingAnim();
  };

  const handleAddVipContact = () => {
    const name = sanitizeUserInput(vipNameDraft, 60);
    if (!name) {
      onToast("VIP contact ka naam likhein.");
      return;
    }
    const phone = sanitizeUserInput(vipPhoneDraft, 40);
    const newVip: VipContactRule = {
      id: `vip_${Date.now()}`,
      name,
      phoneOrHandle: phone,
      priority: vipPriorityDraft,
      repeatMinutes: vipRepeatDraft,
      alwaysSpeakAloud: true,
    };
    const nextVips = [...(alertsCfg.vipContacts || []), newVip];
    updateAlerts({ vipContacts: nextVips }, `VIP Added: ${name}`);
    setVipNameDraft("");
    setVipPhoneDraft("");
  };

  const activityMeta: Record<UserActivityState, { label: string; desc: string; color: string }> = {
    lying_sleeping: {
      label: "Resting / Sleeping",
      desc: "Quiet shield active — sirf Critical VIP alerts bol kar batayega.",
      color: "#8b5cf6",
    },
    sitting_stationary: {
      label: "Sitting / Desk Mode",
      desc: "Normal clear voice announcements & Dynamic Bar updates active.",
      color: "#00f0ff",
    },
    walking: {
      label: "Walking / On Foot",
      desc: "Auto-concise spoken updates & active step motion detected.",
      color: "#10b981",
    },
    riding_bike: {
      label: "Riding / Driving",
      desc: "Hands-free mode — Calls & WhatsApp messages auto announce.",
      color: "#f59e0b",
    },
    unknown: {
      label: "Calibrating Sensors",
      desc: "Device accelerometer & motion telemetry ready.",
      color: "#94a3b8",
    },
  };

  const curAct = activityMeta[activityState] || activityMeta.sitting_stationary;

  const tabs: Array<{ id: StudioCategory; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: "wallpapers", label: "Wallpapers", icon: Wallpaper },
    { id: "lock_clock", label: "Lock & Clock", icon: Clock },
    { id: "dynamic_bar", label: "Now Bar & Wave", icon: Layers },
    { id: "bio_charge", label: "Print, Face & Charge", icon: Fingerprint },
    { id: "home_icons", label: "Home & Icons", icon: LayoutGrid },
    { id: "switches_aod", label: "Switches & Edge", icon: SlidersHorizontal },
    { id: "vip_activity", label: "VIP & Activity", icon: BellRing },
  ];

  const activeBioImage = config.customBiometricImageDataUrl || DEFAULT_BIO_PORTRAIT;

  return (
    <div className="fixed inset-0 z-[95] bg-[#030713] text-slate-100 flex flex-col font-rajdhani overflow-hidden">
      {/* Hidden file inputs */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleGalleryWallpaperUpload}
      />
      <input
        ref={bioImgInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleBioImageUpload}
      />

      {/* Top Studio Header */}
      <header className="shrink-0 px-4 sm:px-6 py-3 bg-[#060d20]/95 border-b border-slate-500/25 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src="/oneui9-icon.png"
            alt="One UI 9 Studio"
            className="w-10 h-10 rounded-xl shadow-lg shrink-0"
          />
          <div className="min-w-0">
            <h1 className="font-orbitron font-black text-sm sm:text-base tracking-wider text-white truncate">
              ONE UI 9 THEME & PERSONALIZATION STUDIO
            </h1>
            <p className="text-[11px] font-mono text-cyan-300/80 truncate">
              Gallery Wallpapers • Always-On Now Bar • Biometrics • Wave & VIP Engine
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close One UI 9 Studio"
          className="min-w-[44px] min-h-[44px] px-3 rounded-xl bg-slate-900 border border-slate-600/50 text-slate-200 flex items-center justify-center gap-1.5 cursor-pointer hover:border-cyan-400 transition shrink-0 whitespace-nowrap"
        >
          <X className="w-4 h-4" />
          <span className="hidden sm:inline text-xs font-mono">Close</span>
        </button>
      </header>

      {/* Main Content Split: Live Phone Preview + Full Customization Controls */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-6 py-4 pb-24 lg:pb-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[330px_1fr] gap-6 items-start">
          {/* LEFT: Live Phone Preview Mockup */}
          <div className="lg:sticky lg:top-4 flex flex-col items-center gap-3">
            <div
              className="relative w-full max-w-[290px] aspect-[9/17.5] rounded-[36px] border-[4px] border-slate-700/80 bg-[#020510] overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.85)] flex flex-col justify-between p-4"
              style={{ boxShadow: `0 0 42px ${config.accentColorHex}22` }}
            >
              {/* Live Animated + Gallery Wallpaper Layer */}
              <div className="pointer-events-none absolute inset-0">
                <LiveWallpaperCanvas
                  styleId={config.liveWallpaperId}
                  accentHex={config.accentColorHex}
                  galleryImageUrl={config.galleryWallpaperDataUrl || undefined}
                  interactive={false}
                />
              </div>

              {/* Front Camera Punch-Hole Punchout */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute top-2.5 left-1/2 -translate-x-1/2 z-20 w-3.5 h-3.5 rounded-full bg-black border border-slate-700/80 shadow-inner"
              />

              {/* Live Positioned Dynamic Bar Preview */}
              {config.dynamicBarStyleId !== "hidden" && (
                <div
                  className="absolute z-30 flex justify-center pointer-events-none"
                  style={
                    config.dynamicBarAnchor === "bottom-center"
                      ? {
                          bottom: `${Math.max(12, Math.min(240, Math.round(config.dynamicBarOffsetY * 0.45)))}px`,
                          left: `calc(50% + ${Math.round(config.dynamicBarOffsetX * 0.45)}px)`,
                          transform: "translateX(-50%)",
                        }
                      : config.dynamicBarAnchor === "top-left"
                      ? {
                          top: `${Math.max(8, Math.min(340, Math.round(config.dynamicBarOffsetY * 0.48)))}px`,
                          left: `${Math.max(8, 10 + Math.round(config.dynamicBarOffsetX * 0.45))}px`,
                        }
                      : config.dynamicBarAnchor === "top-right"
                      ? {
                          top: `${Math.max(8, Math.min(340, Math.round(config.dynamicBarOffsetY * 0.48)))}px`,
                          right: `${Math.max(8, 10 - Math.round(config.dynamicBarOffsetX * 0.45))}px`,
                        }
                      : {
                          top: `${Math.max(4, Math.min(340, Math.round(config.dynamicBarOffsetY * 0.48)))}px`,
                          left: `calc(50% + ${Math.round(config.dynamicBarOffsetX * 0.45)}px)`,
                          transform: "translateX(-50%)",
                        }
                  }
                >
                  {config.dynamicBarAnchor === "camera-island" ? (
                    <div
                      className="px-2.5 py-1 rounded-full bg-black border-[1.5px] border-amber-400 text-[9px] font-mono text-emerald-300 flex items-center gap-1.5 shadow-[0_0_16px_rgba(245,158,11,0.35)]"
                    >
                      <span className="truncate max-w-[54px]">
                        {(config.dynamicBarCustomLabel?.trim() || "Jarvis").slice(0, 8)}
                      </span>
                      <span
                        style={{
                          width: `${Math.max(10, Math.round((config.dynamicBarCameraGapPx ?? 34) * 0.55))}px`,
                        }}
                      />
                      <span className="w-7 h-2 rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-purple-400" />
                    </div>
                  ) : (
                    <div
                      className="px-3 py-1 rounded-full bg-black/90 border text-[10px] font-mono text-white flex items-center gap-1.5 shadow-lg max-w-[240px]"
                      style={{ borderColor: config.accentColorHex }}
                    >
                      <Sparkles className="w-3 h-3 shrink-0" style={{ color: config.accentColorHex }} />
                      <span className="truncate">
                        {config.dynamicBarCustomLabel?.trim() || "Wasu's Jarvis"}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Top Spacer */}
              <div className="h-8 shrink-0" />

              {/* Middle Clock & Icon Sample */}
              <div className="relative z-10 flex flex-col items-center gap-3 my-auto">
                <OneUiClockPreview
                  styleId={config.clockStyleId}
                  colorHex={config.clockColorHex}
                  accentHex={config.accentColorHex}
                  batteryPercent={86}
                  compact
                />

                {/* Sample Styled App Icons Row */}
                <div className="grid grid-cols-4 gap-2 pt-2">
                  {["#10b981", "#38bdf8", "#f43f5e", "#a855f7"].map((tint, idx) => (
                    <div
                      key={idx}
                      className="w-9 h-9 flex items-center justify-center"
                      style={getIconShapeStyle(config.appIconStyleId, tint, config.accentColorHex)}
                    >
                      <Smartphone className="w-4 h-4 text-white/90" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom Fingerprint Preview */}
              <div className="relative z-10 flex flex-col items-center gap-2 pb-1">
                <FingerprintAnimView
                  animId={config.fingerprintAnimId}
                  customImageUrl={activeBioImage}
                  size="sm"
                />
                <div className="text-[10px] font-mono text-slate-200/90 uppercase tracking-widest text-center">
                  {LOCK_DESIGN_PRESETS.find((l) => l.id === config.lockDesignId)?.name}
                </div>
              </div>
            </div>

            {/* Direct Phone Action Buttons */}
            <div className="w-full max-w-[290px] grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={Boolean(busyAction)}
                onClick={handleApplyLiveWallpaper}
                className="min-h-[44px] px-3 py-2 rounded-xl font-orbitron font-bold text-[11px] text-[#030712] flex items-center justify-center gap-1.5 cursor-pointer transition active:scale-95 whitespace-nowrap shrink-0"
                style={{ background: config.accentColorHex }}
              >
                <Wallpaper className="w-3.5 h-3.5 shrink-0" />
                <span>{busyAction === "live_wp" ? "Opening..." : "Set Live Wall"}</span>
              </button>

              <button
                type="button"
                disabled={Boolean(busyAction)}
                onClick={() => handleApplyStaticWallpaper("both")}
                className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-900 border border-slate-500/40 font-orbitron font-bold text-[11px] text-slate-100 flex items-center justify-center gap-1.5 cursor-pointer transition active:scale-95 whitespace-nowrap shrink-0"
              >
                <Clock className="w-3.5 h-3.5 shrink-0" style={{ color: config.accentColorHex }} />
                <span>{busyAction === "both" ? "Applying..." : "Apply Both"}</span>
              </button>
            </div>
          </div>

          {/* RIGHT: Category Controls */}
          <div className="space-y-6">
            {/* Desktop Category Tabs */}
            <div className="hidden lg:flex flex-wrap gap-2 pb-2 border-b border-slate-500/20">
              {tabs.map((t) => {
                const Icon = t.icon;
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-orbitron font-bold flex items-center gap-2 cursor-pointer transition whitespace-nowrap shrink-0 ${
                      active
                        ? "text-[#030712] shadow-lg"
                        : "bg-slate-900/80 border border-slate-500/25 text-slate-300 hover:text-white"
                    }`}
                    style={active ? { background: config.accentColorHex } : undefined}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>

            {/* 1. LIVE & GALLERY WALLPAPERS */}
            {tab === "wallpapers" && (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-orbitron font-bold text-base text-white">
                      Gallery Photo & Live Motion Wallpapers
                    </h2>
                    <p className="text-xs text-slate-400">
                      Apni Gallery se koi bhi picture select karein ya 10 live motion shaders mein se choose karke Phone Home aur Lock screen par apply karein.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      update({
                        liveWallpaperEnabledInApp: !config.liveWallpaperEnabledInApp,
                      })
                    }
                    className={`min-h-[44px] px-3.5 py-2 rounded-xl border text-xs font-mono cursor-pointer whitespace-nowrap shrink-0 ${
                      config.liveWallpaperEnabledInApp
                        ? "bg-emerald-950/70 border-emerald-400 text-emerald-300"
                        : "bg-slate-900 border-slate-700 text-slate-400"
                    }`}
                  >
                    {config.liveWallpaperEnabledInApp ? "In-App Backdrop: ON" : "In-App Backdrop: OFF"}
                  </button>
                </div>

                {/* Gallery Upload & Explicit Apply Panel */}
                <div className="p-4 rounded-2xl bg-[#050b1c]/90 border border-cyan-500/30 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {config.galleryWallpaperDataUrl ? (
                        <img
                          src={config.galleryWallpaperDataUrl}
                          alt="Selected Gallery Wallpaper"
                          className="w-12 h-16 object-cover rounded-xl border border-cyan-400/50 shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-16 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center shrink-0">
                          <Wallpaper className="w-5 h-5 text-slate-500" />
                        </div>
                      )}
                      <div>
                        <div className="text-xs font-orbitron font-bold text-white">
                          Gallery Custom Wallpaper
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {config.galleryWallpaperDataUrl
                            ? "Custom photo active — Live animations aur Clocks iske saath blend hain."
                            : "Phone gallery se photo upload karke One UI 9 clocks ke saath set karein."}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={Boolean(busyAction)}
                        onClick={() => galleryInputRef.current?.click()}
                        className="min-h-[44px] px-3.5 py-2 rounded-xl font-orbitron font-bold text-xs text-black flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                        style={{ background: config.accentColorHex }}
                      >
                        <Upload className="w-4 h-4" />
                        <span>{busyAction === "gallery_upload" ? "Loading..." : "Upload Gallery Photo"}</span>
                      </button>

                      {config.galleryWallpaperDataUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            syncCustomMediaImageAndroid("wallpaper", "").catch(() => {});
                            update({ galleryWallpaperDataUrl: "" }, "Gallery photo removed.");
                          }}
                          className="min-h-[44px] px-3 py-2 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs font-mono text-rose-200 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Clear</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Direct Phone Apply Targets */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    <button
                      type="button"
                      disabled={Boolean(busyAction)}
                      onClick={() => handleApplyStaticWallpaper("home")}
                      className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-900 border border-slate-600 text-xs font-mono text-slate-100 hover:border-cyan-400 cursor-pointer whitespace-nowrap"
                    >
                      {busyAction === "home" ? "Applying..." : "Apply Phone Home"}
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(busyAction)}
                      onClick={() => handleApplyStaticWallpaper("lock")}
                      className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-900 border border-slate-600 text-xs font-mono text-slate-100 hover:border-cyan-400 cursor-pointer whitespace-nowrap"
                    >
                      {busyAction === "lock" ? "Applying..." : "Apply Lock + Clock"}
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(busyAction)}
                      onClick={() => handleApplyStaticWallpaper("both")}
                      className="min-h-[44px] px-3 py-2 rounded-xl bg-cyan-950/70 border border-cyan-400/60 text-xs font-mono text-cyan-200 cursor-pointer whitespace-nowrap"
                    >
                      {busyAction === "both" ? "Applying..." : "Apply Home & Lock"}
                    </button>
                  </div>
                </div>

                {/* Accent Swatches */}
                <div className="flex flex-wrap items-center gap-2.5 p-3 rounded-2xl bg-slate-900/70 border border-slate-500/20">
                  <span className="text-xs font-mono text-slate-300 mr-1">Theme Glow Color:</span>
                  {ACCENT_SWATCHES.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => update({ accentColorHex: hex })}
                      className="w-9 h-9 rounded-full border-2 flex items-center justify-center cursor-pointer transition-transform active:scale-90"
                      style={{
                        background: hex,
                        borderColor: config.accentColorHex === hex ? "#ffffff" : "transparent",
                      }}
                      aria-label={`Select color ${hex}`}
                    >
                      {config.accentColorHex === hex && <Check className="w-4 h-4 text-black" />}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                  {LIVE_WALLPAPER_PRESETS.map((wp) => {
                    const selected = config.liveWallpaperId === wp.id;
                    return (
                      <button
                        key={wp.id}
                        type="button"
                        onClick={() => update({ liveWallpaperId: wp.id, accentColorHex: wp.primary })}
                        className={`group rounded-2xl overflow-hidden border text-left transition cursor-pointer ${
                          selected
                            ? "border-cyan-400 ring-2 ring-cyan-400/40"
                            : "border-slate-500/25 hover:border-slate-400/50"
                        }`}
                      >
                        <div
                          className="h-28 relative overflow-hidden"
                          style={{
                            background: `radial-gradient(circle at 25% 30%, ${wp.primary}66, transparent 55%), radial-gradient(circle at 75% 75%, ${wp.secondary}66, transparent 55%), ${wp.bg}`,
                          }}
                        >
                          {selected && (
                            <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-cyan-400 text-black flex items-center justify-center">
                              <Check className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                        <div className="p-2.5 bg-slate-950/90">
                          <div className="text-xs font-semibold text-white truncate">{wp.name}</div>
                          <div className="text-[10px] font-mono text-slate-400 truncate">{wp.tagline}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2. LOCK SCREEN DESIGNS & CLOCKS */}
            {tab === "lock_clock" && (
              <div className="space-y-6">
                {/* Direct Unlock vs Lock Behavior Setting */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-cyan-500/35 flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-0.5 max-w-xl">
                    <div className="flex items-center gap-2 text-xs font-orbitron font-bold text-cyan-200">
                      <Shield className="w-4 h-4 text-cyan-400" />
                      <span>Startup Passkey Gate (Auto-Wake Behavior)</span>
                    </div>
                    <p className="text-xs text-slate-300">
                      OFF rakhne par Jarvis bina lock ke foran khulta hai aur phone band/close hone par bhi &quot;Jarvis&quot; bolne par direct sunna shuru karta hai.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => update({ requireStartupLock: !config.requireStartupLock })}
                      className={`min-h-[44px] px-4 py-2 rounded-xl font-mono text-xs font-bold border cursor-pointer whitespace-nowrap shrink-0 ${
                        config.requireStartupLock
                          ? "bg-amber-950/70 border-amber-400 text-amber-200"
                          : "bg-emerald-950/70 border-emerald-400 text-emerald-200"
                      }`}
                    >
                      {config.requireStartupLock ? "Startup Lock: ON" : "Direct Open: ON"}
                    </button>
                    <button
                      type="button"
                      onClick={onOpenLockPreview}
                      className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-600 text-xs font-mono text-slate-200 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Preview Lock
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(busyAction)}
                      onClick={() => handleApplyStaticWallpaper("lock")}
                      className="min-h-[44px] px-3.5 py-2 rounded-xl font-orbitron font-bold text-xs text-black cursor-pointer whitespace-nowrap shrink-0"
                      style={{ background: config.accentColorHex }}
                    >
                      Apply Lock + Clock
                    </button>
                  </div>
                </div>

                {/* Lock Screen Designs */}
                <div className="space-y-3">
                  <h3 className="font-orbitron font-bold text-sm text-white">Lock Screen Designs (6 Styles)</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {LOCK_DESIGN_PRESETS.map((ld) => {
                      const active = config.lockDesignId === ld.id;
                      return (
                        <button
                          key={ld.id}
                          type="button"
                          onClick={() => update({ lockDesignId: ld.id }, `Lock Design: ${ld.name}`)}
                          className={`min-h-[72px] p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                            active
                              ? "bg-cyan-950/50 border-cyan-400 text-white"
                              : "bg-slate-900/70 border-slate-500/25 text-slate-300"
                          }`}
                        >
                          <div className="text-xs font-bold flex items-center justify-between">
                            <span>{ld.name}</span>
                            {active && <Check className="w-4 h-4 text-cyan-300" />}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1">{ld.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Clock Designs */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-orbitron font-bold text-sm text-white">One UI 9 Clock Styles (8 Designs)</h3>
                    <div className="flex items-center gap-2">
                      {ACCENT_SWATCHES.map((hex) => (
                        <button
                          key={hex}
                          type="button"
                          onClick={() => update({ clockColorHex: hex })}
                          className="w-7 h-7 rounded-full border cursor-pointer"
                          style={{
                            background: hex,
                            borderColor: config.clockColorHex === hex ? "#fff" : "transparent",
                          }}
                          aria-label={`Clock color ${hex}`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {CLOCK_STYLE_PRESETS.map((cs) => {
                      const active = config.clockStyleId === cs.id;
                      return (
                        <button
                          key={cs.id}
                          type="button"
                          onClick={() => update({ clockStyleId: cs.id }, `Clock Style: ${cs.name}`)}
                          className={`min-h-[82px] p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                            active
                              ? "bg-cyan-950/45 border-cyan-400"
                              : "bg-slate-900/70 border-slate-500/25"
                          }`}
                        >
                          <span className="text-xs font-semibold text-white">{cs.name}</span>
                          <span className="text-[10px] font-mono text-slate-400">{cs.sampleFont}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 3. DYNAMIC BAR / NOW BAR & COLORFUL VOICE WAVE */}
            {tab === "dynamic_bar" && (
              <div className="space-y-6">
                {/* Lockscreen & Camera Punch-Hole Accessibility Setup Banner */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-950/50 via-[#071127] to-cyan-950/40 border border-amber-400/50 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1 max-w-xl">
                      <h2 className="font-orbitron font-bold text-sm sm:text-base text-white flex items-center gap-2">
                        <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>Camera Cutout + Lockscreen Dynamic Bar Permissions</span>
                      </h2>
                      <p className="text-xs text-slate-300">
                        Dynamic Bar ko bilkul Front Camera punch-hole ke upar, aur phone Lockscreen ke upar chalane ke liye Accessibility aur Overlay dono ON karein.
                      </p>
                      <div className="flex flex-wrap gap-3 pt-1 text-[11px] font-mono">
                        <span className={overlayGranted ? "text-emerald-300" : "text-amber-300"}>
                          Display Over Apps: {overlayGranted ? "Active" : "Required"}
                        </span>
                        <span className="text-slate-600">•</span>
                        <span className={accessibilityEnabled ? "text-emerald-300" : "text-amber-300"}>
                          Lockscreen & Camera Island: {accessibilityEnabled ? "Active" : "Turn ON in Accessibility"}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => refreshOverlayPermissions()}
                      className="min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-600 text-xs font-mono text-slate-200 flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Refresh</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        await openAccessibilitySettingsAndroid();
                        onToast("Accessibility -> Installed Apps -> Wasu's Jarvis Camera Island & Lockscreen ON karein.");
                      }}
                      className="min-h-[44px] px-4 py-2 rounded-xl bg-amber-500 text-black font-orbitron font-bold text-xs cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Enable Lockscreen & Camera Island
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await openOverlayPermissionSettingsAndroid();
                        onToast("Display Over Other Apps enable karein taake Dynamic Bar har app ke upar dikhe.");
                      }}
                      className="min-h-[44px] px-4 py-2 rounded-xl bg-cyan-500/20 border border-cyan-400/60 text-xs font-mono text-cyan-200 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Allow Overlay Permission
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        update({
                          dynamicBarShowOutsideApp: !config.dynamicBarShowOutsideApp,
                        })
                      }
                      className={`min-h-[44px] px-3.5 py-2 rounded-xl border text-xs font-mono cursor-pointer whitespace-nowrap shrink-0 ${
                        config.dynamicBarShowOutsideApp
                          ? "bg-emerald-950/70 border-emerald-400 text-emerald-300"
                          : "bg-slate-900 border-slate-700 text-slate-400"
                      }`}
                    >
                      {config.dynamicBarShowOutsideApp ? "Outside-App Bar: ON" : "Outside-App Bar: OFF"}
                    </button>
                  </div>
                </div>

                {/* Custom Brand Text + Position Anchor & Locked Position Sliders */}
                <div className="p-4 rounded-2xl bg-[#050b1c]/90 border border-slate-500/30 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                    <div className="flex-1 space-y-1.5">
                      <label className="text-xs font-mono text-slate-300">
                        Dynamic Bar Custom Name (One UI 9 ki jagah apna naam likhein)
                      </label>
                      <input
                        type="text"
                        value={customLabelDraft}
                        onChange={(e) => setCustomLabelDraft(e.target.value)}
                        maxLength={32}
                        placeholder="Wasu's Jarvis"
                        className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-600/70 text-sm text-white focus:border-cyan-400 focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const clean = sanitizeUserInput(customLabelDraft, 32) || "Wasu's Jarvis";
                        setCustomLabelDraft(clean);
                        update({ dynamicBarCustomLabel: clean }, `Dynamic Bar label set to "${clean}"`);
                      }}
                      className="min-h-[44px] px-4 py-2 rounded-xl font-orbitron font-bold text-xs text-black cursor-pointer whitespace-nowrap shrink-0"
                      style={{ background: config.accentColorHex }}
                    >
                      Apply Name
                    </button>
                  </div>

                  {/* Anchor Positions */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-mono text-slate-300">
                        Settings-Locked Dynamic Bar Position Anchor
                      </span>
                      <span className="text-[11px] font-mono text-emerald-300">
                        Touch Lock Active — Screen par haath lagane se nahi hilega
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          { id: "camera-island", label: "Camera Punch-Hole Island (Top)" },
                          { id: "top-center", label: "Top Center" },
                          { id: "top-left", label: "Top Left" },
                          { id: "top-right", label: "Top Right" },
                          { id: "bottom-center", label: "Bottom Center" },
                          { id: "custom", label: "Full-Screen Position (X / Y)" },
                        ] as Array<{ id: DynamicBarAnchor; label: string }>
                      ).map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() =>
                            update(
                              a.id === "camera-island"
                                ? { dynamicBarAnchor: a.id, dynamicBarOffsetX: 0, dynamicBarOffsetY: 6 }
                                : { dynamicBarAnchor: a.id },
                              `Anchor set: ${a.label}`
                            )
                          }
                          className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs font-mono cursor-pointer whitespace-nowrap ${
                            config.dynamicBarAnchor === a.id
                              ? "bg-cyan-950/60 border-cyan-400 text-cyan-200"
                              : "bg-slate-900 border-slate-700 text-slate-300"
                          }`}
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Camera Cutout Width + Full Screen X / Y Fine Tune Sliders */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-mono text-slate-300">
                        <span>Camera Cutout Gap</span>
                        <span className="tabular">{config.dynamicBarCameraGapPx ?? 34} px</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={70}
                        value={config.dynamicBarCameraGapPx ?? 34}
                        onChange={(e) => update({ dynamicBarCameraGapPx: Number(e.target.value) })}
                        className="w-full accent-amber-400 cursor-pointer"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-mono text-slate-300">
                        <span>Left / Right (X Offset)</span>
                        <span className="tabular">{config.dynamicBarOffsetX} px</span>
                      </div>
                      <input
                        type="range"
                        min={-160}
                        max={160}
                        value={config.dynamicBarOffsetX}
                        onChange={(e) => update({ dynamicBarOffsetX: Number(e.target.value) })}
                        className="w-full accent-cyan-400 cursor-pointer"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-mono text-slate-300">
                        <span>Up / Down (Y Full Screen)</span>
                        <span className="tabular">{config.dynamicBarOffsetY} px</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={780}
                        value={config.dynamicBarOffsetY}
                        onChange={(e) => update({ dynamicBarOffsetY: Number(e.target.value) })}
                        className="w-full accent-cyan-400 cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Quick Nudge Pad + Reset Camera Top */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => update({ dynamicBarOffsetX: Math.max(-160, config.dynamicBarOffsetX - 8) })}
                      className="min-h-[40px] px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-slate-200 cursor-pointer"
                    >
                      Left -8
                    </button>
                    <button
                      type="button"
                      onClick={() => update({ dynamicBarOffsetX: Math.min(160, config.dynamicBarOffsetX + 8) })}
                      className="min-h-[40px] px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-slate-200 cursor-pointer"
                    >
                      Right +8
                    </button>
                    <button
                      type="button"
                      onClick={() => update({ dynamicBarOffsetY: Math.max(0, config.dynamicBarOffsetY - 12) })}
                      className="min-h-[40px] px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-slate-200 cursor-pointer"
                    >
                      Up -12
                    </button>
                    <button
                      type="button"
                      onClick={() => update({ dynamicBarOffsetY: Math.min(780, config.dynamicBarOffsetY + 12) })}
                      className="min-h-[40px] px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-slate-200 cursor-pointer"
                    >
                      Down +12
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        update(
                          {
                            dynamicBarAnchor: "camera-island",
                            dynamicBarOffsetX: 0,
                            dynamicBarOffsetY: 6,
                            dynamicBarCameraGapPx: 34,
                          },
                          "Reset directly onto Front Camera punch-hole!"
                        )
                      }
                      className="min-h-[40px] px-3.5 rounded-xl bg-amber-500/20 border border-amber-400/60 text-xs font-mono text-amber-200 cursor-pointer"
                    >
                      Snap Over Camera Hole
                    </button>
                  </div>
                </div>

                {/* Now Bar Styles */}
                <div className="space-y-3">
                  <h3 className="font-orbitron font-bold text-sm text-white">Now Bar Styles (8 Designs)</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {DYNAMIC_BAR_PRESETS.map((db) => {
                      const active = config.dynamicBarStyleId === db.id;
                      return (
                        <button
                          key={db.id}
                          type="button"
                          onClick={() => update({ dynamicBarStyleId: db.id }, `Now Bar: ${db.name}`)}
                          className={`min-h-[76px] p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                            active
                              ? "bg-cyan-950/50 border-cyan-400 text-white"
                              : "bg-slate-900/70 border-slate-500/25 text-slate-300"
                          }`}
                        >
                          <div className="text-xs font-bold flex items-center justify-between">
                            <span>{db.name}</span>
                            {active && <Check className="w-4 h-4 text-cyan-300" />}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1">{db.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Unlock Bar Animations (Finger / Face Unlock) */}
                <div className="p-4 rounded-2xl bg-[#050b1c]/90 border border-slate-500/25 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-orbitron font-bold text-sm text-white">
                        Distinct Finger vs Face Unlock Bar Animation
                      </h3>
                      <p className="text-xs text-slate-400">
                        Finger se unlock par Emerald Fingerprint ripple chalti hai, aur Face se unlock par Violet Face Reticle animation chalti hai.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleTestUnlock("Fingerprint")}
                        className="min-h-[44px] px-3 py-2 rounded-xl bg-emerald-950/70 border border-emerald-400/70 text-xs font-mono text-emerald-200 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Fingerprint className="w-3.5 h-3.5" />
                        <span>Test Finger Unlock</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTestUnlock("Face")}
                        className="min-h-[44px] px-3 py-2 rounded-xl bg-purple-950/70 border border-purple-400/70 text-xs font-mono text-purple-200 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <ScanFace className="w-3.5 h-3.5" />
                        <span>Test Face Unlock</span>
                      </button>
                    </div>
                  </div>

                  {/* Mode Selector */}
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        { id: "auto", label: "Auto Detect (Finger / Face)" },
                        { id: "fingerprint", label: "Force Fingerprint Style" },
                        { id: "face", label: "Force Face ID Style" },
                      ] as const
                    ).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() =>
                          update({ biometricUnlockAnimDisplay: m.id }, `Unlock Mode: ${m.label}`)
                        }
                        className={`min-h-[40px] px-3 py-1.5 rounded-xl border text-xs font-mono cursor-pointer ${
                          (config.biometricUnlockAnimDisplay || "auto") === m.id
                            ? "bg-cyan-950/60 border-cyan-400 text-cyan-200"
                            : "bg-slate-900 border-slate-700 text-slate-300"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                    {UNLOCK_BAR_ANIM_PRESETS.map((ua) => {
                      const active = config.unlockBarAnimStyle === ua.id;
                      return (
                        <button
                          key={ua.id}
                          type="button"
                          onClick={() => update({ unlockBarAnimStyle: ua.id }, `Unlock Effect: ${ua.name}`)}
                          className={`min-h-[58px] p-3 rounded-xl border text-left cursor-pointer transition ${
                            active
                              ? "bg-slate-800/90 border-cyan-400 text-white"
                              : "bg-slate-900/70 border-slate-500/25 text-slate-300"
                          }`}
                        >
                          <div className="w-4 h-1.5 rounded-full mb-1.5" style={{ background: ua.accent }} />
                          <div className="text-xs font-semibold leading-snug">{ua.name}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Colorful Voice Wave Styles & Follow-up Conversation Toggle */}
                <div className="p-4 rounded-2xl bg-[#050b1c]/90 border border-cyan-500/30 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Waves className="w-5 h-5 text-cyan-400" />
                      <div>
                        <h3 className="font-orbitron font-bold text-sm text-white">
                          Colorful Voice Wave Visualizer (8 Styles) & Auto Follow-up
                        </h3>
                        <p className="text-xs text-slate-400">
                          Jarvis sirf wave aur &quot;Sun rahi hoon, bolein aap&quot; dikhati hai (bina seconds/send button ke).
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        update(
                          { followUpListeningEnabled: !config.followUpListeningEnabled },
                          !config.followUpListeningEnabled
                            ? "Auto follow-up ('Kuch aur kehna hai?') ON"
                            : "Auto follow-up OFF"
                        )
                      }
                      className={`min-h-[44px] px-3.5 py-2 rounded-xl border text-xs font-mono cursor-pointer whitespace-nowrap shrink-0 ${
                        config.followUpListeningEnabled
                          ? "bg-emerald-950/70 border-emerald-400 text-emerald-300"
                          : "bg-slate-900 border-slate-700 text-slate-400"
                      }`}
                    >
                      {config.followUpListeningEnabled
                        ? "Follow-up 'Kuch aur?': ON"
                        : "Follow-up 'Kuch aur?': OFF"}
                    </button>
                  </div>

                  {/* Live Wave Preview */}
                  <div className="p-3 rounded-xl bg-black/70 border border-slate-700/60">
                    <ColorfulWaveVisualizer
                      styleId={config.waveVisualizerStyle}
                      colorThemeId={config.waveColorTheme}
                      audioLevel={0.62}
                      phase="listening"
                      height={44}
                    />
                  </div>

                  {/* Color Themes */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-mono text-slate-300 mr-1">Wave Color Effect:</span>
                    {WAVE_COLOR_THEMES.map((wt) => {
                      const active = config.waveColorTheme === wt.id;
                      return (
                        <button
                          key={wt.id}
                          type="button"
                          onClick={() => update({ waveColorTheme: wt.id })}
                          className={`min-h-[40px] px-3 py-1.5 rounded-xl border text-xs font-mono flex items-center gap-2 cursor-pointer ${
                            active
                              ? "bg-slate-800 border-cyan-400 text-white"
                              : "bg-slate-950 border-slate-700 text-slate-300"
                          }`}
                        >
                          <span
                            className="w-5 h-2.5 rounded-sm shrink-0"
                            style={{
                              background: `linear-gradient(90deg, ${wt.colors[0]}, ${wt.colors[1]}, ${wt.colors[2]})`,
                            }}
                          />
                          <span>{wt.name}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* 8 Wave Presets */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {WAVE_VISUALIZER_PRESETS.map((wv) => {
                      const active = config.waveVisualizerStyle === wv.id;
                      return (
                        <button
                          key={wv.id}
                          type="button"
                          onClick={() => update({ waveVisualizerStyle: wv.id }, `Wave Style: ${wv.name}`)}
                          className={`min-h-[68px] p-3 rounded-xl border text-left cursor-pointer transition ${
                            active
                              ? "bg-cyan-950/50 border-cyan-400 text-white"
                              : "bg-slate-900/70 border-slate-500/25 text-slate-300"
                          }`}
                        >
                          <div className="text-xs font-bold flex items-center justify-between gap-1">
                            <span className="truncate">{wv.name}</span>
                            {active && <Check className="w-3.5 h-3.5 text-cyan-300 shrink-0" />}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-1 line-clamp-2">{wv.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 4. FINGERPRINT, FACE SCAN & CHARGING ANIMATIONS */}
            {tab === "bio_charge" && (
              <div className="space-y-6">
                {/* Custom Photo Upload for Fingerprint, Face & Charging */}
                <div className="p-4 rounded-2xl bg-[#050b1c]/90 border border-cyan-500/35 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={activeBioImage}
                      alt="Biometric & Charging Emblem"
                      className="w-14 h-14 rounded-full object-cover border-2 border-cyan-400/70 shrink-0"
                    />
                    <div>
                      <div className="text-sm font-orbitron font-bold text-white">
                        Custom Finger / Face / Charging Photo
                      </div>
                      <p className="text-xs text-slate-400">
                        Apni pasandida picture upload karein jo Fingerprint core, Face holographic scanner aur Charging animation ke andar dikhegi.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={Boolean(busyAction)}
                      onClick={() => bioImgInputRef.current?.click()}
                      className="min-h-[44px] px-4 py-2 rounded-xl font-orbitron font-bold text-xs text-black flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                      style={{ background: config.accentColorHex }}
                    >
                      <Upload className="w-4 h-4" />
                      <span>{busyAction === "bio_upload" ? "Saving..." : "Upload Picture"}</span>
                    </button>
                    {config.customBiometricImageDataUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          syncCustomMediaImageAndroid("bio", "").catch(() => {});
                          update({ customBiometricImageDataUrl: "" }, "Reset to default Cyber Portrait.");
                        }}
                        className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-900 border border-slate-600 text-xs font-mono text-slate-200 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        Reset Default
                      </button>
                    )}
                  </div>
                </div>

                {/* Fingerprint Unlock Animations */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-orbitron font-bold text-sm text-white">
                        Fingerprint Unlock Animations (8 Styles)
                      </h3>
                      <p className="text-xs text-slate-400">
                        Lockscreen ke kisi bhi wallpaper (apne phone ki photo ya Live Wallpaper) ke upar Fingerprint glow chalega.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        update(
                          { fingerprintOnAnyWallpaper: !(config.fingerprintOnAnyWallpaper !== false) },
                          config.fingerprintOnAnyWallpaper !== false
                            ? "Fingerprint on Any Lock Wallpaper: OFF"
                            : "Fingerprint on Any Lock Wallpaper: ON"
                        )
                      }
                      className={`min-h-[44px] px-3.5 py-2 rounded-xl border text-xs font-mono cursor-pointer whitespace-nowrap shrink-0 ${
                        config.fingerprintOnAnyWallpaper !== false
                          ? "bg-emerald-950/70 border-emerald-400 text-emerald-300"
                          : "bg-slate-900 border-slate-700 text-slate-400"
                      }`}
                    >
                      {config.fingerprintOnAnyWallpaper !== false
                        ? "Lockscreen Finger Overlay: ON"
                        : "Lockscreen Finger Overlay: OFF"}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {FINGERPRINT_ANIM_PRESETS.map((fp) => {
                      const active = config.fingerprintAnimId === fp.id;
                      return (
                        <button
                          key={fp.id}
                          type="button"
                          onClick={() => update({ fingerprintAnimId: fp.id }, `Fingerprint: ${fp.name}`)}
                          className={`p-3 rounded-2xl border flex flex-col items-center gap-2 cursor-pointer transition ${
                            active
                              ? "bg-slate-800/90 border-cyan-400"
                              : "bg-slate-900/70 border-slate-500/25"
                          }`}
                        >
                          <FingerprintAnimView
                            animId={fp.id}
                            active={active}
                            customImageUrl={activeBioImage}
                            size="sm"
                          />
                          <span className="text-[11px] font-medium text-center text-slate-200">{fp.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Face Scan Animations */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <ScanFace className="w-4 h-4 text-cyan-400" />
                    <h3 className="font-orbitron font-bold text-sm text-white">
                      Face Scan Animations (6 Biometric Reticles)
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {FACE_ANIM_PRESETS.map((fa) => {
                      const active = config.faceAnimId === fa.id;
                      return (
                        <button
                          key={fa.id}
                          type="button"
                          onClick={() => update({ faceAnimId: fa.id }, `Face Animation: ${fa.name}`)}
                          className={`min-h-[82px] p-3 rounded-2xl border text-left cursor-pointer transition flex items-center gap-3 ${
                            active
                              ? "bg-slate-800/90 border-cyan-400 text-white"
                              : "bg-slate-900/70 border-slate-500/25 text-slate-300"
                          }`}
                        >
                          <div
                            className="w-11 h-11 rounded-full border-2 flex items-center justify-center overflow-hidden shrink-0"
                            style={{ borderColor: fa.color }}
                          >
                            <img src={activeBioImage} alt={fa.name} className="w-full h-full object-cover opacity-90" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold truncate">{fa.name}</div>
                            <div className="text-[10px] text-slate-400 line-clamp-2">{fa.desc}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Charging Animations */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-orbitron font-bold text-sm text-white">
                      Charging Animations (8 Turbo Styles)
                    </h3>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          update({ chargingOverlayEnabled: !config.chargingOverlayEnabled })
                        }
                        className={`min-h-[44px] px-3 py-1.5 rounded-xl border text-xs font-mono cursor-pointer whitespace-nowrap shrink-0 ${
                          config.chargingOverlayEnabled
                            ? "bg-emerald-950/70 border-emerald-400 text-emerald-300"
                            : "bg-slate-900 border-slate-700 text-slate-400"
                        }`}
                      >
                        {config.chargingOverlayEnabled ? "Auto-Trigger: ON" : "Auto-Trigger: OFF"}
                      </button>
                      <button
                        type="button"
                        onClick={handleTestCharging}
                        className="min-h-[44px] px-3.5 py-1.5 rounded-xl bg-cyan-500 text-black font-orbitron font-bold text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Apply & Test Charging</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {CHARGING_ANIM_PRESETS.map((ch) => {
                      const active = config.chargingAnimId === ch.id;
                      return (
                        <button
                          key={ch.id}
                          type="button"
                          onClick={() => update({ chargingAnimId: ch.id }, `Charging Style: ${ch.name}`)}
                          className={`min-h-[72px] p-3 rounded-2xl border text-left cursor-pointer transition flex flex-col justify-between ${
                            active
                              ? "bg-slate-800/90 border-cyan-400"
                              : "bg-slate-900/70 border-slate-500/25"
                          }`}
                        >
                          <Zap className="w-4 h-4" style={{ color: ch.accent }} />
                          <span className="text-xs font-semibold text-white">{ch.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 5. HOME SCREEN LAYOUTS & APP ICON STYLES */}
            {tab === "home_icons" && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-orbitron font-bold text-base text-white">
                      Unlocked Home Screen & App Icon Styles
                    </h2>
                    <p className="text-xs text-slate-400">
                      Unlocked phone ke app icon shapes aur layout choose karein aur direct Apply & Open Launcher par click karein.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      syncFullToNative(config, alertsCfg);
                      onToast("Home Screen Layout & Icon Style Applied!");
                      onClose();
                      onOpenHomeMode();
                    }}
                    className="min-h-[44px] px-4 py-2 rounded-xl font-orbitron font-bold text-xs text-black cursor-pointer whitespace-nowrap shrink-0"
                    style={{ background: config.accentColorHex }}
                  >
                    Apply Home Style & Open
                  </button>
                </div>

                <div className="space-y-3">
                  <h3 className="font-orbitron font-bold text-sm text-white">App Icon Packs (8 Styles)</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {APP_ICON_STYLE_PRESETS.map((ic) => {
                      const active = config.appIconStyleId === ic.id;
                      return (
                        <button
                          key={ic.id}
                          type="button"
                          onClick={() => update({ appIconStyleId: ic.id }, `Icon Style Applied: ${ic.name}`)}
                          className={`p-3 rounded-2xl border flex flex-col items-center gap-2 cursor-pointer transition ${
                            active
                              ? "bg-cyan-950/45 border-cyan-400"
                              : "bg-slate-900/70 border-slate-500/25"
                          }`}
                        >
                          <div
                            className="w-11 h-11 flex items-center justify-center"
                            style={getIconShapeStyle(ic.id, config.accentColorHex, config.accentColorHex)}
                          >
                            <Sparkles className="w-5 h-5 text-white" />
                          </div>
                          <span className="text-[11px] font-semibold text-slate-200 text-center">{ic.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="font-orbitron font-bold text-sm text-white">Home Screen Grid Layouts (6 Styles)</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {HOME_LAYOUT_PRESETS.map((hl) => {
                      const active = config.homeLayoutId === hl.id;
                      return (
                        <button
                          key={hl.id}
                          type="button"
                          onClick={() => update({ homeLayoutId: hl.id }, `Home Layout Applied: ${hl.name}`)}
                          className={`min-h-[72px] p-3.5 rounded-2xl border text-left cursor-pointer ${
                            active
                              ? "bg-cyan-950/50 border-cyan-400"
                              : "bg-slate-900/70 border-slate-500/25"
                          }`}
                        >
                          <div className="text-xs font-bold text-white flex justify-between">
                            <span>{hl.name}</span>
                            {active && <Check className="w-4 h-4 text-cyan-300" />}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1">{hl.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 6. SWIPE-DOWN SHORTCUT SWITCHES, EDGE LIGHTING & AOD */}
            {tab === "switches_aod" && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-orbitron font-bold text-base text-white">
                      Swipe-Down Shortcut Switches (8 Designs)
                    </h2>
                    <p className="text-xs text-slate-400">
                      Screen ko neeche swipe karne par aane wale Wi-Fi, Data, Torch, GPS, Bluetooth switches ka design choose aur apply karein.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      syncFullToNative(config, alertsCfg);
                      onToast("Quick Panel Design Applied!");
                      onOpenQuickPanel();
                    }}
                    className="min-h-[44px] px-4 py-2 rounded-xl font-orbitron font-bold text-xs text-black cursor-pointer whitespace-nowrap shrink-0"
                    style={{ background: config.accentColorHex }}
                  >
                    Apply & Open Switches
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                  {QUICK_PANEL_STYLE_PRESETS.map((qp) => {
                    const active = config.quickPanelStyleId === qp.id;
                    return (
                      <button
                        key={qp.id}
                        type="button"
                        onClick={() => update({ quickPanelStyleId: qp.id }, `Quick Switches: ${qp.name}`)}
                        className={`min-h-[76px] p-3.5 rounded-2xl border text-left cursor-pointer ${
                          active
                            ? "bg-cyan-950/50 border-cyan-400"
                            : "bg-slate-900/70 border-slate-500/25"
                        }`}
                      >
                        <div className="text-xs font-bold text-white flex justify-between">
                          <span>{qp.name}</span>
                          {active && <Check className="w-4 h-4 text-cyan-300" />}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1">{qp.desc}</div>
                      </button>
                    );
                  })}
                </div>

                {/* Edge Lighting & AOD */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-500/25 space-y-2.5">
                    <h3 className="font-orbitron font-bold text-xs text-white uppercase">Edge Lighting Style</h3>
                    <div className="grid grid-cols-1 gap-2">
                      {EDGE_LIGHTING_PRESETS.map((el) => (
                        <button
                          key={el.id}
                          type="button"
                          onClick={() => update({ edgeLightingStyle: el.id }, `Edge Lighting: ${el.name}`)}
                          className={`min-h-[44px] px-3 rounded-xl border text-left text-xs flex justify-between items-center cursor-pointer ${
                            config.edgeLightingStyle === el.id
                              ? "bg-cyan-950/50 border-cyan-400 text-white"
                              : "bg-slate-950/60 border-slate-700 text-slate-300"
                          }`}
                        >
                          <span>{el.name}</span>
                          {config.edgeLightingStyle === el.id && <Check className="w-3.5 h-3.5 text-cyan-300" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-500/25 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h3 className="font-orbitron font-bold text-xs text-white uppercase">Always-On Display (AOD)</h3>
                      <button
                        type="button"
                        onClick={() => update({ aodEnabled: !config.aodEnabled })}
                        className={`min-h-[40px] px-3 py-1 rounded-lg text-[11px] font-mono border cursor-pointer ${
                          config.aodEnabled
                            ? "bg-emerald-950/70 border-emerald-400 text-emerald-300"
                            : "bg-slate-950 border-slate-700 text-slate-400"
                        }`}
                      >
                        {config.aodEnabled ? "ON" : "OFF"}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {AOD_STYLE_PRESETS.map((aod) => (
                        <button
                          key={aod.id}
                          type="button"
                          onClick={() => update({ aodStyle: aod.id }, `AOD Style: ${aod.name}`)}
                          className={`min-h-[44px] px-3 rounded-xl border text-left text-xs flex justify-between items-center cursor-pointer ${
                            config.aodStyle === aod.id
                              ? "bg-cyan-950/50 border-cyan-400 text-white"
                              : "bg-slate-950/60 border-slate-700 text-slate-300"
                          }`}
                        >
                          <span>{aod.name}</span>
                          {config.aodStyle === aod.id && <Check className="w-3.5 h-3.5 text-cyan-300" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 7. VIP CONTACTS, PER-APP RULES & REAL-TIME USER ACTIVITY */}
            {tab === "vip_activity" && (
              <div className="space-y-6">
                {/* Real-Time Posture / Activity Card */}
                <div className="p-4 rounded-2xl bg-[#050b1c]/90 border border-cyan-500/35 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center border shrink-0"
                        style={{ borderColor: curAct.color, background: `${curAct.color}18` }}
                      >
                        <Activity className="w-5 h-5" style={{ color: curAct.color }} />
                      </div>
                      <div>
                        <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                          Real-Time Sensor State
                        </div>
                        <div className="text-sm font-orbitron font-bold text-white">
                          {curAct.label}
                        </div>
                        <div className="text-xs text-slate-300">{curAct.desc}</div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          updateAlerts({ activityAwareMode: !alertsCfg.activityAwareMode })
                        }
                        className={`min-h-[44px] px-3.5 py-2 rounded-xl border text-xs font-mono cursor-pointer whitespace-nowrap ${
                          alertsCfg.activityAwareMode
                            ? "bg-emerald-950/70 border-emerald-400 text-emerald-300"
                            : "bg-slate-900 border-slate-700 text-slate-400"
                        }`}
                      >
                        {alertsCfg.activityAwareMode ? "Activity Shield: ON" : "Activity Shield: OFF"}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          updateAlerts({ autoCallVoiceControl: !alertsCfg.autoCallVoiceControl })
                        }
                        className={`min-h-[44px] px-3.5 py-2 rounded-xl border text-xs font-mono cursor-pointer whitespace-nowrap ${
                          alertsCfg.autoCallVoiceControl
                            ? "bg-cyan-950/70 border-cyan-400 text-cyan-200"
                            : "bg-slate-900 border-slate-700 text-slate-400"
                        }`}
                      >
                        {alertsCfg.autoCallVoiceControl ? "Voice Call Control: ON" : "Voice Call Control: OFF"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* VIP Contacts Manager */}
                <div className="p-4 rounded-2xl bg-[#050b1c]/90 border border-slate-500/30 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-orbitron font-bold text-sm text-white">
                        VIP Favorite Contacts (Bar-Bar Yaad Dilane Ke Liye)
                      </h3>
                      <p className="text-xs text-slate-400">
                        In contacts ka message ya call aane par Jarvis Dynamic Bar par aur bol kar jab tak aap dekh/sun na lein yaad dilata rahega.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await acknowledgeVipRemindersAndroid();
                        onToast("Tamam pending VIP reminders clear kar diye gaye!");
                      }}
                      className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-600 text-xs font-mono text-slate-100 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <CheckCheck className="w-4 h-4 text-emerald-400" />
                      <span>Acknowledge All</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto_auto] gap-2">
                    <input
                      type="text"
                      value={vipNameDraft}
                      onChange={(e) => setVipNameDraft(e.target.value)}
                      placeholder="Contact Name (e.g. Ammi, Ali)"
                      maxLength={50}
                      className="min-h-[44px] px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:border-cyan-400 focus:outline-none"
                    />
                    <input
                      type="text"
                      value={vipPhoneDraft}
                      onChange={(e) => setVipPhoneDraft(e.target.value)}
                      placeholder="Number / Handle (Optional)"
                      maxLength={40}
                      className="min-h-[44px] px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:border-cyan-400 focus:outline-none"
                    />
                    <select
                      value={vipPriorityDraft}
                      onChange={(e) => setVipPriorityDraft(e.target.value as "critical" | "high")}
                      className="min-h-[44px] px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                    >
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                    </select>
                    <select
                      value={vipRepeatDraft}
                      onChange={(e) => setVipRepeatDraft(Number(e.target.value))}
                      className="min-h-[44px] px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                    >
                      <option value={1}>Every 1m</option>
                      <option value={2}>Every 2m</option>
                      <option value={5}>Every 5m</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleAddVipContact}
                      className="min-h-[44px] px-4 rounded-xl font-orbitron font-bold text-xs text-black flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                      style={{ background: config.accentColorHex }}
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Add VIP</span>
                    </button>
                  </div>

                  {(!alertsCfg.vipContacts || alertsCfg.vipContacts.length === 0) ? (
                    <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-400">
                      Abhi koi VIP contact add nahi hai. Upar naam likh kar Add VIP par click karein.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {alertsCfg.vipContacts.map((v) => (
                        <div
                          key={v.id}
                          className="p-3 rounded-xl bg-slate-950/80 border border-slate-700/70 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">
                              {v.name} {v.phoneOrHandle ? `(${v.phoneOrHandle})` : ""}
                            </div>
                            <div className="text-[11px] font-mono text-cyan-300/80">
                              {v.priority.toUpperCase()} • Repeat every {v.repeatMinutes}m
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const next = alertsCfg.vipContacts.filter((item) => item.id !== v.id);
                              updateAlerts({ vipContacts: next }, `Removed ${v.name}`);
                            }}
                            aria-label={`Remove ${v.name}`}
                            className="min-w-[40px] min-h-[40px] rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-300 flex items-center justify-center cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Per-App Rules & Task Urgent Interval */}
                <div className="p-4 rounded-2xl bg-[#050b1c]/90 border border-slate-500/30 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-orbitron font-bold text-sm text-white">
                        Per-App Voice & Dynamic Bar Rules
                      </h3>
                      <p className="text-xs text-slate-400">
                        Chunein kis app ke notifications Jarvis bol kar bataye aur sleep mode mein allow hon.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-300">Task Urgent Repeat:</span>
                      {[2, 5, 10, 15].map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() =>
                            updateAlerts(
                              { taskUrgentRepeatMinutes: mins },
                              `Task repeat interval: ${mins} min`
                            )
                          }
                          className={`min-h-[40px] px-2.5 rounded-lg border text-xs font-mono cursor-pointer ${
                            alertsCfg.taskUrgentRepeatMinutes === mins
                              ? "bg-cyan-950/60 border-cyan-400 text-cyan-200"
                              : "bg-slate-950 border-slate-700 text-slate-300"
                          }`}
                        >
                          {mins}m
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {appRules.map((rule) => (
                      <div
                        key={rule.id}
                        className="p-3 rounded-xl bg-slate-950/80 border border-slate-700/70 space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-white truncate">{rule.appName}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const nextRules = appRules.map((r) =>
                                r.id === rule.id ? { ...r, enabled: !r.enabled } : r
                              );
                              updateAlerts({ appRules: nextRules });
                            }}
                            className={`min-h-[36px] px-2.5 rounded-lg border text-[11px] font-mono cursor-pointer ${
                              rule.enabled
                                ? "bg-emerald-950/70 border-emerald-400 text-emerald-300"
                                : "bg-slate-900 border-slate-700 text-slate-400"
                            }`}
                          >
                            {rule.enabled ? "Active" : "Muted"}
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const nextRules = appRules.map((r) =>
                                r.id === rule.id ? { ...r, speakAloud: !r.speakAloud } : r
                              );
                              updateAlerts({ appRules: nextRules });
                            }}
                            className={`min-h-[36px] px-2.5 rounded-lg border text-[11px] font-mono cursor-pointer ${
                              rule.speakAloud
                                ? "bg-cyan-950/60 border-cyan-400 text-cyan-200"
                                : "bg-slate-900 border-slate-700 text-slate-400"
                            }`}
                          >
                            {rule.speakAloud ? "Speak: ON" : "Speak: OFF"}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const nextRules = appRules.map((r) =>
                                r.id === rule.id
                                  ? { ...r, allowInSleepOrQuiet: !r.allowInSleepOrQuiet }
                                  : r
                              );
                              updateAlerts({ appRules: nextRules });
                            }}
                            className={`min-h-[36px] px-2.5 rounded-lg border text-[11px] font-mono cursor-pointer ${
                              rule.allowInSleepOrQuiet
                                ? "bg-amber-950/60 border-amber-400 text-amber-200"
                                : "bg-slate-900 border-slate-700 text-slate-400"
                            }`}
                          >
                            {rule.allowInSleepOrQuiet ? "Sleep Bypass: ON" : "Sleep Respect"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Thumb Bottom Navigation Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-20 bg-[#050b1c]/95 backdrop-blur-xl border-t border-slate-500/30 px-2 py-1.5 flex items-center gap-1 overflow-x-auto">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`min-w-[68px] min-h-[48px] flex-1 px-2 py-1 rounded-xl flex flex-col items-center justify-center gap-0.5 cursor-pointer transition ${
                active ? "bg-slate-800/90 text-white" : "text-slate-400"
              }`}
              style={active ? { borderBottom: `2px solid ${config.accentColorHex}` } : undefined}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[10px] font-medium whitespace-nowrap">{t.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
