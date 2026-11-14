import React, { useState, useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";
import { soundEffects } from "./services/soundEffects";
import { speechService } from "./services/speechService";
import { storageService, defaultAvatarConfig } from "./services/storage";
import { QuantumBackground3D } from "./components/QuantumBackground3D";
import { SecurityGate } from "./components/SecurityGate";
import { QuantumLoadingScreen } from "./components/QuantumLoadingScreen";
import { UltraCockpitDashboard, CockpitSummaryItem } from "./components/UltraCockpitDashboard";
import { CockpitCorePhase, QUANTUM_SPECTRUMS } from "./components/CentralQuantumCoreHologram";
import { WormholeTransition } from "./components/WormholeTransition";
import { QuantumAppsMatrix, MatrixModuleId } from "./components/QuantumAppsMatrix";
import { QuantumSettingsModal } from "./components/QuantumSettingsModal";
import { VoiceJarvisModal } from "./components/VoiceJarvisModal";
import { HiJarvisWaveOverlay } from "./components/HiJarvisWaveOverlay";
import { AwayAutoPilot } from "./components/AwayAutoPilot";
import { MandatoryHealthLockdown } from "./components/MandatoryHealthLockdown";
import { DesktopInstallModal } from "./components/DesktopInstallModal";
import { IdentityVideoOverlay } from "./components/IdentityVideoOverlay";
import { OfflineIndicator } from "./components/PWAInstallButton";
import { readPhoneHardwareTelemetry } from "./services/systemTelemetry";
import {
  subscribeNativeEvents,
  isNativeAndroidApk,
  getNativePhoneNotifications,
  getNativeCallLogs,
  getNativeSmsMessages,
} from "./services/nativeAndroidBridge";
import {
  LanguageCode,
  UserProfile,
  DashboardCustomization,
  AvatarStudioConfig,
} from "./types";
import { QUANTUM_THEMES, QuantumThemeColor } from "./components/AutoMorphingQuantumLogo";
import {
  getCharacterDisplayName,
  PERSONALITY_MODES,
  isIdentityVideoCommand,
} from "./data/jarvisCatalog";

export default function App() {
  // Authentication & Security State (Enforces hidden 6-digit passkey unlock)
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    if (typeof window !== "undefined") {
      return (
        sessionStorage.getItem("q_nexus_session_auth") === "active" &&
        localStorage.getItem("q_nexus_lock_v2") === "verified"
      );
    }
    return false;
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
  const [isAppsMatrixOpen, setIsAppsMatrixOpen] = useState(false);
  const [appsMatrixInitialModule, setAppsMatrixInitialModule] = useState<MatrixModuleId | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [voiceAutoListenTrigger, setVoiceAutoListenTrigger] = useState(0);
  const [voiceInitialCommand, setVoiceInitialCommand] = useState<{ id: number; text: string } | null>(null);
  const [isWakeWaveOpen, setIsWakeWaveOpen] = useState(false);
  const [waveListenNonce, setWaveListenNonce] = useState(0);
  const [waveInitialCommand, setWaveInitialCommand] = useState<{ id: number; text: string } | null>(null);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [installModalTab, setInstallModalTab] = useState<"android" | "ios" | "apk">("android");
  const [isIdentityVideoOpen, setIsIdentityVideoOpen] = useState(false);

  // Q-DYNAMICS Stage 3 Animation & HUD State
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
  const [cockpitRecordingSeconds, setCockpitRecordingSeconds] = useState(0);
  const [cockpitWaBars, setCockpitWaBars] = useState<number[]>(() => Array(34).fill(18));
  const [cockpitSummaries, setCockpitSummaries] = useState<CockpitSummaryItem[]>([]);
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
  const userProfileRef = useRef(userProfile);
  userProfileRef.current = userProfile;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const appendCockpitSummary = (role: "user" | "assistant" | "reminder", speaker: string, text: string) => {
    const cleaned = text.trim();
    if (!cleaned) return;
    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setCockpitSummaries((prev) => [
      ...prev.slice(-11),
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, role, speaker, text: cleaned, timeStr },
    ]);
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
    const activeCharId = avatarConfig.activeCharacterId || "aurora";
    handleUpdateAvatarConfig({
      ...avatarConfig,
      ...(currentGender === "male"
        ? { customMaleName: cleaned }
        : {
            customFemaleName: cleaned,
            customNicknames: {
              ...(avatarConfig.customNicknames || {}),
              [activeCharId]: cleaned,
            },
          }),
    });
    showToast(`Name updated: ${cleaned}`);
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

  // In-Cockpit WhatsApp-style ticking timer & scrolling waveform bars while listening
  useEffect(() => {
    if (!isJarvisListening) {
      setCockpitRecordingSeconds(0);
      return;
    }
    setCockpitRecordingSeconds(0);
    setCockpitWaBars(Array(34).fill(18));

    const secTimer = setInterval(() => {
      setCockpitRecordingSeconds((s) => s + 1);
    }, 1000);

    const waveTimer = setInterval(() => {
      const lvl = audioLevelRef.current;
      const heightPct = Math.min(100, Math.max(16, Math.round(16 + lvl * 84 + Math.random() * 8)));
      setCockpitWaBars((prev) => [...prev.slice(1), heightPct]);
    }, 85);

    return () => {
      clearInterval(secTimer);
      clearInterval(waveTimer);
    };
  }, [isJarvisListening]);

  // Process Spoken Cockpit Command (Updates Processing 3D Logo -> Speaking 3D Logo -> Live Summary)
  const processCockpitCommandRef = useRef<(rawText: string) => Promise<void>>(async () => {});
  const processCockpitCommand = async (rawText: string) => {
    const text = rawText.trim();
    if (!text) return;

    const charGender = voiceCharRef.current;
    const charName = activeCharNameRef.current;
    const lang = languageRef.current;
    const cfg = avatarConfigRef.current;
    const activePersona =
      PERSONALITY_MODES.find((p) => p.id === cfg?.personalityId) ||
      PERSONALITY_MODES.find((p) => p.voiceGender === charGender) ||
      PERSONALITY_MODES[0];

    appendCockpitSummary("user", "You", text);
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
      }
    ) => {
      const spkGender = voiceOverride?.gender || charGender;
      const spkPitch = voiceOverride?.pitch ?? activePersona.pitch;
      const spkRate = voiceOverride?.rate ?? activePersona.rate;
      appendCockpitSummary("assistant", voiceOverride?.speakerName || charName, reply);
      const fast = cfg?.fastTalkingMode ?? true;
      speechService.speak(reply, {
        lang: langOverride || lang,
        gender: spkGender,
        pitch: spkPitch,
        rate: fast ? Math.max(spkRate, 1.04) : spkRate,
        fast,
        useElevenLabs: voiceOverride?.useElevenLabs ?? cfg?.useElevenLabs,
        elevenLabsVoiceId: cfg?.elevenLabsVoiceId,
        urduSpeechText: voiceOverride?.urduSpeechText,
      });
    };

    try {
      const lower = text.toLowerCase();
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

      if (lower.includes("phone info") || lower.includes("battery") || lower.includes("hardware")) {
        const tel = await readPhoneHardwareTelemetry();
        const msg = `${tel.deviceName}, CPU ${tel.cpuThreads} cores, Battery ${tel.batteryPercent !== null ? `${tel.batteryPercent}%` : "N/A"}, Network ${tel.networkType}.`;
        soundEffects.playBeepConfirm();
        speakCockpitReply(msg);
        return;
      }

      const userTasks = storageService.getTasks();
      const userHealth = storageService.getHealth();
      const userExpenses = storageService.getExpenses();
      const userLifeRecords = readLifeRecords();

      const res = await fetch("/api/jarvis/chat", {
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
      const errReply = "Command process nahi ho saki — dobara bolein.";
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

          const res = await fetch("/api/jarvis/voice-audio", {
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
          const msg = (data.reply || `Ji, main ${charName} hazir hoon.`).trim();
          if (heard) appendCockpitSummary("user", "You", heard);
          appendCockpitSummary("assistant", charName, msg);
          soundEffects.playBeepConfirm();
          if (data.action === "SHOW_IDENTITY_VIDEO") {
            speechService.cancelSpeech();
            handleExecuteVoiceAction("SHOW_IDENTITY_VIDEO", data.actionPayload);
          } else {
            speechService.speak(msg, {
              lang: data.languageDetected || lang,
              gender: charGender,
              pitch: activePersona.pitch,
              rate: activePersona.rate,
              urduSpeechText: data.urduSpeechText,
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
        if (err) appendCockpitSummary("reminder", activeCharNameRef.current, err);
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

    const unsubSpeaking = speechService.subscribeSpeaking(setIsJarvisSpeaking);
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
        // Transition RIGHT INSIDE Main Cockpit to WhatsApp Voice Recording Phase (or process trailing command)
        soundEffects.playBeepConfirm();
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

    // Silent one-time pointer primer so "Hi Jarvis" always works without clicking a Mic logo
    let primed = false;
    const armOnceOnTouch = () => {
      if (primed) return;
      primed = true;
      speechService.primeMicrophoneAccess().catch(() => {});
    };
    window.addEventListener("pointerdown", armOnceOnTouch, { once: true, passive: true });

    const unsubNative = subscribeNativeEvents(
      (nativePhrase) => {
        setIsAuthenticated(true);
        setIsVoiceModalOpen(false);
        setIsWakeWaveOpen(false);
        speechService.startListening(languageRef.current);
        showToast(`Background Wake: '${nativePhrase}'`);
      },
      (notif) => {
        const alertLine = `${notif.appName} par ${notif.title} ka message aaya hai: ${notif.text}`;
        appendCockpitSummary("reminder", `${notif.appName} Alert`, `${notif.title}: ${notif.text}`);
        if (!speechService.getListeningState()) {
          speechService.speak(alertLine, {
            lang: languageRef.current,
            gender: voiceCharRef.current,
          });
        }
      }
    );

    return () => {
      window.removeEventListener("pointerdown", armOnceOnTouch);
      if (heardClearTimerRef.current) clearTimeout(heardClearTimerRef.current);
      speechService.enableWakeWord(false);
      unsubNative();
      unsubSpeaking();
      unsubListening();
    };
  }, [isAuthenticated, isWakeWordActive]);

  // Proactive Companion Engine: Tells User About Pending Tasks, Health & Calls/Notifications Aloud
  const initialBriefingDoneRef = useRef(false);
  const proactiveCycleIndexRef = useRef(0);

  const speakProactiveBriefing = async (mode: "full" | "tasks" | "health" | "comms" = "full") => {
    if (isJarvisListening || isWakeWaveOpen || isVoiceModalOpen || isIdentityVideoOpen) return;

    const charGender = customization.avatarConfig?.characterGender === "male" ? "male" : "female";
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
      const taskSummary =
        pendingTasks.length > 0
          ? language === "en"
            ? `${pendingTasks.length} pending tasks starting with ${pendingTasks[0].title}.`
            : `Aapke ${pendingTasks.length} pending tasks hain jisme sab se pehla ${pendingTasks[0].title} hai.`
          : "";

      const healthSummary = hasHealthLogs
        ? language === "en"
          ? `Water intake logged: ${health.waterDrankGlasses} of 8 glasses.`
          : `Health mein ab tak ${health.waterDrankGlasses} glass pani log hai.`
        : "";

      message = [taskSummary, healthSummary, notifPart].filter(Boolean).join(" ");
      if (!message && lifeRecordsCount === 0) {
        message =
          language === "en"
            ? `${activeCharName} ready. No tasks or life records added yet — add your own items whenever you want reminders.`
            : `${activeCharName} tayar hai. Abhi aapka koi sample ya personal task add nahi hai — jab aap apne tasks add karenge tab main yaad dilaungi.`;
      }
    }

    if (message) {
      appendCockpitSummary("reminder", `${activeCharName} Reminder`, message);
      speechService.speak(message, {
        lang: language,
        gender: charGender,
      });
    }
  };

  // Run one initial proactive briefing after boot loading closes, then periodic smart check-ins every 10 mins
  useEffect(() => {
    if (!isAuthenticated || showLoadingScreen) return;

    let initTimer: ReturnType<typeof setTimeout> | undefined;
    if (!initialBriefingDoneRef.current) {
      initialBriefingDoneRef.current = true;
      initTimer = setTimeout(() => {
        speakProactiveBriefing("full");
      }, 5500);
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

      if (autoLockMins > 0) {
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
  ]);

  // Handle Mobile Home Screen Shortcut Actions (?action=voice or ?action=phone-hub)
  useEffect(() => {
    if (!isAuthenticated || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const action = params.get("action");
    if (action === "voice") {
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

  // Q-DYNAMICS Stage 3: Auto-cycle 4 topologies (every 9s) & 4 color spectrums (every 11s) + 'H' Capture Toggle
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

  const handleUpdateCustomization = (updated: DashboardCustomization) => {
    setCustomization(updated);
    storageService.saveCustomization(updated);
    showToast("Quantum Settings Applied");
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
      setIsIdentityVideoOpen(true);
      showToast(
        `${getCharacterDisplayName(avatarConfig, "male")} & ${getCharacterDisplayName(
          avatarConfig,
          "female"
        )} Hologram Active`
      );
    } else if (action === "OPEN_MEDIA_STUDIO" || action === "SCREEN_HELP") {
      setAppsMatrixInitialModule("studio");
      setIsAppsMatrixOpen(true);
      showToast("Creative Media & Auto-Post Studio Opened!");
    } else if (action === "OPEN_APP") {
      setAppsMatrixInitialModule("desktop");
      setIsAppsMatrixOpen(true);
      showToast(`Launched: ${payload?.appName || "Application"}`);
    } else if (action === "OPEN_AUTOMATION" || action === "SCAN_SCREEN") {
      setAppsMatrixInitialModule("automation");
      setIsAppsMatrixOpen(true);
      showToast("Workflow Automation Engine Activated");
    } else if (action === "OPEN_COMMS") {
      setAppsMatrixInitialModule("comms");
      setIsAppsMatrixOpen(true);
      showToast("🔔 Phone Notifications, Calls & Auto-Reply Hub Opened");
    } else if (action === "OPEN_TASKS") {
      setAppsMatrixInitialModule("memory");
      setIsAppsMatrixOpen(true);
      showToast("📋 Tasks & Reminders Hub Opened");
    } else if (action === "OPEN_COMMUNICATION" || action === "SCHEDULE_MEET" || action === "DECOMPOSE_TASK") {
      setAppsMatrixInitialModule("communication");
      setIsAppsMatrixOpen(true);
      showToast("Omni-Channel & Coding Copilot Activated");
    } else if (action === "OPEN_MAPS" || action === "GPS_TRACK") {
      setAppsMatrixInitialModule("maps");
      setIsAppsMatrixOpen(true);
      showToast("Quantum Geospatial Maps & Radar Activated");
    } else if (action === "OPEN_DEVICES" || action === "FIND_PHONE") {
      setAppsMatrixInitialModule("devices");
      setIsAppsMatrixOpen(true);
      showToast(action === "FIND_PHONE" ? "🚨 Find My Phone Siren Triggered!" : "Digital Device Bridge Activated");
    } else if (action === "PRIVACY_CLOAK") {
      window.dispatchEvent(new CustomEvent("toggle-privacy-cloak"));
      showToast("🔒 High-Privacy Cloak Toggled!");
    } else if (action === "AIR_GAP") {
      window.dispatchEvent(new CustomEvent("toggle-air-gap"));
      showToast("🛡️ Air-Gap Isolation Toggled!");
    } else if (action === "START_FOCUS") {
      setAppsMatrixInitialModule("focus");
      setIsAppsMatrixOpen(true);
      showToast("Quantum Deep Focus Activated");
    } else if (action === "HEALTH_ALERT") {
      setAppsMatrixInitialModule("health");
      setIsAppsMatrixOpen(true);
      showToast(payload?.message || "Health Alert Active");
    } else if (action === "LOG_EXPENSE") {
      setAppsMatrixInitialModule("finance");
      setIsAppsMatrixOpen(true);
      showToast("Opened Financial Management");
    } else if (action === "LOCK_SYSTEM") {
      localStorage.removeItem("q_nexus_wasi_auth");
      sessionStorage.removeItem("q_nexus_session_auth");
      setIsAuthenticated(false);
    } else if (action === "AWAY_MODE") {
      setIsAwayMode(true);
    }
  };

  const activeStageSpectrum = QUANTUM_SPECTRUMS[spectrumIndex % QUANTUM_SPECTRUMS.length];

  // 1. Strictly Lock Screen Interface First - Nothing else renders before unlocking
  if (!isAuthenticated) {
    return (
      <div className="relative min-h-screen bg-[#02050f] text-slate-100 font-rajdhani selection:bg-cyan-500 selection:text-black overflow-hidden flex items-center justify-center">
        <OfflineIndicator />
        <WormholeTransition
          active={wormholeState.active}
          label={wormholeState.label}
          primaryColor={activeStageSpectrum.hex}
          secondaryColor={activeStageSpectrum.secondaryHex}
        />

        {/* Animated Moving 3D Hologram Background on Lock Screen */}
        <QuantumBackground3D
          show3D={customization.show3DBackground}
          customBgUrl={customization.customBgUrl}
          customAccentHex="#00f0ff"
          customSecondaryHex="#8b5cf6"
        />

        {/* Dedicated Q-DYNAMICS Stage 1 + Jarvis Security Gate */}
        <SecurityGate
          onAuthenticated={() => {
            triggerWormhole("Entering Quantum Diagnostics", () => {
              sessionStorage.setItem("q_nexus_session_auth", "active");
              setIsAuthenticated(true);
              setShowLoadingScreen(true);
            });
          }}
          preferredLanguage={language}
        />
      </div>
    );
  }

  // 2. Main Interface & Cockpit Hub - ONLY rendered AFTER unlocking
  return (
    <div className="relative min-h-screen bg-[#02050f] text-slate-100 flex flex-col w-full font-rajdhani selection:bg-cyan-500 selection:text-black overflow-x-hidden">
      <OfflineIndicator />
      <WormholeTransition
        active={wormholeState.active}
        label={wormholeState.label}
        primaryColor={activeStageSpectrum.hex}
        secondaryColor={activeStageSpectrum.secondaryHex}
      />
      {/* Visual Scanline Effect (Separate overlay so all click events work) */}
      {customization.scanlines && <div className="scanlines-overlay" />}

      {/* 3D Quantum Animated Moving Hologram Background + Drifting 3D Physics Formulas */}
      {(customization.activeInterfaceTheme === "quantum_cockpit" ||
        !customization.activeInterfaceTheme ||
        Boolean(customization.customBgUrl)) && (
        <QuantumBackground3D
          show3D={customization.show3DBackground}
          customBgUrl={customization.customBgUrl}
          customAccentHex={activeStageSpectrum.hex}
          customSecondaryHex={activeStageSpectrum.secondaryHex}
          energySurge={energySurge}
        />
      )}

      {/* Mandatory Ergonomic Health Rest Lockdown (Blocks PC until rest timer ends) */}
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

      {/* Away Auto-Pilot Screensaver */}
      {isAwayMode && (
        <AwayAutoPilot
          onReturn={() => setIsAwayMode(false)}
          language={language}
          voiceGender={customization.activeVoiceMode}
        />
      )}

      {/* Unified Quantum Applications Matrix (All Folders & Tools in One Dedicated Interface) */}
      <QuantumAppsMatrix
        isOpen={isAppsMatrixOpen}
        onClose={() => setIsAppsMatrixOpen(false)}
        language={language}
        voiceGender={customization.activeVoiceMode}
        userProfile={userProfile}
        onUpdateProfile={setUserProfile}
        onOpenDesktopInstall={(tab) => {
          setInstallModalTab(tab || "android");
          setIsInstallModalOpen(true);
        }}
        initialModule={appsMatrixInitialModule}
      />

      {/* Quantum Settings & Deep Customization Modal */}
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
      />

      {/* Phone & APK Installation Guide Modal */}
      <DesktopInstallModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        language={language}
        initialTab={installModalTab}
      />

      {/* Stage 2: Q-DYNAMICS System Diagnostics & Boot Check Screen */}
      <QuantumLoadingScreen
        isOpen={showLoadingScreen}
        onComplete={() => {
          triggerWormhole("Initializing 3D Quantum Core", () => {
            setShowLoadingScreen(false);
          });
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

      {/* Single Active Interface: Minimalist Deep-Space Cockpit */}
      <main className="relative z-10 flex-1 min-h-screen flex flex-col justify-center overflow-hidden">
        <UltraCockpitDashboard
          userProfile={userProfile}
          customization={customization}
          coherence={coherence}
          screenWorkMinutes={Math.floor(screenWorkSeconds / 60)}
          onOpenVoiceModal={() => setIsVoiceModalOpen(true)}
          onOpenAppsMatrix={() => {
            setAppsMatrixInitialModule(null);
            setIsAppsMatrixOpen(true);
          }}
          onOpenModule={(moduleId: string) => {
            setAppsMatrixInitialModule(moduleId as MatrixModuleId);
            setIsAppsMatrixOpen(true);
          }}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onTriggerHealthLockdown={() => setIsHealthLockdownActive(true)}
          onLockScreen={() => {
            setHudHidden(false);
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
              showToast(ok ? "Mic Armed — Say 'Hi Jarvis'" : "Allow Mic permission in Chrome");
            });
          }}
          onSpeakBriefing={() => speakProactiveBriefing("full")}
          wakeStatusText={wakeStatusText}
          wakeReady={wakeReady}
          lastHeardWakeText={lastHeardWakeText}
          onOpenPhoneInstall={(tab?: "android" | "ios" | "apk") => {
            setInstallModalTab(tab || "android");
            setIsInstallModalOpen(true);
          }}
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
          recordingSeconds={cockpitRecordingSeconds}
          waWaveBars={cockpitWaBars}
          onCancelRecording={() => {
            speechService.cancelListening();
            setCockpitLiveTranscript("");
          }}
          onSendRecording={() => {
            speechService.stopListening();
          }}
          onStartManualRecording={() => {
            setCockpitLiveTranscript("");
            speechService.startListening(language);
          }}
          onRenameAssistant={handleRenameAssistant}
          cockpitSummaries={cockpitSummaries}
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
        />
      </main>
    </div>
  );
}
