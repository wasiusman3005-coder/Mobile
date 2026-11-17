import React, { useState, useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";
import { soundEffects } from "./services/soundEffects";
import { speechService } from "./services/speechService";
import { storageService, defaultAvatarConfig, defaultOneUiConfig } from "./services/storage";
import { QuantumBackground3D } from "./components/QuantumBackground3D";
import { SecurityGate } from "./components/SecurityGate";
import { QuantumLoadingScreen } from "./components/QuantumLoadingScreen";
import { UltraCockpitDashboard, CockpitSummaryItem, MainPanelFeedItem } from "./components/UltraCockpitDashboard";
import { HubPanelNotification } from "./components/DualCharacterHoloStage";
import { CockpitCorePhase, QUANTUM_SPECTRUMS } from "./components/CentralQuantumCoreHologram";
import { WormholeTransition } from "./components/WormholeTransition";
import { QuantumAppsMatrix, MatrixModuleId } from "./components/QuantumAppsMatrix";
import { QuantumSettingsModal } from "./components/QuantumSettingsModal";
import { VoiceJarvisModal } from "./components/VoiceJarvisModal";
import { HiJarvisWaveOverlay } from "./components/HiJarvisWaveOverlay";
import { AwayAutoPilot } from "./components/AwayAutoPilot";
import { MandatoryHealthLockdown } from "./components/MandatoryHealthLockdown";
import { IdentityVideoOverlay } from "./components/IdentityVideoOverlay";
import { LiveWallpaperCanvas } from "./components/LiveWallpaperCanvas";
import { OneUiDynamicBar } from "./components/OneUiDynamicBar";
import { OneUiQuickPanel } from "./components/OneUiQuickPanel";
import { ChargingAnimationOverlay } from "./components/ChargingAnimationOverlay";
import { OneUi9Studio } from "./components/OneUi9Studio";
import { readPhoneHardwareTelemetry, resolveApiUrl } from "./services/systemTelemetry";
import { togglePhoneFlashlight, triggerHaptic, playLocatorSiren } from "./services/mobileDeviceActions";
import { tryExecuteLocalPhoneCommand } from "./services/localApkCommands";
import {
  subscribeNativeEvents,
  isNativeAndroidApk,
  getNativePhoneNotifications,
  getNativeCallLogs,
  getNativeSmsMessages,
  getAndroidPermissionStatus,
  requestCorePermissionsAndroid,
  setNativeBackgroundWakeService,
  consumePendingWakeEventAndroid,
  subscribeNativeSpeechEvents,
  consumePendingStudioLaunchAndroid,
  subscribeStudioLaunchEvent,
  syncOneUiOverlayConfigAndroid,
  requestIgnoreBatteryOptimizationAndroid,
  getNativeBackgroundStatus,
  subscribeActivityAndVipEvents,
  getUserActivityStateAndroid,
  answerOrRejectCallAndroid,
} from "./services/nativeAndroidBridge";
import {
  LanguageCode,
  UserProfile,
  DashboardCustomization,
  AvatarStudioConfig,
  OneUiStudioConfig,
  ProactiveAlertConfig,
  UserActivityState,
  DynamicBarAnchor,
} from "./types";
import { QUANTUM_THEMES, QuantumThemeColor } from "./components/AutoMorphingQuantumLogo";
import {
  getCharacterDisplayName,
  PERSONALITY_MODES,
  isIdentityVideoCommand,
} from "./data/jarvisCatalog";
import { DEFAULT_APP_ALERT_RULES } from "./data/oneUi9Catalog";

const OfflineIndicator: React.FC = () => {
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);
  if (online) return null;
  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[120] px-3 py-1 rounded-full bg-amber-950/90 border border-amber-400/60 text-amber-200 text-[10px] font-mono shadow-lg">
      OFFLINE MOBILE MODE — LOCAL CORE ACTIVE
    </div>
  );
};

export default function App() {
  // Authentication & Security State: opens directly unlocked by default so background wake never locks out commands
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    if (typeof window !== "undefined") {
      const cust = storageService.getCustomization();
      if (!cust.oneUiConfig?.requireStartupLock) {
        return true;
      }
      return (
        sessionStorage.getItem("q_nexus_session_auth") === "active" &&
        localStorage.getItem("q_nexus_lock_v2") === "verified"
      );
    }
    return true;
  });
  const [isAwayMode, setIsAwayMode] = useState(false);

  // Mandatory Health Screen-Time Rest Lockdown
  const [screenWorkSeconds, setScreenWorkSeconds] = useState(0);
  const [isHealthLockdownActive, setIsHealthLockdownActive] = useState(false);

  // App Settings & Customization (scanlines disabled for crystal clear UHD view)
  const [userProfile, setUserProfile] = useState<UserProfile>(() => storageService.getUserProfile());
  const [customization, setCustomization] = useState<DashboardCustomization>(() => {
    const c = storageService.getCustomization();
    return { ...c, scanlines: false };
  });
  const [currentQuantumTheme, setCurrentQuantumTheme] = useState<QuantumThemeColor>(QUANTUM_THEMES[0]);
  const [language, setLanguage] = useState<LanguageCode>(userProfile.preferredLanguage || "ur");
  const [coherence, setCoherence] = useState(99.98);

  // Modal & Stage States
  const [showLoadingScreen, setShowLoadingScreen] = useState(false);
  const [projectedHubModule, setProjectedHubModule] = useState<MatrixModuleId | null>(null);
  const [activeHubNotification, setActiveHubNotification] = useState<HubPanelNotification | null>(null);
  const hubPresenterTurnRef = useRef<"female" | "male">("female");
  const hubNotifTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isAppsMatrixOpen, setIsAppsMatrixOpen] = useState(false);
  const [appsMatrixInitialModule, setAppsMatrixInitialModule] = useState<MatrixModuleId | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<
    "appearance" | "voice" | "security" | "alerts" | "screensaver" | "health" | "data"
  >("appearance");
  const [detailViewNonce, setDetailViewNonce] = useState(0);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [voiceAutoListenTrigger, setVoiceAutoListenTrigger] = useState(0);
  const [voiceInitialCommand, setVoiceInitialCommand] = useState<{ id: number; text: string } | null>(null);
  const [isWakeWaveOpen, setIsWakeWaveOpen] = useState(false);
  const [waveListenNonce, setWaveListenNonce] = useState(0);
  const [waveInitialCommand, setWaveInitialCommand] = useState<{ id: number; text: string } | null>(null);
  const [isIdentityVideoOpen, setIsIdentityVideoOpen] = useState(false);

  // One UI 9 Studio, Quick Panel, Home Grid & Charging States
  const [isOneUiStudioOpen, setIsOneUiStudioOpen] = useState(() => {
    if (typeof window !== "undefined") {
      return window.location.search.includes("tab=oneui9");
    }
    return false;
  });
  const [isQuickPanelOpen, setIsQuickPanelOpen] = useState(false);
  const [isHomeGridMode, setIsHomeGridMode] = useState(false);
  const [isChargingAnimOpen, setIsChargingAnimOpen] = useState(false);
  const [phoneBatteryPercent, setPhoneBatteryPercent] = useState<number | null>(null);
  const [isPhoneCharging, setIsPhoneCharging] = useState(false);
  const [batteryUnrestricted, setBatteryUnrestricted] = useState(true);
  const [activityState, setActivityState] = useState<UserActivityState>("sitting_stationary");
  const [unlockPulseNonce, setUnlockPulseNonce] = useState(0);
  const [unlockMethodLabel, setUnlockMethodLabel] = useState("Biometric");
  const [incomingCallLabel, setIncomingCallLabel] = useState<string | null>(null);
  const lastChargingRef = useRef<boolean | null>(null);
  const chargingAutoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const incomingCallClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTaskUrgentRemindAtRef = useRef<number>(0);

  // Wasu's Jarvis 3D Core Animation & HUD State
  const [wormholeState, setWormholeState] = useState<{ active: boolean; label: string }>({
    active: false,
    label: "Crossing Quantum Singularity...",
  });
  const [topologyIndex, setTopologyIndex] = useState(0);
  const [autoCycleTopology, setAutoCycleTopology] = useState(true);
  const [spectrumIndex, setSpectrumIndex] = useState(0);
  const [energySurge, setEnergySurge] = useState(false);
  const [hudHidden, setHudHidden] = useState(false);

  const triggerWormhole = (label: string, onMidpoint?: () => void) => {
    soundEffects.playSubBassPulse();
    setWormholeState({ active: true, label });
    if (onMidpoint) {
      setTimeout(onMidpoint, 480);
    }
    setTimeout(() => {
      setWormholeState((prev) => ({ ...prev, active: false }));
    }, 1050);
  };

  // Live Speech & Main Cockpit 4-Phase State
  const [isJarvisSpeaking, setIsJarvisSpeaking] = useState(false);
  const [isJarvisListening, setIsJarvisListening] = useState(false);
  const [isProcessingCockpit, setIsProcessingCockpit] = useState(false);
  const [cockpitAudioLevel, setCockpitAudioLevel] = useState(0);
  const [cockpitLiveTranscript, setCockpitLiveTranscript] = useState("");
  const [cockpitLiveReply, setCockpitLiveReply] = useState("");
  const [cockpitSummaries, setCockpitSummaries] = useState<CockpitSummaryItem[]>(() =>
    storageService.getSummaryLogs()
  );
  const [mainPanelItems, setMainPanelItems] = useState<MainPanelFeedItem[]>([]);
  const [needsWhatsAppAccess, setNeedsWhatsAppAccess] = useState(false);
  const followUpAwaitRef = useRef(false);
  const manualCancelRef = useRef(false);
  const activityStateRef = useRef<UserActivityState>("sitting_stationary");
  activityStateRef.current = activityState;
  const seenNotifKeysRef = useRef<Set<string>>(
    (() => {
      try {
        const raw = localStorage.getItem("wasu_jarvis_seen_notifs");
        const arr = raw ? JSON.parse(raw) : [];
        return new Set<string>(Array.isArray(arr) ? arr : []);
      } catch {
        return new Set<string>();
      }
    })()
  );
  const [isWakeWordActive, setIsWakeWordActive] = useState(true);
  const [wakeReady, setWakeReady] = useState(false);
  const [wakeStatusText, setWakeStatusText] = useState("Tap to enable 'Hi Jarvis'");
  const [lastHeardWakeText, setLastHeardWakeText] = useState("");
  const heardClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioLevelRef = useRef(0);
  audioLevelRef.current = cockpitAudioLevel;

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const avatarConfig: AvatarStudioConfig = customization.avatarConfig || defaultAvatarConfig;
  const oneUiConfig: OneUiStudioConfig = customization.oneUiConfig || defaultOneUiConfig;
  const activeCharName = getCharacterDisplayName(avatarConfig);
  const languageRef = useRef(language);
  languageRef.current = language;
  const activeCharNameRef = useRef(activeCharName);
  activeCharNameRef.current = activeCharName;
  const voiceCharRef = useRef<"male" | "female">(
    customization.avatarConfig?.characterGender === "male" ? "male" : "female"
  );
  voiceCharRef.current = customization.avatarConfig?.characterGender === "male" ? "male" : "female";
  const avatarConfigRef = useRef(avatarConfig);
  avatarConfigRef.current = avatarConfig;
  const oneUiConfigRef = useRef(oneUiConfig);
  oneUiConfigRef.current = oneUiConfig;
  const userProfileRef = useRef(userProfile);
  userProfileRef.current = userProfile;
  const proactiveAlertsRef = useRef(customization.proactiveAlerts);
  proactiveAlertsRef.current = customization.proactiveAlerts;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const appendCockpitSummary = (role: "user" | "assistant" | "reminder", speaker: string, text: string) => {
    const cleaned = text.trim();
    if (!cleaned) return;
    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setCockpitSummaries((prev) => {
      const next: CockpitSummaryItem[] = [
        ...prev.slice(-79),
        { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, role, speaker, text: cleaned, timeStr },
      ];
      storageService.saveSummaryLogs(next);
      return next;
    });
  };

  const markNativeNotifSeen = (nativeKey?: string) => {
    if (!nativeKey) return;
    seenNotifKeysRef.current.add(nativeKey);
    try {
      const recentKeys = Array.from(seenNotifKeysRef.current).slice(-120);
      localStorage.setItem("wasu_jarvis_seen_notifs", JSON.stringify(recentKeys));
    } catch {}
  };

  const pushMainPanelItem = (item: Omit<MainPanelFeedItem, "id" | "timeStr">): string => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const entry: MainPanelFeedItem = { ...item, id, timeStr };
    setMainPanelItems((prev) => {
      if (item.nativeKey && prev.some((p) => p.nativeKey === item.nativeKey && p.text === item.text)) {
        return prev;
      }
      return [entry, ...prev].slice(0, 12);
    });
    return id;
  };

  const archiveMainPanelItems = (ids?: string[]) => {
    setMainPanelItems((prev) => {
      if (prev.length === 0) return prev;
      const toArchive = ids ? prev.filter((p) => ids.includes(p.id)) : prev;
      if (toArchive.length === 0) return prev;
      toArchive.forEach((item) => {
        markNativeNotifSeen(item.nativeKey);
        appendCockpitSummary(item.speakerRole, item.source, item.title && item.kind === "notification" ? `${item.title}: ${item.text}` : item.text);
      });
      return ids ? prev.filter((p) => !ids.includes(p.id)) : [];
    });
  };

  const projectHubAlert = (title: string, text: string, source = "SYSTEM HUB", nativeKey?: string) => {
    const nextPresenter = hubPresenterTurnRef.current;
    hubPresenterTurnRef.current = nextPresenter === "female" ? "male" : "female";
    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    pushMainPanelItem({
      kind: "notification",
      source,
      title,
      text,
      speakerRole: "reminder",
      nativeKey,
    });
    setActiveHubNotification({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      title,
      text,
      source,
      presenterGender: nextPresenter,
      timeStr,
    });
    if (hubNotifTimerRef.current) clearTimeout(hubNotifTimerRef.current);
    hubNotifTimerRef.current = setTimeout(() => {
      setActiveHubNotification(null);
    }, 9000);
  };

  const handleUpdateAvatarConfig = (nextAvatar: AvatarStudioConfig) => {
    const updated: DashboardCustomization = {
      ...customization,
      avatarConfig: nextAvatar,
    };
    setCustomization(updated);
    storageService.saveCustomization(updated);
  };

  const handleRenameAssistant = (newName: string) => {
    const cleaned = newName.trim();
    if (!cleaned) return;
    const currentGender = avatarConfig.characterGender === "male" ? "male" : "female";
    handleRenameGenderName(currentGender, cleaned);
    showToast(`Name updated: ${cleaned}`);
  };

  const handleRenameGenderName = (gender: "male" | "female", newName: string) => {
    const activeCharId = avatarConfig.activeCharacterId || "wasi_ki_jan";
    handleUpdateAvatarConfig({
      ...avatarConfig,
      ...(gender === "male"
        ? { customMaleName: newName }
        : {
            customFemaleName: newName,
            customNicknames: {
              ...(avatarConfig.customNicknames || {}),
              [activeCharId]: newName,
            },
          }),
    });
  };

  // Sync dynamic wake words, custom voice profiles & schedules with SpeechService
  useEffect(() => {
    speechService.setVoiceCustomization(customization);
    const femaleLower = getCharacterDisplayName(avatarConfig, "female").toLowerCase();
    const maleLower = getCharacterDisplayName(avatarConfig, "male").toLowerCase();
    const nickNames = Object.values(avatarConfig.customNicknames || {})
      .map((n) => (n || "").trim().toLowerCase())
      .filter((n) => n.length >= 2);
    const allNames = Array.from(new Set([femaleLower, maleLower, "jarvis", "wasu", "wasi ki jan", ...nickNames]));

    const dynamicWake = allNames.flatMap((nm) => [
      `hi ${nm}`,
      `hey ${nm}`,
      `hello ${nm}`,
      `suno ${nm}`,
      `ok ${nm}`,
    ]);
    speechService.setWakeWords(
      [...dynamicWake, `wake up ${femaleLower}`, ...(avatarConfig.customWakeWords || [])],
      allNames
    );
  }, [customization, avatarConfig]);

  // Process Spoken Cockpit Command (Updates Processing 3D Logo -> Speaking 3D Logo -> Live Summary)
  const triggerFollowUpPrompt = (
    langCode: LanguageCode,
    spkGender: "male" | "female",
    spkPitch: number,
    spkRate: number,
    fast: boolean
  ) => {
    if (
      !oneUiConfigRef.current.followUpListeningEnabled ||
      manualCancelRef.current ||
      isIdentityVideoOpen ||
      isVoiceModalOpen ||
      isWakeWaveOpen ||
      isOneUiStudioOpen
    ) {
      followUpAwaitRef.current = false;
      return;
    }
    followUpAwaitRef.current = true;
    const promptMsg = langCode === "en" ? "Anything else?" : "Kuch aur kehna hai?";
    setTimeout(() => {
      if (manualCancelRef.current || speechService.getListeningState()) return;
      speechService.speak(promptMsg, {
        lang: langCode,
        gender: spkGender,
        pitch: spkPitch,
        rate: fast ? Math.max(spkRate, 1.06) : spkRate,
        fast,
        onEnd: () => {
          if (!manualCancelRef.current && followUpAwaitRef.current) {
            setCockpitLiveTranscript("");
            speechService.startListening(langCode);
          }
        },
      });
    }, 320);
  };

  const processCockpitCommandRef = useRef<(rawText: string) => Promise<void>>(async () => {});
  const processCockpitCommand = async (rawText: string) => {
    const text = rawText.trim();
    if (!text) return;
    manualCancelRef.current = false;

    const charGender = voiceCharRef.current;
    const charName = activeCharNameRef.current;
    const lang = languageRef.current;
    const cfg = avatarConfigRef.current;
    const activePersona =
      PERSONALITY_MODES.find((p) => p.id === cfg?.personalityId) ||
      PERSONALITY_MODES.find((p) => p.voiceGender === charGender) ||
      PERSONALITY_MODES[0];

    const userPanelId = pushMainPanelItem({
      kind: "chat",
      source: "You",
      title: "Voice Command",
      text,
      speakerRole: "user",
    });
    setCockpitLiveTranscript("");
    setIsProcessingCockpit(true);

    const speakCockpitReply = (
      reply: string,
      langOverride?: LanguageCode,
      voiceOverride?: {
        pitch?: number;
        rate?: number;
        gender?: "male" | "female";
        speakerName?: string;
        useElevenLabs?: boolean;
        urduSpeechText?: string;
        skipFollowUp?: boolean;
      }
    ) => {
      const spkGender = voiceOverride?.gender || charGender;
      const spkPitch = voiceOverride?.pitch ?? activePersona.pitch;
      const spkRate = voiceOverride?.rate ?? activePersona.rate;
      const spkName = voiceOverride?.speakerName || charName;
      const effectiveLang = langOverride || lang;
      setCockpitLiveReply(reply);
      const replyPanelId = pushMainPanelItem({
        kind: "chat",
        source: spkName,
        title: "Reply",
        text: reply,
        speakerRole: "assistant",
      });
      const fast = cfg?.fastTalkingMode ?? true;
      speechService.speak(reply, {
        lang: effectiveLang,
        gender: spkGender,
        pitch: spkPitch,
        rate: fast ? Math.max(spkRate, 1.04) : spkRate,
        fast,
        useElevenLabs: voiceOverride?.useElevenLabs ?? cfg?.useElevenLabs,
        elevenLabsVoiceId: cfg?.elevenLabsVoiceId,
        urduSpeechText: voiceOverride?.urduSpeechText,
        onEnd: () => {
          setCockpitLiveReply("");
          setTimeout(() => {
            archiveMainPanelItems([userPanelId, replyPanelId]);
          }, 4500);
          if (!voiceOverride?.skipFollowUp) {
            triggerFollowUpPrompt(effectiveLang, spkGender, spkPitch, spkRate, fast);
          }
        },
      });
    };

    try {
      const lower = text.toLowerCase();
      if (
        followUpAwaitRef.current &&
        /^(nahi|nah|no|nothing|kuch nahi|bas|shukriya|thanks|thank you|theek hai|thik hai|ok thanks|choro)$/i.test(
          lower.replace(/[.!?]+$/g, "").trim()
        )
      ) {
        followUpAwaitRef.current = false;
        soundEffects.playBeepConfirm();
        speakCockpitReply(
          lang === "en"
            ? "Alright, say Jarvis whenever you need me."
            : "Theek hai, jab chahein Jarvis bolein, main hazir hoon.",
          lang,
          { skipFollowUp: true }
        );
        return;
      }
      followUpAwaitRef.current = false;

      if (isIdentityVideoCommand(text)) {
        const reply =
          lang === "pa"
            ? `Ji Wasi paji! Dekho, main ${charName} tuhade saamne hazir haan.`
            : lang === "en"
            ? `Presenting Wasu and Wasi ki Jan live on screen, Commander Wasi.`
            : `Ji Wasi Sahab! Dekhein, main ${charName} aapke saamne hazir hoon.`;
        soundEffects.playBeepConfirm();
        speechService.cancelSpeech();
        appendCockpitSummary("assistant", charName, reply);
        handleExecuteVoiceAction("SHOW_IDENTITY_VIDEO");
        return;
      }

      const readLifeRecords = (): Array<{ title: string; content: string; category: string }> => {
        try {
          const raw = localStorage.getItem("q_nexus_life_records");
          const parsed = raw ? JSON.parse(raw) : [];
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      };

      if (lower.includes("task") || lower.includes("kaam") || lower.includes("todo") || lower.includes("reminder") || lower.includes("routine")) {
        const tasks = storageService.getTasks();
        const lifeRecords = readLifeRecords();
        const pending = tasks.filter((t) => !t.completed);
        let msg = "";
        if (tasks.length === 0 && lifeRecords.length === 0) {
          msg =
            lang === "en"
              ? "You haven't added any tasks or life records yet. Add them in the Tasks tab whenever you are ready."
              : "Abhi aapne koi task ya life routine add nahi kiya hai. Tasks tab mein add karein to main aapko waqt par yaad dilaungi.";
        } else if (pending.length > 0) {
          msg =
            lang === "en"
              ? `You have ${pending.length} pending tasks. Next: ${pending[0].title}.`
              : `Aapke ${pending.length} pending tasks hain. Agla kaam: ${pending[0].title}.`;
        } else if (lifeRecords.length > 0) {
          msg =
            lang === "en"
              ? `All ${tasks.length} added tasks are done. Your saved routine: ${lifeRecords[0].title}.`
              : `Aapke added tasks mukammal hain. Aapka saved record: ${lifeRecords[0].title}.`;
        } else {
          msg =
            lang === "en"
              ? `All ${tasks.length} of your added tasks are complete.`
              : "Aapke add kiye hue saare tasks mukammal ho chuke hain.";
        }
        soundEffects.playBeepConfirm();
        speakCockpitReply(msg);
        return;
      }

      if (lower.includes("health") || lower.includes("sehat") || lower.includes("pani") || lower.includes("water")) {
        const health = storageService.getHealth();
        const isCompletelyEmpty =
          health.waterDrankGlasses === 0 &&
          health.mealsLogged.length === 0 &&
          health.sleepHoursLastNight === 0 &&
          health.dailySteps === 0;
        const msg = isCompletelyEmpty
          ? lang === "en"
            ? "No health data logged yet. Log your water, sleep, or meals in Health Hub first."
            : "Abhi aapne Health Hub mein koi pani, neend ya meal log nahi kiya hai. Jab log karenge tab main reminder doongi."
          : lang === "en"
          ? `Your logged health data: ${health.waterDrankGlasses} glasses water, ${health.mealsLogged.length} meals, ${health.sleepHoursLastNight}h sleep.`
          : `Aapka logged health record: ${health.waterDrankGlasses} glass pani, ${health.mealsLogged.length} meals aur ${health.sleepHoursLastNight} ghante neend.`;
        soundEffects.playBeepConfirm();
        speakCockpitReply(msg);
        return;
      }

      // 0A. Direct Phone Commands: Open Any Installed App, Call Contact/Number, WhatsApp Message/Reply, SMS
      const localCmd = await tryExecuteLocalPhoneCommand(text);
      if (localCmd.handled) {
        soundEffects.playBeepConfirm();
        speakCockpitReply(localCmd.reply || "Hukum poora kar diya gaya hai.");
        if (localCmd.triggerAction) {
          handleExecuteVoiceAction(localCmd.triggerAction, localCmd.triggerPayload);
        }
        return;
      }

      if (lower.includes("notification") || lower.includes("whatsapp") || lower.includes("msg") || lower.includes("call")) {
        if (!isNativeAndroidApk()) {
          const msg = "Calls aur WhatsApp alerts hub separate Phone Alerts interface mein tayar hai.";
          soundEffects.playBeepConfirm();
          speakCockpitReply(msg);
          return;
        }
        const [notifRes, callRes, smsRes] = await Promise.all([
          getNativePhoneNotifications(),
          getNativeCallLogs(),
          getNativeSmsMessages(),
        ]);
        const msg =
          notifRes.notifications.length > 0
            ? `${notifRes.notifications.length} notifications: ${notifRes.notifications.slice(0, 2).map((n) => `${n.appName} ${n.title}: ${n.text}`).join(". ")}`
            : callRes.length > 0
            ? `Recent calls: ${callRes.slice(0, 2).map((c) => `${c.type} ${c.name || c.number}`).join(", ")}`
            : smsRes.length > 0
            ? `Latest SMS ${smsRes[0].address}: ${smsRes[0].body}`
            : "Is waqt koi naya notification ya call nahi hai.";
        soundEffects.playBeepConfirm();
        speakCockpitReply(msg);
        return;
      }

      if (lower.includes("torch") || lower.includes("flashlight") || lower.includes("flash light")) {
        const turnOn = !(lower.includes("off") || lower.includes("band") || lower.includes("bujha"));
        const res = await togglePhoneFlashlight(turnOn);
        soundEffects.playBeepConfirm();
        speakCockpitReply(res.message);
        return;
      }

      if (lower.includes("find phone") || lower.includes("find my phone") || lower.includes("phone bajao") || lower.includes("ring phone") || lower.includes("siren")) {
        playLocatorSiren(2600);
        const msg =
          lang === "en"
            ? "Find My Phone locator siren and vibration activated!"
            : "Phone locator siren aur vibration active kar di gayi hai!";
        speakCockpitReply(msg);
        return;
      }

      if (lower.includes("vibrate") || lower.includes("haptic")) {
        triggerHaptic([120, 60, 120, 60, 160]);
        const msg =
          lang === "en"
            ? "Phone vibration pulse triggered."
            : "Phone haptic vibration pulse bhej diya gaya hai.";
        soundEffects.playBeepConfirm();
        speakCockpitReply(msg);
        return;
      }

      if (lower.includes("phone info") || lower.includes("battery") || lower.includes("hardware")) {
        const tel = await readPhoneHardwareTelemetry();
        const msg = `${tel.deviceName}, CPU ${tel.cpuThreads} cores, Battery ${tel.batteryPercent !== null ? `${tel.batteryPercent}%` : "N/A"}, Network ${tel.networkType}.`;
        soundEffects.playBeepConfirm();
        speakCockpitReply(msg);
        return;
      }

      if (lower.includes("open study") || lower.includes("study hub") || lower.includes("simulation hub") || lower.includes("meri study")) {
        const msg =
          lang === "en"
            ? "Opening your Study, Files, Labs & Simulation Hub on the main Tech Hub screen."
            : "Aapka Study, Word, Excel, PowerPoint, PDF aur Live Simulation Hub screen par khol diya hai.";
        soundEffects.playBeepConfirm();
        setProjectedHubModule("study");
        speakCockpitReply(msg);
        return;
      }

      if (lower.includes("open business") || lower.includes("business hub") || lower.includes("karobar")) {
        const msg =
          lang === "en"
            ? "Opening your Business Command & Growth Advisor panel right now."
            : "Aapka Business Command aur Growth Advisor panel screen par khol diya hai.";
        soundEffects.playBeepConfirm();
        setProjectedHubModule("business");
        speakCockpitReply(msg);
        return;
      }

      if (lower.includes("fazool kharchi") || lower.includes("open expense") || lower.includes("open finance") || lower.includes("kharchay") || lower.includes("budget kholo")) {
        const msg =
          lang === "en"
            ? "Projecting your Daily, Monthly & Yearly Expenses Defense Shield on screen."
            : "Aapka Daily, Monthly aur Yearly Kharcha Defense panel hub screen par open kar diya hai.";
        soundEffects.playBeepConfirm();
        setProjectedHubModule("finance");
        speakCockpitReply(msg);
        return;
      }

      if (
        lower.includes("sara kuch") ||
        lower.includes("sab kuch") ||
        lower.includes("sub kuch") ||
        lower.includes("poori detail") ||
        lower.includes("full detail") ||
        lower.includes("briefing") ||
        lower.includes("brief me")
      ) {
        soundEffects.playBeepConfirm();
        await speakProactiveBriefing("full");
        return;
      }

      const userTasks = storageService.getTasks();
      const userHealth = storageService.getHealth();
      const userExpenses = storageService.getExpenses();
      const userLifeRecords = readLifeRecords();
      const phoneTelemetry = await readPhoneHardwareTelemetry().catch(() => null);

      const res = await fetch(resolveApiUrl("/api/jarvis/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          language: lang,
          userProfile: userProfileRef.current,
          characterGender: charGender,
          personalityName: charName,
          personalityPrompt: activePersona.systemPromptModifier,
          fastMode: cfg?.fastTalkingMode ?? true,
          currentContext: {
            time: new Date().toISOString(),
            platform: "Main Cockpit",
            userTasks,
            userLifeRecords,
            userHealth,
            userExpenses,
            phoneTelemetry,
          },
        }),
      });
      const data = await res.json();
      const reply = (data.reply || `Ji, main ${charName} sun rahi hoon.`).trim();
      soundEffects.playBeepConfirm();
      if (data.action === "SHOW_IDENTITY_VIDEO") {
        speechService.cancelSpeech();
        appendCockpitSummary("assistant", charName, reply);
        handleExecuteVoiceAction("SHOW_IDENTITY_VIDEO", data.actionPayload);
      } else {
        speakCockpitReply(reply, data.languageDetected || lang, {
          urduSpeechText: data.urduSpeechText,
        });
        if (data.action && data.action !== "NONE") {
          handleExecuteVoiceAction(data.action, data.actionPayload);
        }
      }
    } catch {
      const errReply = isNativeAndroidApk()
        ? "Offline mode mein hoon — aap 'Call Ali', 'Open WhatsApp', 'Time kya hai' ya 'Phone status' bol sakte hain."
        : "Command process nahi ho saki — dobara bolein.";
      speakCockpitReply(errReply);
    } finally {
      setIsProcessingCockpit(false);
    }
  };
  processCockpitCommandRef.current = processCockpitCommand;

  // Bind Main Cockpit voice command callbacks whenever full modals are closed
  useEffect(() => {
    if (!isAuthenticated || isVoiceModalOpen || isWakeWaveOpen) return;

    const unsubLevel = speechService.subscribeAudioLevel(setCockpitAudioLevel);

    speechService.setCommandCallbacks({
      onStart: () => {
        setCockpitLiveTranscript("");
        setIsJarvisListening(true);
      },
      onResult: (transcript, isFinal) => {
        setCockpitLiveTranscript(transcript);
        if (isFinal && transcript.trim()) {
          processCockpitCommandRef.current(transcript.trim());
        }
      },
      onAudioCaptured: async (audioBase64, mimeType) => {
        setIsJarvisListening(false);
        setIsProcessingCockpit(true);
        try {
          const charGender = voiceCharRef.current;
          const charName = activeCharNameRef.current;
          const lang = languageRef.current;
          const cfg = avatarConfigRef.current;
          const activePersona =
            PERSONALITY_MODES.find((p) => p.id === cfg?.personalityId) ||
            PERSONALITY_MODES.find((p) => p.voiceGender === charGender) ||
            PERSONALITY_MODES[0];

          const res = await fetch(resolveApiUrl("/api/jarvis/voice-audio"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              audioBase64,
              mimeType,
              language: lang,
              characterGender: charGender,
              personalityName: charName,
              personalityPrompt: activePersona.systemPromptModifier,
              userProfile: userProfileRef.current,
              fastMode: cfg?.fastTalkingMode ?? true,
            }),
          });
          if (!res.ok) {
            appendCockpitSummary("reminder", charName, "Voice decode failed — dobara koshish karein.");
            return;
          }
          const data = await res.json();
          if (data.silentAudio) {
            appendCockpitSummary("reminder", charName, data.reply || "Awaaz clear nahi aayi, dobara bolein.");
            return;
          }
          const heard = (data.transcript || "").trim();
          const fastAudioMode = cfg?.fastTalkingMode ?? true;
          const heardId = heard
            ? pushMainPanelItem({ kind: "chat", source: "You", title: "Voice Command", text: heard, speakerRole: "user" })
            : "";
          if (heard) {
            if (
              followUpAwaitRef.current &&
              /^(nahi|nah|no|nothing|kuch nahi|bas|shukriya|thanks|thank you|theek hai|thik hai|ok thanks|choro)$/i.test(
                heard.toLowerCase().replace(/[.!?]+$/g, "").trim()
              )
            ) {
              followUpAwaitRef.current = false;
              const byeMsg =
                lang === "en"
                  ? "Alright, say Jarvis whenever you need me."
                  : "Theek hai, jab chahein Jarvis bolein, main hazir hoon.";
              speechService.speak(byeMsg, {
                lang,
                gender: charGender,
                pitch: activePersona.pitch,
                rate: activePersona.rate,
              });
              return;
            }
            followUpAwaitRef.current = false;
            const localFromAudio = await tryExecuteLocalPhoneCommand(heard);
            if (localFromAudio.handled) {
              const localMsg = localFromAudio.reply || "Hukum poora kar diya gaya hai.";
              const replyId = pushMainPanelItem({
                kind: "chat",
                source: charName,
                title: "Reply",
                text: localMsg,
                speakerRole: "assistant",
              });
              soundEffects.playBeepConfirm();
              setCockpitLiveReply(localMsg);
              speechService.speak(localMsg, {
                lang,
                gender: charGender,
                pitch: activePersona.pitch,
                rate: activePersona.rate,
                onEnd: () => {
                  setCockpitLiveReply("");
                  setTimeout(() => archiveMainPanelItems([heardId, replyId].filter(Boolean)), 4500);
                  triggerFollowUpPrompt(lang, charGender, activePersona.pitch, activePersona.rate, fastAudioMode);
                },
              });
              if (localFromAudio.triggerAction) {
                handleExecuteVoiceAction(localFromAudio.triggerAction, localFromAudio.triggerPayload);
              }
              return;
            }
          }
          const msg = (data.reply || `Ji, main ${charName} hazir hoon.`).trim();
          soundEffects.playBeepConfirm();
          if (data.action === "SHOW_IDENTITY_VIDEO") {
            speechService.cancelSpeech();
            if (heardId) archiveMainPanelItems([heardId]);
            appendCockpitSummary("assistant", charName, msg);
            handleExecuteVoiceAction("SHOW_IDENTITY_VIDEO", data.actionPayload);
          } else {
            const replyId = pushMainPanelItem({
              kind: "chat",
              source: charName,
              title: "Reply",
              text: msg,
              speakerRole: "assistant",
            });
            const detectedLang = (data.languageDetected || lang) as LanguageCode;
            setCockpitLiveReply(msg);
            speechService.speak(msg, {
              lang: detectedLang,
              gender: charGender,
              pitch: activePersona.pitch,
              rate: activePersona.rate,
              urduSpeechText: data.urduSpeechText,
              onEnd: () => {
                setCockpitLiveReply("");
                setTimeout(() => {
                  archiveMainPanelItems([heardId, replyId].filter(Boolean));
                }, 4500);
                triggerFollowUpPrompt(detectedLang, charGender, activePersona.pitch, activePersona.rate, fastAudioMode);
              },
            });
            if (data.action && data.action !== "NONE") {
              handleExecuteVoiceAction(data.action, data.actionPayload);
            }
          }
        } catch {
          appendCockpitSummary("reminder", activeCharNameRef.current, "Voice decode failed — dobara koshish karein.");
        } finally {
          setIsProcessingCockpit(false);
        }
      },
      onError: (err) => {
        setIsJarvisListening(false);
        setIsProcessingCockpit(false);
        if (err) {
          appendCockpitSummary("reminder", activeCharNameRef.current, err);
          showToast(err);
        }
      },
      onEnd: () => {
        setIsJarvisListening(false);
      },
    });

    return () => {
      unsubLevel();
    };
  }, [isAuthenticated, isVoiceModalOpen, isWakeWaveOpen]);

  // Setup Strict "Hi Jarvis" Wake-Only Engine & Reactive Speech Subscriptions (Only active after authentication)
  useEffect(() => {
    if (!isAuthenticated) {
      speechService.enableWakeWord(false);
      setWakeReady(false);
      return;
    }

    const unsubSpeaking = speechService.subscribeSpeaking((speaking) => {
      setIsJarvisSpeaking(speaking);
      if (!speaking) {
        setCockpitLiveReply("");
      }
    });
    const unsubListening = speechService.subscribeListening(setIsJarvisListening);

    speechService.setWakeCallbacks({
      onWakeStatusChange: (active, statusText) => {
        setWakeReady(active);
        if (statusText) setWakeStatusText(statusText);
        else
          setWakeStatusText(
            active
              ? `LISTENING — Say 'Hi Jarvis' or 'Hi ${activeCharNameRef.current}'`
              : "Tap here to enable 'Hi Jarvis' Mic"
          );
      },
      onWakeHeard: (heard) => {
        setLastHeardWakeText(heard);
        if (heardClearTimerRef.current) clearTimeout(heardClearTimerRef.current);
        heardClearTimerRef.current = setTimeout(() => setLastHeardWakeText(""), 2500);
      },
      onWakeWordDetected: (_matchedPhrase, trailingCommand) => {
        soundEffects.playBeepConfirm();
        setIsAuthenticated(true);
        setIsVoiceModalOpen(false);
        setIsWakeWaveOpen(false);

        if (trailingCommand && trailingCommand.trim().length >= 3) {
          processCockpitCommandRef.current(trailingCommand.trim());
        } else {
          setCockpitLiveTranscript("");
          speechService.startListening(languageRef.current);
        }
      },
    });

    speechService.enableWakeWord(isWakeWordActive);

    const unsubNative = subscribeNativeEvents(
      (nativePhrase, trailingCommand) => {
        setIsAuthenticated(true);
        setIsVoiceModalOpen(false);
        setIsWakeWaveOpen(false);
        soundEffects.playBeepConfirm();
        if (trailingCommand && trailingCommand.trim().length >= 3) {
          processCockpitCommandRef.current(trailingCommand.trim());
        } else {
          setCockpitLiveTranscript("");
          speechService.startListening(languageRef.current);
        }
        showToast(`Wake Active: '${nativePhrase}'`);
      },
      (notif) => {
        const alertsCfg = proactiveAlertsRef.current;
        if (alertsCfg && !alertsCfg.incomingNotifications) return;
        const notifUniqueKey = `${notif.key}:${notif.text}`;
        projectHubAlert(notif.title, notif.text, notif.appName, notifUniqueKey);

        if (notif.isCallNotification) {
          setIncomingCallLabel(`${notif.title}: ${notif.text}`);
          if (incomingCallClearRef.current) clearTimeout(incomingCallClearRef.current);
          incomingCallClearRef.current = setTimeout(() => setIncomingCallLabel(null), 26000);
          if ((alertsCfg?.autoCallVoiceControl ?? true) && !speechService.getListeningState()) {
            const callAlert = `${notif.title} ki call aa rahi hai. Uthaoon ya kaat doon?`;
            speechService.speak(callAlert, {
              lang: languageRef.current,
              gender: hubPresenterTurnRef.current === "female" ? "male" : "female",
            });
          }
          return;
        }

        const isSleeping =
          activityStateRef.current === "lying_sleeping" && (alertsCfg?.activityAwareMode ?? true);
        const vipMatch = (alertsCfg?.vipContacts || []).some(
          (v) =>
            notif.title.toLowerCase().includes(v.name.toLowerCase()) ||
            notif.text.toLowerCase().includes(v.name.toLowerCase())
        );
        const appRule = (alertsCfg?.appRules || DEFAULT_APP_ALERT_RULES).find(
          (r) =>
            notif.packageName === r.packageName ||
            notif.appName.toLowerCase().includes(r.appName.toLowerCase())
        );
        if (appRule && !appRule.enabled) return;
        if (isSleeping && !vipMatch && !(appRule?.allowInSleepOrQuiet)) return;

        const alertLine = `${vipMatch ? "VIP Alert! " : ""}${notif.appName} par ${notif.title} ka message aaya hai: ${notif.text}`;
        if (
          (alertsCfg?.speakNotificationsAloud ?? true) &&
          (vipMatch || !appRule || appRule.speakAloud) &&
          !speechService.getListeningState()
        ) {
          speechService.speak(alertLine, {
            lang: languageRef.current,
            gender: hubPresenterTurnRef.current === "female" ? "male" : "female",
          });
        }
      }
    );

    const unsubActivityVip = subscribeActivityAndVipEvents(
      (stateStr) => {
        setActivityState((stateStr as UserActivityState) || "sitting_stationary");
      },
      (sender, text) => {
        const line = `VIP Yaad-dehani: ${sender} — ${text}`;
        projectHubAlert(`VIP: ${sender}`, text, "VIP PRIORITY");
        showToast(line);
        if (!speechService.getListeningState() && !speechService.getSpeakingState()) {
          speechService.speak(line, { lang: languageRef.current, gender: voiceCharRef.current });
        }
      }
    );

    const unsubStudioLaunch = subscribeStudioLaunchEvent(() => {
      setIsAuthenticated(true);
      setIsOneUiStudioOpen(true);
    });

    if (isNativeAndroidApk()) {
      getUserActivityStateAndroid().then((st) => {
        if (st) setActivityState(st as UserActivityState);
      });

      consumePendingStudioLaunchAndroid().then((target) => {
        if (target) {
          setIsAuthenticated(true);
          setIsOneUiStudioOpen(true);
        }
      });

      consumePendingWakeEventAndroid().then((pending) => {
        if (pending?.hasPending) {
          setIsAuthenticated(true);
          setIsVoiceModalOpen(false);
          setIsWakeWaveOpen(false);
          soundEffects.playBeepConfirm();
          if (pending.trailingCommand && pending.trailingCommand.trim().length >= 3) {
            processCockpitCommandRef.current(pending.trailingCommand.trim());
          } else {
            manualCancelRef.current = false;
            setCockpitLiveTranscript("");
            speechService.startListening(languageRef.current);
          }
        }
      });

      getNativeBackgroundStatus().then((bg) => {
        if (bg) {
          setBatteryUnrestricted(Boolean(bg.batteryUnrestricted));
        }
      });
    }

    const unsubPermEvents = subscribeNativeSpeechEvents({
      onPermissionsChanged: (st) => {
        if (isNativeAndroidApk()) {
          setNeedsWhatsAppAccess(!st.notifListener);
        }
      },
    });

    const onCustomHubAlert = (ev: Event) => {
      const detail = (ev as CustomEvent<{ title?: string; text?: string; source?: string }>).detail;
      if (!detail?.text) return;
      projectHubAlert(detail.title || "Mobile Alert", detail.text, detail.source || "PHONE BRIDGE");
    };
    window.addEventListener("q-nexus-hub-alert", onCustomHubAlert);

    return () => {
      window.removeEventListener("q-nexus-hub-alert", onCustomHubAlert);
      if (heardClearTimerRef.current) clearTimeout(heardClearTimerRef.current);
      if (hubNotifTimerRef.current) clearTimeout(hubNotifTimerRef.current);
      if (incomingCallClearRef.current) clearTimeout(incomingCallClearRef.current);
      speechService.enableWakeWord(false);
      unsubPermEvents();
      unsubStudioLaunch();
      unsubActivityVip();
      unsubNative();
      unsubSpeaking();
      unsubListening();
    };
  }, [isAuthenticated, isWakeWordActive]);

  // Browser Web Fallback Activity & Speed Monitor + Repeating Urgent Task Reminder Loop
  useEffect(() => {
    if (!isAuthenticated) return;
    let watchId: number | null = null;
    let lastWalkTick = 0;

    if (!isNativeAndroidApk() && typeof window !== "undefined") {
      const onMotion = (e: DeviceMotionEvent) => {
        const acc = e.accelerationIncludingGravity;
        if (!acc) return;
        const mag = Math.sqrt((acc.x || 0) ** 2 + (acc.y || 0) ** 2 + (acc.z || 0) ** 2);
        const delta = Math.abs(mag - 9.8);
        if (delta > 1.8) {
          lastWalkTick = Date.now();
          setActivityState((prev) => (prev === "riding_bike" ? prev : "walking"));
        } else if (Date.now() - lastWalkTick > 10000) {
          setActivityState((prev) => (prev === "riding_bike" ? prev : "sitting_stationary"));
        }
      };
      window.addEventListener("devicemotion", onMotion);
      if ("geolocation" in navigator) {
        try {
          watchId = navigator.geolocation.watchPosition(
            (pos) => {
              const spd = pos.coords.speed ?? 0;
              if (spd >= 4.5) setActivityState("riding_bike");
              else if (spd >= 0.8) setActivityState("walking");
            },
            () => {},
            { enableHighAccuracy: false, maximumAge: 15000 }
          );
        } catch {}
      }
      const taskInterval = setInterval(() => {
        const alertsCfg = proactiveAlertsRef.current;
        if (!alertsCfg?.taskReminders || speechService.getListeningState() || speechService.getSpeakingState()) return;
        const repeatMs = (alertsCfg.taskUrgentRepeatMinutes ?? 5) * 60 * 1000;
        if (Date.now() - lastTaskUrgentRemindAtRef.current < repeatMs) return;
        const pending = storageService.getTasks().filter((t) => !t.completed);
        if (pending.length === 0) return;
        const high = pending.find((t) => t.priority === "high");
        const isSleeping = activityStateRef.current === "lying_sleeping" && alertsCfg.activityAwareMode;
        if (isSleeping && !high) return;
        const chosen = high || pending[0];
        lastTaskUrgentRemindAtRef.current = Date.now();
        const line =
          languageRef.current === "en"
            ? `Task reminder: ${chosen.title} is still pending.`
            : `Task Yaad-dehani: Aapka kaam "${chosen.title}" abhi baqi hai.`;
        projectHubAlert("Urgent Task Reminder", chosen.title, "TASK GUARD");
        speechService.speak(line, { lang: languageRef.current, gender: voiceCharRef.current });
      }, 60000);

      return () => {
        window.removeEventListener("devicemotion", onMotion);
        if (watchId !== null) navigator.geolocation.clearWatch(watchId);
        clearInterval(taskInterval);
      };
    }

    const nativeTaskInterval = setInterval(() => {
      const alertsCfg = proactiveAlertsRef.current;
      if (!alertsCfg?.taskReminders || speechService.getListeningState() || speechService.getSpeakingState()) return;
      const repeatMs = (alertsCfg.taskUrgentRepeatMinutes ?? 5) * 60 * 1000;
      if (Date.now() - lastTaskUrgentRemindAtRef.current < repeatMs) return;
      const pending = storageService.getTasks().filter((t) => !t.completed);
      if (pending.length === 0) return;
      const high = pending.find((t) => t.priority === "high");
      const isSleeping = activityStateRef.current === "lying_sleeping" && alertsCfg.activityAwareMode;
      if (isSleeping && !high) return;
      const chosen = high || pending[0];
      lastTaskUrgentRemindAtRef.current = Date.now();
      const line =
        languageRef.current === "en"
          ? `Task reminder: ${chosen.title} is still pending.`
          : `Task Yaad-dehani: Aapka kaam "${chosen.title}" abhi baqi hai.`;
      projectHubAlert("Urgent Task Reminder", chosen.title, "TASK GUARD");
      speechService.speak(line, { lang: languageRef.current, gender: voiceCharRef.current });
    }, 60000);
    return () => clearInterval(nativeTaskInterval);
  }, [isAuthenticated]);

  // Proactive Mobile Hardware Telemetry & Network Alert Watcher
  const lowBatteryAlertedRef = useRef(false);
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleNetOnline = () => {
      if (proactiveAlertsRef.current?.networkAlerts === false) return;
      const msg =
        languageRef.current === "en"
          ? "Mobile connection restored. Wasu's Jarvis is back online."
          : "Phone internet connection wapas aa gaya hai.";
      appendCockpitSummary("reminder", "Network Alert", msg);
      projectHubAlert("Network Online", msg, "MOBILE RADIO");
      if (!speechService.getListeningState() && !speechService.getSpeakingState()) {
        speechService.speak(msg, { lang: languageRef.current, gender: voiceCharRef.current });
      }
    };

    const handleNetOffline = () => {
      if (proactiveAlertsRef.current?.networkAlerts === false) return;
      const msg =
        languageRef.current === "en"
          ? "Phone network disconnected. Local mobile offline mode active."
          : "Phone internet disconnect ho gaya hai. Local offline mode active hai.";
      appendCockpitSummary("reminder", "Network Alert", msg);
      projectHubAlert("Network Offline", msg, "MOBILE RADIO");
      if (!speechService.getListeningState() && !speechService.getSpeakingState()) {
        speechService.speak(msg, { lang: languageRef.current, gender: voiceCharRef.current });
      }
    };

    window.addEventListener("online", handleNetOnline);
    window.addEventListener("offline", handleNetOffline);

    const checkBattery = async () => {
      try {
        const tel = await readPhoneHardwareTelemetry();
        if (tel.batteryPercent !== null) setPhoneBatteryPercent(tel.batteryPercent);
        setIsPhoneCharging(Boolean(tel.isCharging));

        if (
          lastChargingRef.current === false &&
          tel.isCharging &&
          oneUiConfigRef.current.chargingOverlayEnabled
        ) {
          setIsChargingAnimOpen(true);
          if (chargingAutoCloseRef.current) clearTimeout(chargingAutoCloseRef.current);
          chargingAutoCloseRef.current = setTimeout(() => setIsChargingAnimOpen(false), 6500);
        }
        lastChargingRef.current = Boolean(tel.isCharging);

        const threshold = proactiveAlertsRef.current?.lowBatteryThreshold ?? 20;
        if (tel.batteryPercent !== null && tel.batteryPercent <= threshold && !tel.isCharging) {
          if (!lowBatteryAlertedRef.current) {
            lowBatteryAlertedRef.current = true;
            const msg =
              languageRef.current === "en"
                ? `Low battery alert: Phone battery is at ${tel.batteryPercent}%. Connect your charger.`
                : `Battery Alert: Aapke phone ki battery sirf ${tel.batteryPercent} percent reh gayi hai, charger laga lein.`;
            appendCockpitSummary("reminder", "Battery Alert", msg);
            projectHubAlert("Low Battery Alert", msg, "POWER GUARD");
            if (!speechService.getListeningState() && !speechService.getSpeakingState()) {
              speechService.speak(msg, { lang: languageRef.current, gender: voiceCharRef.current });
            }
          }
        } else if (tel.batteryPercent !== null && (tel.isCharging || tel.batteryPercent > threshold + 5)) {
          lowBatteryAlertedRef.current = false;
        }
      } catch {}
    };

    checkBattery();
    const batInterval = setInterval(checkBattery, 12000);
    return () => {
      window.removeEventListener("online", handleNetOnline);
      window.removeEventListener("offline", handleNetOffline);
      clearInterval(batInterval);
      if (chargingAutoCloseRef.current) clearTimeout(chargingAutoCloseRef.current);
    };
  }, [isAuthenticated]);

  // Proactive Companion Engine: Tells User About Pending Tasks, Health & Calls/Notifications Aloud
  const initialBriefingDoneRef = useRef(false);
  const proactiveCycleIndexRef = useRef(0);

  const speakProactiveBriefing = async (mode: "full" | "tasks" | "health" | "comms" = "full") => {
    if (isJarvisListening || isWakeWaveOpen || isVoiceModalOpen || isIdentityVideoOpen) return;

    const cfg = customization.avatarConfig;
    const charGender = cfg?.characterGender === "male" ? "male" : "female";
    const activePersona =
      PERSONALITY_MODES.find((p) => p.id === cfg?.personalityId) ||
      PERSONALITY_MODES.find((p) => p.voiceGender === charGender) ||
      PERSONALITY_MODES[0];
    const customSlot = charGender === "male" ? cfg?.maleVoiceSettings : cfg?.femaleVoiceSettings;
    const tasks = storageService.getTasks();
    const pendingTasks = tasks.filter((t) => !t.completed);
    const health = storageService.getHealth();
    const hasHealthLogs =
      health.waterDrankGlasses > 0 ||
      health.mealsLogged.length > 0 ||
      health.sleepHoursLastNight > 0 ||
      health.dailySteps > 0;
    let lifeRecordsCount = 0;
    try {
      const rawRec = localStorage.getItem("q_nexus_life_records");
      const parsedRec = rawRec ? JSON.parse(rawRec) : [];
      lifeRecordsCount = Array.isArray(parsedRec) ? parsedRec.length : 0;
    } catch {}

    let notifPart = "";
    if (isNativeAndroidApk()) {
      try {
        const [notifRes, callsRes] = await Promise.all([
          getNativePhoneNotifications(),
          getNativeCallLogs(),
        ]);
        const missedCalls = callsRes.filter((c) => c.type === "MISSED");
        if (notifRes.notifications.length > 0 || missedCalls.length > 0) {
          notifPart =
            language === "en"
              ? `You have ${notifRes.notifications.length} app notifications and ${missedCalls.length} missed calls.`
              : `Aapke ${notifRes.notifications.length} naye notifications aur ${missedCalls.length} missed calls hain.`;
        }
      } catch {}
    }

    let message = "";
    if (mode === "tasks") {
      if (pendingTasks.length === 0) return;
      message =
        language === "en"
          ? `Task reminder: You have ${pendingTasks.length} pending tasks. Next is ${pendingTasks[0].title}.`
          : `Task update: Aapke ${pendingTasks.length} pending tasks hain. Agla kaam: ${pendingTasks[0].title}.`;
    } else if (mode === "health") {
      if (!hasHealthLogs) return;
      const glassesLeft = Math.max(0, 8 - health.waterDrankGlasses);
      message =
        language === "en"
          ? `Health reminder: ${health.waterDrankGlasses} of 8 water glasses logged.`
          : `Health update: Aapne ${health.waterDrankGlasses} glass pani log kiya hai (${glassesLeft} baqi).`;
    } else if (mode === "comms") {
      if (!notifPart) return;
      message = notifPart;
    } else {
      const tel = await readPhoneHardwareTelemetry().catch(() => null);
      const timeNow = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const taskSummary =
        pendingTasks.length > 0
          ? language === "en"
            ? `${pendingTasks.length} pending tasks starting with ${pendingTasks[0].title}.`
            : `Aapke ${pendingTasks.length} pending tasks hain jisme sab se pehla ${pendingTasks[0].title} hai.`
          : language === "en"
          ? "No pending tasks added yet."
          : "Abhi koi pending task add nahi hai.";

      const healthSummary = hasHealthLogs
        ? language === "en"
          ? `Water intake logged: ${health.waterDrankGlasses} of 8 glasses.`
          : `Health mein ab tak ${health.waterDrankGlasses} glass pani log hai.`
        : language === "en"
        ? "No health measurements logged yet."
        : "Health Hub mein abhi koi measurement log nahi hui.";

      const telSummary = tel
        ? language === "en"
          ? `Time is ${timeNow}, device ${tel.deviceName}, battery ${tel.batteryPercent !== null ? `${tel.batteryPercent}%` : "connected"}, network ${tel.networkType}.`
          : `Is waqt ${timeNow} baje hain, system ${tel.deviceName} par battery ${tel.batteryPercent !== null ? `${tel.batteryPercent} percent` : "ready"} aur network ${tel.networkType} active hai.`
        : "";

      message = [telSummary, taskSummary, healthSummary, notifPart].filter(Boolean).join(" ");
      if (!message && lifeRecordsCount === 0) {
        message =
          language === "en"
            ? `${activeCharName} ready. No tasks or life records added yet.`
            : `Ji Wasi Sahab, main ${activeCharName} hazir hoon. Abhi koi task ya health log add nahi hai.`;
      }
    }

    if (message) {
      const fast = cfg?.fastTalkingMode ?? true;
      const pitch = customSlot?.pitch ?? activePersona.pitch;
      const rate = customSlot?.rate ?? activePersona.rate;
      setCockpitLiveReply(message);
      const briefId = pushMainPanelItem({
        kind: "chat",
        source: activeCharName,
        title: "Briefing",
        text: message,
        speakerRole: "reminder",
      });
      speechService.speak(message, {
        lang: language,
        gender: charGender,
        pitch,
        rate: fast ? Math.max(rate, 1.02) : rate,
        fast,
        useElevenLabs: cfg?.useElevenLabs,
        elevenLabsVoiceId: cfg?.elevenLabsVoiceId,
        onEnd: () => {
          setCockpitLiveReply("");
          setTimeout(() => archiveMainPanelItems([briefId]), 4500);
        },
      });
    }
  };

  // Run immediate female Assalam-o-Alaikum welcome + safe Android mic/core permission priming on launch
  useEffect(() => {
    if (!isAuthenticated) {
      initialBriefingDoneRef.current = false;
      return;
    }
    if (showLoadingScreen) return;

    let initTimer: ReturnType<typeof setTimeout> | undefined;
    if (!initialBriefingDoneRef.current) {
      initTimer = setTimeout(async () => {
        if (initialBriefingDoneRef.current) return;
        initialBriefingDoneRef.current = true;

        if (isNativeAndroidApk()) {
          try {
            let st = await getAndroidPermissionStatus();
            if (!st || !st.mic || !st.notifications) {
              const reqRes = await requestCorePermissionsAndroid();
              if (reqRes) st = reqRes;
            }
            setNeedsWhatsAppAccess(!st?.notifListener);
            await speechService.primeMicrophoneAccess();
            const optedOut =
              typeof localStorage !== "undefined" &&
              localStorage.getItem("wasu_jarvis_bg_opt_out") === "1";
            if (!optedOut && st?.mic) {
              setNativeBackgroundWakeService(true).catch(() => {});
            }
            if (st?.notifListener) {
              const notifRes = await getNativePhoneNotifications();
              const unseen = notifRes.notifications
                .filter((n) => !seenNotifKeysRef.current.has(`${n.key}:${n.text}`))
                .slice(0, 5);
              unseen.reverse().forEach((n) => {
                pushMainPanelItem({
                  kind: "notification",
                  source: n.appName,
                  title: n.title,
                  text: n.text,
                  speakerRole: "reminder",
                  nativeKey: `${n.key}:${n.text}`,
                });
              });
            }
          } catch {}
        }

        if (!speechService.getSpeakingState() && !speechService.getListeningState()) {
          const cfg = customization.avatarConfig;
          const femaleName = getCharacterDisplayName(cfg, "female");
          const salamMsg =
            language === "en"
              ? `Assalam-o-Alaikum Wasi Sahab! Welcome back. I am ${femaleName}, your Wasu's Jarvis assistant. All systems are online and listening for your command.`
              : `Assalam-o-Alaikum Wasi Sahab! Khush amdeed. Main ${femaleName} hoon, aapki Wasu's Jarvis. Tamaam systems online hain, farmaiye main aapki kya madad karoon?`;
          const femaleSlot = cfg?.femaleVoiceSettings;
          setCockpitLiveReply(salamMsg);
          const welcomeId = pushMainPanelItem({
            kind: "chat",
            source: femaleName,
            title: "Welcome",
            text: salamMsg,
            speakerRole: "assistant",
          });
          speechService.speak(salamMsg, {
            lang: language,
            gender: "female",
            pitch: femaleSlot?.pitch ?? 1.06,
            rate: Math.max(femaleSlot?.rate ?? 0.98, 1.0),
            fast: cfg?.fastTalkingMode ?? true,
            forceCustomTest: true,
            useElevenLabs: cfg?.useElevenLabs,
            elevenLabsVoiceId: cfg?.elevenLabsVoiceId,
            onEnd: () => {
              setCockpitLiveReply("");
              setTimeout(() => archiveMainPanelItems([welcomeId]), 4500);
            },
          });
        }
      }, 650);
    }

    const periodicTimer = setInterval(() => {
      if (
        !isAuthenticated ||
        isAwayMode ||
        isHealthLockdownActive ||
        isVoiceModalOpen ||
        isWakeWaveOpen ||
        isIdentityVideoOpen ||
        speechService.getListeningState() ||
        speechService.getSpeakingState()
      ) {
        return;
      }
      const modes: Array<"health" | "tasks" | "comms"> = ["health", "tasks", "comms"];
      const nextMode = modes[proactiveCycleIndexRef.current % modes.length];
      proactiveCycleIndexRef.current += 1;
      speakProactiveBriefing(nextMode);
    }, 10 * 60 * 1000);

    return () => {
      if (initTimer) clearTimeout(initTimer);
      clearInterval(periodicTimer);
    };
  }, [
    isAuthenticated,
    showLoadingScreen,
    isAwayMode,
    isHealthLockdownActive,
    isVoiceModalOpen,
    isWakeWaveOpen,
    language,
    customization.avatarConfig?.characterGender,
  ]);

  // Continuous Work Timer (Triggers Mandatory Health Rest)
  useEffect(() => {
    if (!isAuthenticated || showLoadingScreen || isAwayMode || isHealthLockdownActive) return;

    const interval = setInterval(() => {
      setScreenWorkSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isAuthenticated, showLoadingScreen, isAwayMode, isHealthLockdownActive]);

  useEffect(() => {
    if (
      isAuthenticated &&
      !isAwayMode &&
      !isHealthLockdownActive &&
      screenWorkSeconds >= customization.continuousWorkLimitMinutes * 60
    ) {
      setIsHealthLockdownActive(true);
      setScreenWorkSeconds(0);
    }
  }, [
    isAuthenticated,
    isAwayMode,
    isHealthLockdownActive,
    screenWorkSeconds,
    customization.continuousWorkLimitMinutes,
  ]);

  // Inactivity Screensaver & Mobile Auto-Lock Timer (with touchstart support)
  useEffect(() => {
    if (!isAuthenticated || isAwayMode || isHealthLockdownActive) return;

    let awayTimeoutId: ReturnType<typeof setTimeout> | undefined;
    let lockTimeoutId: ReturnType<typeof setTimeout> | undefined;
    const autoLockMins = customization.securityConfig?.autoLockMinutes ?? 5;

    const resetTimers = () => {
      if (awayTimeoutId) clearTimeout(awayTimeoutId);
      if (lockTimeoutId) clearTimeout(lockTimeoutId);

      if (customization.screensaverTimeoutMinutes > 0) {
        awayTimeoutId = setTimeout(() => {
          setIsAwayMode(true);
        }, customization.screensaverTimeoutMinutes * 60 * 1000);
      }

      if (autoLockMins > 0 && customization.oneUiConfig?.requireStartupLock) {
        lockTimeoutId = setTimeout(() => {
          sessionStorage.removeItem("q_nexus_session_auth");
          localStorage.removeItem("q_nexus_wasi_auth");
          setIsAuthenticated(false);
        }, autoLockMins * 60 * 1000);
      }
    };

    window.addEventListener("mousemove", resetTimers);
    window.addEventListener("keydown", resetTimers);
    window.addEventListener("click", resetTimers);
    window.addEventListener("touchstart", resetTimers, { passive: true });
    resetTimers();

    return () => {
      if (awayTimeoutId) clearTimeout(awayTimeoutId);
      if (lockTimeoutId) clearTimeout(lockTimeoutId);
      window.removeEventListener("mousemove", resetTimers);
      window.removeEventListener("keydown", resetTimers);
      window.removeEventListener("click", resetTimers);
      window.removeEventListener("touchstart", resetTimers);
    };
  }, [
    isAuthenticated,
    isAwayMode,
    isHealthLockdownActive,
    customization.screensaverTimeoutMinutes,
    customization.securityConfig?.autoLockMinutes,
    customization.oneUiConfig?.requireStartupLock,
  ]);

  // Handle Mobile Home Screen Shortcut Actions (?action=voice, ?action=phone-hub, or ?tab=oneui9)
  useEffect(() => {
    if (!isAuthenticated || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const action = params.get("action");
    const tab = params.get("tab");
    if (tab === "oneui9") {
      setIsOneUiStudioOpen(true);
      window.history.replaceState({}, "", "/");
    } else if (action === "voice") {
      setIsVoiceModalOpen(true);
      window.history.replaceState({}, "", "/");
    } else if (action === "phone-hub") {
      setAppsMatrixInitialModule("desktop");
      setIsAppsMatrixOpen(true);
      window.history.replaceState({}, "", "/");
    }
  }, [isAuthenticated]);

  // Fluctuate Quantum Coherence slightly for realism
  useEffect(() => {
    const interval = setInterval(() => {
      setCoherence((prev) => Math.min(99.99, Math.max(99.85, parseFloat((prev + (Math.random() * 0.04 - 0.02)).toFixed(2)))));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // WASU'S JARVIS Stage 3: Auto-cycle 4 topologies (every 9s) & 4 color spectrums (every 11s) + 'H' Capture Toggle
  useEffect(() => {
    if (!isAuthenticated || showLoadingScreen) return;
    const topoTimer = autoCycleTopology
      ? setInterval(() => {
          setTopologyIndex((prev) => (prev + 1) % 4);
        }, 9000)
      : null;
    const specTimer = setInterval(() => {
      setSpectrumIndex((prev) => (prev + 1) % QUANTUM_SPECTRUMS.length);
    }, 11000);

    return () => {
      if (topoTimer) clearInterval(topoTimer);
      clearInterval(specTimer);
    };
  }, [isAuthenticated, showLoadingScreen, autoCycleTopology]);

  useEffect(() => {
    document.body.classList.toggle("hud-hidden", hudHidden);
    return () => {
      document.body.classList.remove("hud-hidden");
    };
  }, [hudHidden]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isAuthenticated || showLoadingScreen || isSettingsOpen || isAppsMatrixOpen || isVoiceModalOpen) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "h" || e.key === "H") {
        setHudHidden((prev) => {
          const next = !prev;
          soundEffects.playKeyClick(next ? 680 : 940);
          showToast(next ? "HUD Hidden — Press H to Restore" : "HUD Restored");
          return next;
        });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isAuthenticated, showLoadingScreen, isSettingsOpen, isAppsMatrixOpen, isVoiceModalOpen]);

  const syncAllOverlayToNative = (
    nextOneUi: OneUiStudioConfig,
    nextAlerts?: ProactiveAlertConfig
  ) => {
    const alerts = nextAlerts || customization.proactiveAlerts;
    syncOneUiOverlayConfigAndroid({
      dynamicBarStyle: nextOneUi.dynamicBarStyleId,
      dynamicBarAnchor: nextOneUi.dynamicBarAnchor,
      dynamicBarOffsetX: nextOneUi.dynamicBarOffsetX,
      dynamicBarOffsetY: nextOneUi.dynamicBarOffsetY,
      dynamicBarCustomLabel: nextOneUi.dynamicBarCustomLabel,
      dynamicBarShowOutsideApp: nextOneUi.dynamicBarShowOutsideApp,
      unlockBarAnimStyle: nextOneUi.unlockBarAnimStyle,
      chargingAnim: nextOneUi.chargingAnimId,
      chargingOverlayEnabled: nextOneUi.chargingOverlayEnabled,
      accentHex: nextOneUi.accentColorHex,
      liveWallpaperStyle: nextOneUi.liveWallpaperId,
      clockHex: nextOneUi.clockColorHex,
      waveVisualizerStyle: nextOneUi.waveVisualizerStyle,
      waveColorTheme: nextOneUi.waveColorTheme,
      followUpListeningEnabled: nextOneUi.followUpListeningEnabled,
      vipContactsJson: JSON.stringify(alerts?.vipContacts || []),
      perAppRulesJson: JSON.stringify(alerts?.appRules || DEFAULT_APP_ALERT_RULES),
      customBiometricImageDataUrl: nextOneUi.customBiometricImageDataUrl || "",
    }).catch(() => {});
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    syncAllOverlayToNative(oneUiConfig, customization.proactiveAlerts);
  }, [isAuthenticated]);

  const handleUpdateCustomization = (updated: DashboardCustomization) => {
    setCustomization(updated);
    storageService.saveCustomization(updated);
    syncAllOverlayToNative(updated.oneUiConfig || oneUiConfig, updated.proactiveAlerts);
    showToast("Quantum Settings Applied");
  };

  const handleUpdateOneUiConfig = (nextOneUi: OneUiStudioConfig) => {
    const updated: DashboardCustomization = {
      ...customization,
      oneUiConfig: nextOneUi,
    };
    setCustomization(updated);
    storageService.saveCustomization(updated);
    syncAllOverlayToNative(nextOneUi, updated.proactiveAlerts);
  };

  const handleUpdateProactiveAlerts = (nextAlerts: ProactiveAlertConfig) => {
    const updated: DashboardCustomization = {
      ...customization,
      proactiveAlerts: nextAlerts,
    };
    setCustomization(updated);
    storageService.saveCustomization(updated);
    syncAllOverlayToNative(oneUiConfig, nextAlerts);
  };

  const handleLanguageChange = (newLang: LanguageCode) => {
    setLanguage(newLang);
    const updated = { ...userProfile, preferredLanguage: newLang };
    setUserProfile(updated);
    storageService.saveUserProfile(updated);
    showToast(`Language set to: ${newLang.toUpperCase()}`);
  };

  const toggleWakeWord = () => {
    const next = !isWakeWordActive;
    setIsWakeWordActive(next);
    speechService.enableWakeWord(next);
    showToast(next ? "Wake Word 'Hi Jarvis' Active (Mic OFF until wake)" : "Wake Word Disabled");
  };

  // Cloud Backup Export
  const handleExportBackup = () => {
    soundEffects.playBeepConfirm();
    const json = storageService.exportFullBackup();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Quantum_Jarvis_Backup_Wasi_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Quantum Encrypted Backup Downloaded!");
  };

  // Cloud Backup Import
  const handleImportBackup = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const success = storageService.importFullBackup(text);
        if (success) {
          soundEffects.playQuantumStartup();
          setUserProfile(storageService.getUserProfile());
          setCustomization(storageService.getCustomization());
          showToast("Backup successfully restored!");
          window.location.reload();
        } else {
          soundEffects.playAlert();
          showToast("Failed to parse backup JSON.");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  // Execute Action from Voice/Chat Command
  const handleExecuteVoiceAction = (action: string, payload?: any) => {
    soundEffects.playBeepConfirm();

    if (action === "SHOW_IDENTITY_VIDEO") {
      setIsVoiceModalOpen(false);
      setIsWakeWaveOpen(false);
      setIsAppsMatrixOpen(false);
      setProjectedHubModule(null);
      setIsIdentityVideoOpen(true);
      showToast(
        `${getCharacterDisplayName(avatarConfig, "male")} & ${getCharacterDisplayName(
          avatarConfig,
          "female"
        )} Hologram Active`
      );
    } else if (action === "OPEN_MEDIA_STUDIO" || action === "SCREEN_HELP") {
      setProjectedHubModule("studio");
      showToast("Creative Media & Auto-Post Studio Projected");
    } else if (action === "OPEN_APP") {
      setProjectedHubModule("desktop");
      showToast(`Projected: ${payload?.appName || "Phone Manager"}`);
    } else if (action === "OPEN_STUDY") {
      setProjectedHubModule("study");
      showToast("Study, Labs & Simulation Hub Projected");
    } else if (action === "OPEN_BUSINESS") {
      setProjectedHubModule("business");
      showToast("Business Command & Growth Advisor Projected");
    } else if (action === "OPEN_AUTOMATION" || action === "SCAN_SCREEN") {
      setProjectedHubModule("automation");
      showToast("Workflow Automation Engine Projected");
    } else if (action === "OPEN_COMMS") {
      setProjectedHubModule("comms");
      showToast("Phone Notifications, Calls & Auto-Reply Projected");
    } else if (action === "OPEN_TASKS") {
      setProjectedHubModule("memory");
      showToast("Tasks & Reminders Hub Projected");
    } else if (action === "OPEN_COMMUNICATION" || action === "SCHEDULE_MEET" || action === "DECOMPOSE_TASK") {
      setProjectedHubModule("communication");
      showToast("Omni-Channel & Coding Copilot Projected");
    } else if (action === "OPEN_MAPS" || action === "GPS_TRACK") {
      setProjectedHubModule("maps");
      showToast("Quantum Geospatial Maps & Radar Projected");
    } else if (action === "OPEN_DEVICES") {
      setProjectedHubModule("devices");
      showToast("Mobile Device Control Projected");
    } else if (action === "FIND_PHONE") {
      playLocatorSiren(2600);
      setProjectedHubModule("devices");
      showToast("Find My Phone Siren Triggered!");
    } else if (action === "FLASHLIGHT_ON") {
      togglePhoneFlashlight(true).then((r) => showToast(r.message));
    } else if (action === "FLASHLIGHT_OFF") {
      togglePhoneFlashlight(false).then((r) => showToast(r.message));
    } else if (action === "VIBRATE_PHONE") {
      triggerHaptic([120, 60, 120, 60, 160]);
      showToast("Phone Haptic Pulse Triggered!");
    } else if (action === "PRIVACY_CLOAK") {
      window.dispatchEvent(new CustomEvent("toggle-privacy-cloak"));
      showToast("High-Privacy Cloak Toggled!");
    } else if (action === "AIR_GAP") {
      window.dispatchEvent(new CustomEvent("toggle-air-gap"));
      showToast("Air-Gap Isolation Toggled!");
    } else if (action === "START_FOCUS") {
      setProjectedHubModule("focus");
      showToast("Quantum Deep Focus Projected");
    } else if (action === "HEALTH_ALERT") {
      setProjectedHubModule("health");
      showToast(payload?.message || "Health Alert Projected");
    } else if (action === "LOG_EXPENSE") {
      setProjectedHubModule("finance");
      showToast("Financial Defense Hub Projected");
    } else if (action === "OPEN_ONEUI_STUDIO") {
      setIsOneUiStudioOpen(true);
      showToast("One UI 9 Personalization Studio Opened");
    } else if (action === "OPEN_QUICK_PANEL") {
      setIsQuickPanelOpen(true);
      showToast("Quick Switches Panel Opened");
    } else if (action === "LOCK_SYSTEM") {
      speechService.cancelSpeech();
      setProjectedHubModule(null);
      localStorage.removeItem("q_nexus_wasi_auth");
      sessionStorage.removeItem("q_nexus_session_auth");
      setIsAuthenticated(false);
    } else if (action === "AWAY_MODE") {
      setIsAwayMode(true);
    }
  };

  const activeStageSpectrum = QUANTUM_SPECTRUMS[spectrumIndex % QUANTUM_SPECTRUMS.length];

  return (
    <div className="relative min-h-[100dvh] bg-[#02050f] text-slate-100 flex flex-col w-full font-rajdhani selection:bg-cyan-500 selection:text-black overflow-x-hidden">
      <OfflineIndicator />
      <WormholeTransition
        active={wormholeState.active}
        label={wormholeState.label}
        primaryColor={activeStageSpectrum.hex}
        secondaryColor={activeStageSpectrum.secondaryHex}
      />

      <QuantumBackground3D
        show3D={customization.show3DBackground && isAuthenticated && showLoadingScreen}
        customBgUrl={customization.customBgUrl}
        customAccentHex={isAuthenticated ? activeStageSpectrum.hex : "#00f0ff"}
        customSecondaryHex={isAuthenticated ? activeStageSpectrum.secondaryHex : "#8b5cf6"}
        energySurge={isAuthenticated ? energySurge : false}
      />

      {!isAuthenticated ? (
        <div className="relative z-10 flex-1 min-h-[100dvh] flex items-center justify-center overflow-hidden">
          <SecurityGate
            onAuthenticated={() => {
              setUnlockMethodLabel("Biometric");
              setUnlockPulseNonce((n) => n + 1);
              triggerWormhole("Entering Wasu's Jarvis Mobile Core", () => {
                sessionStorage.setItem("q_nexus_session_auth", "active");
                setIsAuthenticated(true);
                setShowLoadingScreen(true);
              });
            }}
            preferredLanguage={language}
            customization={customization}
          />
        </div>
      ) : (
        <>
          {/* Visual Scanline Effect (Separate overlay so all click events work) */}
          {customization.scanlines && <div className="scanlines-overlay" />}

          {/* Mandatory Ergonomic Mobile Health Rest Lockdown */}
          <MandatoryHealthLockdown
        isOpen={isHealthLockdownActive}
        onRestCompleted={() => {
          setIsHealthLockdownActive(false);
          setScreenWorkSeconds(0);
        }}
        language={language}
        voiceGender={customization.activeVoiceMode}
        durationMinutes={customization.mandatoryRestMinutes}
      />

      {/* Mobile Standby Shield */}
      {isAwayMode && (
        <AwayAutoPilot
          onReturn={() => setIsAwayMode(false)}
          language={language}
          voiceGender={customization.activeVoiceMode}
        />
      )}

      {/* Unified Wasu's Jarvis Applications Matrix */}
      <QuantumAppsMatrix
        isOpen={isAppsMatrixOpen}
        onClose={() => setIsAppsMatrixOpen(false)}
        language={language}
        voiceGender={customization.activeVoiceMode}
        userProfile={userProfile}
        onUpdateProfile={setUserProfile}
        initialModule={appsMatrixInitialModule}
      />

      {/* Settings & Full Mobile Customization Modal */}
      <QuantumSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        customization={customization}
        onUpdateCustomization={handleUpdateCustomization}
        language={language}
        onLanguageChange={handleLanguageChange}
        isWakeWordActive={isWakeWordActive}
        onToggleWakeWord={toggleWakeWord}
        onExportBackup={handleExportBackup}
        onImportBackup={handleImportBackup}
        initialTab={settingsInitialTab}
        onOpenFullView={() => setIsIdentityVideoOpen(true)}
        onOpenDetailView={() => setDetailViewNonce((n) => n + 1)}
        onSpeakBriefing={() => speakProactiveBriefing("full")}
      />

      {/* Mobile System Diagnostics & Boot Check Screen */}
      <QuantumLoadingScreen
        isOpen={showLoadingScreen}
        onComplete={() => {
          setShowLoadingScreen(false);
        }}
        commanderName={userProfile.displayName || userProfile.username}
      />

      {/* Voice Command Center Modal (with In-Chat Image/Video Gen, YouTube & Screen Analysis) */}
      <VoiceJarvisModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        language={language}
        voiceGender={customization.activeVoiceMode}
        userProfile={userProfile}
        avatarConfig={avatarConfig}
        onUpdateAvatarConfig={handleUpdateAvatarConfig}
        onExecuteAction={handleExecuteVoiceAction}
        autoListenTrigger={voiceAutoListenTrigger}
        initialCommand={voiceInitialCommand}
      />

      {/* Dedicated Holographic Wave Listening Interface (Triggered ONLY by 'Hi Jarvis') */}
      <HiJarvisWaveOverlay
        isOpen={isWakeWaveOpen}
        onClose={() => setIsWakeWaveOpen(false)}
        onOpenFullChat={() => {
          setIsWakeWaveOpen(false);
          setIsVoiceModalOpen(true);
        }}
        language={language}
        voiceGender={customization.activeVoiceMode}
        userProfile={userProfile}
        avatarConfig={avatarConfig}
        autoListenNonce={waveListenNonce}
        initialCommand={waveInitialCommand}
        onExecuteAction={handleExecuteVoiceAction}
      />

      {/* Holographic Identity Video Overlay ("mjy apna ap dikhao") */}
      <IdentityVideoOverlay
        isOpen={isIdentityVideoOpen}
        onClose={() => setIsIdentityVideoOpen(false)}
        maleName={getCharacterDisplayName(avatarConfig, "male")}
        femaleName={getCharacterDisplayName(avatarConfig, "female")}
        activeGender={avatarConfig.characterGender === "male" ? "male" : "female"}
        onSwitchGender={(nextGender) => {
          handleUpdateAvatarConfig({
            ...avatarConfig,
            characterGender: nextGender,
            personalityId: nextGender === "male" ? "wasu_male" : "wasi_ki_jan_female",
          });
          const switchedLabel = getCharacterDisplayName(avatarConfig, nextGender);
          showToast(`Voice Active: ${switchedLabel}`);
        }}
        onTriggerVoice={() => {
          setVoiceAutoListenTrigger((n) => n + 1);
          setIsVoiceModalOpen(true);
        }}
        onOpenModule={(mod) => {
          setAppsMatrixInitialModule(mod);
          setIsAppsMatrixOpen(true);
        }}
        onOpenAppsMatrix={() => {
          setAppsMatrixInitialModule(null);
          setIsAppsMatrixOpen(true);
        }}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 px-4 py-2 rounded-xl bg-cyan-950/90 border border-cyan-400 text-cyan-300 text-xs font-mono shadow-xl shadow-cyan-950 animate-fadeIn flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Live Animated + Gallery Wallpaper Layer behind Home Mode & In-App Customizations */}
      {isAuthenticated && !showLoadingScreen && (isHomeGridMode || oneUiConfig.liveWallpaperEnabledInApp) && (
        <div className="fixed inset-0 z-[5] pointer-events-none">
          <LiveWallpaperCanvas
            styleId={oneUiConfig.liveWallpaperId}
            accentHex={oneUiConfig.accentColorHex}
            galleryImageUrl={oneUiConfig.galleryWallpaperDataUrl || undefined}
            interactive={isHomeGridMode}
          />
        </div>
      )}

      {/* One UI 9 Edge Lighting Border Aura */}
      {isAuthenticated && !showLoadingScreen && oneUiConfig.edgeLightingStyle !== "off" && (
        <div
          className="pointer-events-none fixed inset-0 z-[55] rounded-[24px] sm:rounded-[30px]"
          style={{
            boxShadow:
              oneUiConfig.edgeLightingStyle === "rainbow_prism"
                ? "inset 0 0 26px rgba(0,240,255,0.45), inset 0 0 42px rgba(168,85,247,0.35)"
                : oneUiConfig.edgeLightingStyle === "emerald_spark"
                ? "inset 0 0 28px rgba(16,185,129,0.5)"
                : `inset 0 0 26px ${oneUiConfig.accentColorHex}66`,
            border: `1.5px solid ${oneUiConfig.accentColorHex}66`,
          }}
        />
      )}

      {/* One UI 9 Top Dynamic Bar / Now Bar */}
      {isAuthenticated && !showLoadingScreen && !isOneUiStudioOpen && !isAwayMode && !isHealthLockdownActive && (
        <OneUiDynamicBar
          styleId={oneUiConfig.dynamicBarStyleId}
          anchor={oneUiConfig.dynamicBarAnchor}
          offsetX={oneUiConfig.dynamicBarOffsetX}
          offsetY={oneUiConfig.dynamicBarOffsetY}
          customLabel={oneUiConfig.dynamicBarCustomLabel}
          accentHex={oneUiConfig.accentColorHex}
          isListening={isJarvisListening}
          isSpeaking={isJarvisSpeaking}
          audioLevel={cockpitAudioLevel}
          waveVisualizerStyle={oneUiConfig.waveVisualizerStyle}
          waveColorTheme={oneUiConfig.waveColorTheme}
          unlockBarAnimStyle={oneUiConfig.unlockBarAnimStyle}
          unlockPulseNonce={unlockPulseNonce}
          unlockMethodLabel={unlockMethodLabel}
          batteryPercent={phoneBatteryPercent}
          isCharging={isPhoneCharging}
          activityState={activityState}
          incomingCallLabel={incomingCallLabel}
          onAnswerCall={async () => {
            const res = await answerOrRejectCallAndroid("answer");
            setIncomingCallLabel(null);
            showToast(res.message);
          }}
          onRejectCall={async () => {
            const res = await answerOrRejectCallAndroid("reject");
            setIncomingCallLabel(null);
            showToast(res.message);
          }}
          onUpdatePosition={(anchor: DynamicBarAnchor, x: number, y: number) => {
            handleUpdateOneUiConfig({
              ...oneUiConfig,
              dynamicBarAnchor: anchor,
              dynamicBarOffsetX: x,
              dynamicBarOffsetY: y,
            });
          }}
          onTapVoice={() => {
            if (speechService.getListeningState()) {
              speechService.stopListening();
            } else {
              manualCancelRef.current = false;
              setCockpitLiveTranscript("");
              speechService.startListening(language);
            }
          }}
          onTapQuickPanel={() => setIsQuickPanelOpen((prev) => !prev)}
        />
      )}

      {/* One UI 9 Swipe-Down Shortcut Switches Drawer */}
      <OneUiQuickPanel
        isOpen={isQuickPanelOpen}
        onClose={() => setIsQuickPanelOpen(false)}
        styleId={oneUiConfig.quickPanelStyleId}
        accentHex={oneUiConfig.accentColorHex}
        isWakeActive={isWakeWordActive}
        onToggleWake={toggleWakeWord}
        onOpenOneUiStudio={() => setIsOneUiStudioOpen(true)}
        onTriggerVoice={() => {
          manualCancelRef.current = false;
          setCockpitLiveTranscript("");
          speechService.startListening(language);
        }}
        onLockNow={() => {
          speechService.cancelSpeech();
          sessionStorage.removeItem("q_nexus_session_auth");
          setIsAuthenticated(false);
        }}
        onToast={showToast}
      />

      {/* One UI 9 Super Charging Animation Overlay */}
      <ChargingAnimationOverlay
        isOpen={isChargingAnimOpen}
        animId={oneUiConfig.chargingAnimId}
        batteryPercent={phoneBatteryPercent}
        customImageUrl={oneUiConfig.customBiometricImageDataUrl || undefined}
        onClose={() => setIsChargingAnimOpen(false)}
      />

      {/* Separate One UI 9 Personalization Studio */}
      <OneUi9Studio
        isOpen={isOneUiStudioOpen}
        onClose={() => setIsOneUiStudioOpen(false)}
        config={oneUiConfig}
        onUpdateConfig={handleUpdateOneUiConfig}
        proactiveAlerts={customization.proactiveAlerts}
        onUpdateProactiveAlerts={handleUpdateProactiveAlerts}
        activityState={activityState}
        onTestChargingAnim={() => setIsChargingAnimOpen(true)}
        onTestUnlockEffect={() => {
          setUnlockMethodLabel("Studio Preview");
          setUnlockPulseNonce((n) => n + 1);
        }}
        onOpenQuickPanel={() => setIsQuickPanelOpen(true)}
        onOpenHomeMode={() => setIsHomeGridMode(true)}
        onOpenLockPreview={() => {
          setIsOneUiStudioOpen(false);
          sessionStorage.removeItem("q_nexus_session_auth");
          setIsAuthenticated(false);
        }}
        onToast={showToast}
      />

      {/* Single Active Interface: Minimalist Deep-Space Cockpit (mounts cleanly as loading completes) */}
      {!showLoadingScreen && (
      <main className="relative z-10 flex-1 min-h-[100dvh] flex flex-col justify-center overflow-hidden">
        <UltraCockpitDashboard
          userProfile={userProfile}
          onUpdateProfile={setUserProfile}
          customization={customization}
          coherence={coherence}
          screenWorkMinutes={Math.floor(screenWorkSeconds / 60)}
          onOpenVoiceModal={() => setIsVoiceModalOpen(true)}
          onOpenAppsMatrix={() => {
            setProjectedHubModule(null);
            setAppsMatrixInitialModule(null);
            setIsAppsMatrixOpen(true);
          }}
          onOpenModule={(moduleId) => {
            setIsAppsMatrixOpen(false);
            setProjectedHubModule(moduleId);
          }}
          activeProjectedModule={projectedHubModule}
          onCloseProjectedModule={() => setProjectedHubModule(null)}
          activeHubNotification={activeHubNotification}
          onOpenSettings={() => {
            setSettingsInitialTab("appearance");
            setIsSettingsOpen(true);
          }}
          onOpenCharacterSettings={() => {
            setSettingsInitialTab("voice");
            setIsSettingsOpen(true);
          }}
          detailViewNonce={detailViewNonce}
          onRenameGenderName={handleRenameGenderName}
          onTriggerHealthLockdown={() => setIsHealthLockdownActive(true)}
          onLockScreen={() => {
            speechService.cancelSpeech();
            setHudHidden(false);
            setProjectedHubModule(null);
            triggerWormhole("Engaging Quantum Lock", () => {
              sessionStorage.removeItem("q_nexus_session_auth");
              localStorage.removeItem("q_nexus_wasi_auth");
              setIsAuthenticated(false);
            });
          }}
          onToggleAwayMode={() => setIsAwayMode(true)}
          language={language}
          voiceGender={customization.activeVoiceMode}
          currentTheme={currentQuantumTheme}
          isSpeaking={isJarvisSpeaking}
          isListening={isJarvisListening}
          isAwayMode={isAwayMode}
          onTriggerWakeWord={() => speechService.triggerWakeWordManually("Hi Jarvis")}
          onPrimeWakeMic={() => {
            speechService.primeMicrophoneAccess().then((ok) => {
              showToast(
                ok
                  ? "Mic Armed — Say 'Hi Jarvis'"
                  : isNativeAndroidApk()
                  ? "Allow Android Microphone permission"
                  : "Allow Mic permission in browser"
              );
            });
          }}
          onSpeakBriefing={() => speakProactiveBriefing("full")}
          wakeStatusText={wakeStatusText}
          wakeReady={wakeReady}
          lastHeardWakeText={lastHeardWakeText}
          cockpitPhase={
            (isJarvisListening
              ? "recording"
              : isProcessingCockpit
              ? "processing"
              : isJarvisSpeaking
              ? "speaking"
              : "galaxy") as CockpitCorePhase
          }
          audioLevel={cockpitAudioLevel}
          liveTranscript={cockpitLiveTranscript}
          onCancelRecording={() => {
            manualCancelRef.current = true;
            followUpAwaitRef.current = false;
            speechService.cancelListening();
            speechService.cancelSpeech();
            setCockpitLiveTranscript("");
          }}
          onSendRecording={() => {
            speechService.stopListening();
          }}
          onStartManualRecording={() => {
            if (speechService.getListeningState()) {
              speechService.stopListening();
              return;
            }
            manualCancelRef.current = false;
            setCockpitLiveTranscript("");
            speechService.startListening(language);
          }}
          onRenameAssistant={handleRenameAssistant}
          cockpitSummaries={cockpitSummaries}
          onClearSummary={() => {
            setCockpitSummaries([]);
            storageService.clearSummaryLogs();
            showToast("Summary Log cleared");
          }}
          topologyIndex={topologyIndex}
          onSelectTopology={(idx) => {
            setAutoCycleTopology(false);
            setTopologyIndex(idx);
            soundEffects.playSubBassPulse();
            soundEffects.playKeyClick(1040);
          }}
          onMorphNextTopology={() => {
            setTopologyIndex((prev) => (prev + 1) % 4);
            soundEffects.playSubBassPulse();
            soundEffects.playKeyClick(1040);
          }}
          spectrumIndex={spectrumIndex}
          onSelectSpectrum={(idx) => {
            setSpectrumIndex(idx);
            soundEffects.playKeyClick(920);
          }}
          energySurge={energySurge}
          onToggleEnergySurge={() => {
            setEnergySurge((prev) => {
              const next = !prev;
              soundEffects.playSurgeSweep(next);
              return next;
            });
          }}
          hudHidden={hudHidden}
          onToggleHudHidden={() => {
            setHudHidden((prev) => {
              const next = !prev;
              soundEffects.playKeyClick(next ? 680 : 940);
              showToast(next ? "HUD Hidden — Press H to Restore" : "HUD Restored");
              return next;
            });
          }}
          onShowIdentityVideo={() => setIsIdentityVideoOpen(true)}
          liveReplyText={cockpitLiveReply}
          pausedByFullscreen={isIdentityVideoOpen || isOneUiStudioOpen}
          mainPanelItems={mainPanelItems}
          onDismissMainPanelItem={(id) => archiveMainPanelItems([id])}
          onArchiveAllMainPanel={() => archiveMainPanelItems()}
          needsWhatsAppAccess={needsWhatsAppAccess}
          onOpenWhatsAppUnlock={() => setProjectedHubModule("comms")}
          onOpenOneUiStudio={() => setIsOneUiStudioOpen(true)}
          onOpenQuickPanel={() => setIsQuickPanelOpen(true)}
          isHomeGridMode={isHomeGridMode}
          onToggleHomeGridMode={() => setIsHomeGridMode((prev) => !prev)}
          onToast={showToast}
          batteryUnrestricted={batteryUnrestricted}
          onRequestBatteryUnrestricted={async () => {
            const res = await requestIgnoreBatteryOptimizationAndroid();
            if (res.unrestricted) {
              setBatteryUnrestricted(true);
              showToast("Always-On Battery Shield Unlocked!");
            } else {
              showToast("Battery setting mein Wasu's Jarvis ko 'Unrestricted' select karein.");
            }
          }}
          onSwitchGender={(nextGender) => {
            const nextAvatar = {
              ...avatarConfig,
              characterGender: nextGender,
              personalityId: nextGender === "male" ? "wasu_male" : "wasi_ki_jan_female",
            };
            const updatedCust: DashboardCustomization = {
              ...customization,
              activeVoiceMode: nextGender,
              avatarConfig: nextAvatar,
            };
            setCustomization(updatedCust);
            storageService.saveCustomization(updatedCust);
            showToast(`Voice Active: ${getCharacterDisplayName(nextAvatar, nextGender)}`);
          }}
        />
      </main>
      )}
        </>
      )}
    </div>
  );
}
