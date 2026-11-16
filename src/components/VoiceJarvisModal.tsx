import React, { useState, useEffect, useRef } from "react";
import {
  AudioWaveform,
  Square,
  Send,
  Sparkles,
  X,
  Terminal,
  Image as ImageIcon,
  Video,
  Monitor,
  Youtube,
  Upload,
  Zap,
} from "lucide-react";
import { soundEffects } from "../services/soundEffects";
import { speechService } from "../services/speechService";
import { storageService } from "../services/storage";
import {
  generateAIOrCanvasImage,
  generateAIOrCanvasVideo,
  captureScreenSnapshotBase64,
} from "../services/mediaStudioGenerator";
import {
  PERSONALITY_MODES,
  ELEVENLABS_VOICE_PRESETS,
  getCharacterDisplayName,
  isIdentityVideoCommand,
} from "../data/jarvisCatalog";
import { readPhoneHardwareTelemetry } from "../services/systemTelemetry";
import {
  isNativeAndroidApk,
  getNativePhoneNotifications,
  replyToPhoneNotification,
  getNativeCallLogs,
  getNativeSmsMessages,
} from "../services/nativeAndroidBridge";
import { togglePhoneFlashlight, triggerHaptic, playLocatorSiren } from "../services/mobileDeviceActions";
import {
  LanguageCode,
  VoiceGender,
  UserProfile,
  JarvisChatMessage,
  AvatarStudioConfig,
} from "../types";

interface VoiceJarvisModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: LanguageCode;
  voiceGender: VoiceGender;
  userProfile: UserProfile;
  avatarConfig?: AvatarStudioConfig;
  onUpdateAvatarConfig?: (next: AvatarStudioConfig) => void;
  onExecuteAction: (action: string, payload?: any) => void;
  autoListenTrigger?: number;
  initialCommand?: { id: number; text: string } | null;
}

const YOUTUBE_REGEX = /(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=[^\s]+|youtu\.be\/[^\s]+|youtube\.com\/shorts\/[^\s]+))/i;

export const VoiceJarvisModal: React.FC<VoiceJarvisModalProps> = ({
  isOpen,
  onClose,
  language,
  voiceGender,
  userProfile,
  avatarConfig,
  onUpdateAvatarConfig,
  onExecuteAction,
  autoListenTrigger = 0,
  initialCommand = null,
}) => {
  const activeGender = avatarConfig?.characterGender || "female";
  const activePersonality =
    PERSONALITY_MODES.find((p) => p.id === avatarConfig?.personalityId) ||
    PERSONALITY_MODES.find((p) => p.voiceGender === activeGender) ||
    PERSONALITY_MODES[0];
  const maleCharName = getCharacterDisplayName(avatarConfig, "male");
  const femaleCharName = getCharacterDisplayName(avatarConfig, "female");
  const activeCharName = getCharacterDisplayName(avatarConfig, activeGender);

  const [messages, setMessages] = useState<JarvisChatMessage[]>([
    {
      id: "initial",
      sender: "jarvis",
      text:
        language === "pa"
          ? `Ji Wasi! Main ${activeCharName} hazir aan. 'Hi Jarvis' ya 'Hi ${activeCharName}' bol ke apna hukam dyo.`
          : language === "en"
          ? `${activeCharName} online, Commander Wasi. Say 'Hi Jarvis' or 'Hi ${activeCharName}' anytime you want me to listen.`
          : `Assalam o Alaikum Wasi Sahab! Main ${activeCharName} hoon. 'Hi Jarvis' ya 'Hi ${activeCharName}' bol kar apna command dein.`,
      language,
      timestamp: "Just now",
      quantumTelemetry: "Coherence: 99.98%",
    },
  ]);

  const [inputVal, setInputVal] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [waveformLevels, setWaveformLevels] = useState<number[]>([30, 60, 45, 80, 20, 65, 90, 40]);
  const [micNotice, setMicNotice] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleSendRef = useRef<(text?: string) => Promise<void>>(async () => {});
  const isProcessingRef = useRef(false);
  isProcessingRef.current = isProcessing;

  const speakWithPersonality = (
    text: string,
    langOverride?: LanguageCode,
    voiceOverride?: {
      pitch?: number;
      rate?: number;
      gender?: VoiceGender;
      useElevenLabs?: boolean;
      urduSpeechText?: string;
    }
  ) => {
    const fast = avatarConfig?.fastTalkingMode ?? true;
    const baseGender = voiceOverride?.gender || activePersonality.voiceGender || voiceGender;
    const basePitch = voiceOverride?.pitch ?? activePersonality.pitch;
    const baseRate = voiceOverride?.rate ?? activePersonality.rate;
    speechService.speak(text, {
      lang: langOverride || language,
      gender: baseGender,
      pitch: basePitch,
      rate: fast ? Math.max(baseRate, 1.06) : baseRate,
      fast,
      useElevenLabs: voiceOverride?.useElevenLabs ?? avatarConfig?.useElevenLabs,
      elevenLabsVoiceId: avatarConfig?.elevenLabsVoiceId,
      urduSpeechText: voiceOverride?.urduSpeechText,
    });
  };

  // Suggested voice commands
  const suggestedCommands = [
    "Mere pending tasks batao",
    "Meri health aur pani ka status batao",
    "Messages aur calls check karo",
    "Mere phone ki info batao",
  ];

  const lastAutoListenRef = useRef(0);
  const lastInitialCmdRef = useRef(0);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Register live command callbacks (never stale!) whenever modal is open
  useEffect(() => {
    if (!isOpen) return;

    speechService.setCommandCallbacks({
      onStart: () => {
        setMicNotice(null);
        setIsListening(true);
      },
      onResult: (transcript, isFinal) => {
        setInputVal(transcript);
        if (isFinal && transcript.trim()) {
          handleSendRef.current(transcript.trim());
        }
      },
      onAudioCaptured: async (audioBase64, mimeType) => {
        if (isProcessingRef.current) return;
        setIsListening(false);
        setIsProcessing(true);
        setMicNotice("Awaaz process ho rahi hai...");
        try {
          const res = await fetch("/api/jarvis/voice-audio", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              audioBase64,
              mimeType,
              language,
              characterGender: activeGender,
              personalityName: activeCharName,
              personalityPrompt: activePersonality.systemPromptModifier,
              userProfile,
              fastMode: avatarConfig?.fastTalkingMode ?? true,
            }),
          });
          if (!res.ok) {
            setMicNotice("Voice server busy — dobara koshish karein ya neeche type karein.");
            setTimeout(() => setMicNotice(null), 5000);
            return;
          }
          const data = await res.json();
          setMicNotice(null);

          if (data.silentAudio) {
            setMicNotice(
              data.reply || "Awaaz clear detect nahi hui. Mic button daba kar kareeb se bolein."
            );
            setTimeout(() => setMicNotice(null), 5000);
            return;
          }

          const heardText = (data.transcript || "").trim();
          const replyText = (data.reply || "Ji Commander, hukam farmaein.").trim();

          setMessages((prev) => [
            ...prev,
            ...(heardText
              ? [
                  {
                    id: Date.now().toString(),
                    sender: "user" as const,
                    text: `🎤 ${heardText}`,
                    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                  },
                ]
              : []),
            {
              id: (Date.now() + 1).toString(),
              sender: "jarvis" as const,
              text: replyText,
              language: data.languageDetected || language,
              actionExecuted: data.action && data.action !== "NONE" ? data.action : undefined,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          ]);

          if (data.action === "SHOW_IDENTITY_VIDEO") {
            speechService.cancelSpeech();
            onExecuteAction("SHOW_IDENTITY_VIDEO", data.actionPayload);
          } else {
            speakWithPersonality(replyText, data.languageDetected || language, {
              urduSpeechText: data.urduSpeechText,
            });
            if (data.action && data.action !== "NONE") {
              onExecuteAction(data.action, data.actionPayload);
            }
          }
        } catch {
          setMicNotice("Voice server error — dobara koshish karein ya neeche type karein.");
          setTimeout(() => setMicNotice(null), 5000);
        } finally {
          setIsProcessing(false);
        }
      },
      onError: (errMsg) => {
        setIsListening(false);
        setMicNotice(errMsg || "Awaaz detect nahi hui. Mic permission check karein.");
        setTimeout(() => setMicNotice(null), 5000);
      },
      onEnd: () => {
        setIsListening(false);
      },
    });
  }, [isOpen, language, activeGender, activePersonality.id, userProfile, avatarConfig?.fastTalkingMode]);

  // Hands-Free "Hi Jarvis" -> silently starts one-shot command mic recording without overlapping speaker TTS
  useEffect(() => {
    if (!isOpen || !autoListenTrigger || autoListenTrigger === lastAutoListenRef.current) return;
    lastAutoListenRef.current = autoListenTrigger;

    const timer = setTimeout(() => {
      const ok = speechService.startListening(language);
      if (!ok) {
        setMicNotice("Allow Microphone permission once so 'Hi Jarvis' records your command.");
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [isOpen, autoListenTrigger, language]);

  // Execute trailing command spoken right after "Hi Jarvis <command>"
  useEffect(() => {
    if (!isOpen || !initialCommand || initialCommand.id === lastInitialCmdRef.current) return;
    lastInitialCmdRef.current = initialCommand.id;
    handleSendRef.current(initialCommand.text);
  }, [isOpen, initialCommand]);

  useEffect(() => {
    if (!isListening) {
      if (isProcessing) {
        const interval = setInterval(() => {
          setWaveformLevels(Array.from({ length: 8 }, () => Math.floor(Math.random() * 55) + 30));
        }, 120);
        return () => clearInterval(interval);
      }
      setWaveformLevels([15, 25, 20, 30, 20, 25, 15, 20]);
      return;
    }

    const unsub = speechService.subscribeAudioLevel((lvl) => {
      const base = Math.max(12, Math.round(lvl * 95));
      setWaveformLevels(
        Array.from({ length: 8 }, (_, idx) => {
          const factor = 0.55 + Math.sin(Date.now() * 0.015 + idx) * 0.45;
          return Math.min(100, Math.max(10, Math.round(base * factor)));
        })
      );
    });
    return unsub;
  }, [isListening, isProcessing]);

  const toggleMic = () => {
    soundEffects.playClick();
    if (isListening) {
      speechService.stopListening();
      setIsListening(false);
    } else {
      const started = speechService.startListening(language);
      if (!started) {
        setMicNotice("Microphone recognition unavailable in this browser. Type your command below.");
        setTimeout(() => setMicNotice(null), 4000);
      }
    }
  };

  // Screen Help / Analysis directly inside Chat
  const handleScreenHelpInChat = async () => {
    if (isProcessing) return;
    soundEffects.playScan();
    try {
      const snapshot = await captureScreenSnapshotBase64();
      await runScreenAnalysisInChat(snapshot, inputVal.trim() || "What is on my screen? Help me optimize or fix any issue.");
    } catch (err: any) {
      setMicNotice(err?.message || "Use Upload Screenshot button next to Screen icon.");
      setTimeout(() => setMicNotice(null), 4000);
    }
  };

  const handleUploadScreenInChat = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      await runScreenAnalysisInChat(dataUrl, inputVal.trim() || "Analyze this screenshot carefully and assist.");
    };
    reader.readAsDataURL(file);
  };

  const runScreenAnalysisInChat = async (snapshot: string, question: string) => {
    setInputVal("");
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        sender: "user",
        text: `🖥️ [Screen Analysis Request]: ${question}`,
        screenSnapshotUrl: snapshot,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
    setIsProcessing(true);
    try {
      const res = await fetch("/api/jarvis/analyze-screen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: snapshot, question, language }),
      });
      const data = await res.json();
      const replyText = data.reply || "Screen analysis completed.";
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: "jarvis",
          text: replyText,
          actionExecuted: "SCREEN_ANALYSIS",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
      soundEffects.playBeepConfirm();
      speakWithPersonality(replyText);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQuickMediaCommand = async (mode: "image" | "video") => {
    const promptText =
      inputVal.trim() ||
      (mode === "image"
        ? "Holographic futuristic Q-Nexus cyber angel"
        : "Cybernetic neon spaceship flying through quantum nebula");
    await handleSendMessage(`/${mode} ${promptText}`);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputVal).trim();
    if (!text || isProcessing) return;

    soundEffects.playClick();
    setInputVal("");
    if (isListening) speechService.stopListening();

    const userMsg: JarvisChatMessage = {
      id: Date.now().toString(),
      sender: "user",
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsProcessing(true);

    try {
      const lower = text.toLowerCase();

      // 0. Instant Holographic Identity Video ("mjy apna ap dikhao" / "apna aap dikhao" / "show yourself")
      if (isIdentityVideoCommand(text)) {
        const reply =
          language === "pa"
            ? `Ji Wasi paji! Dekho, main ${activeCharName} tuhade saamne hazir haan.`
            : language === "en"
            ? `Presenting ${maleCharName} and ${femaleCharName} live on screen, Commander Wasi.`
            : `Ji Wasi Sahab! Dekhein, main ${activeCharName} aapke saamne hazir hoon.`;
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: "jarvis",
            text: reply,
            actionExecuted: "SHOW_IDENTITY_VIDEO",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
        soundEffects.playBeepConfirm();
        speechService.cancelSpeech();
        onExecuteAction("SHOW_IDENTITY_VIDEO");
        return;
      }

      // 0A-1. Live Tasks & Reminders Report
      if (
        lower.includes("task") ||
        lower.includes("kaam") ||
        lower.includes("todo") ||
        lower.includes("reminder")
      ) {
        const tasks = storageService.getTasks();
        const pending = tasks.filter((t) => !t.completed);
        const reply =
          tasks.length === 0
            ? "📋 Abhi aapne koi task ya reminder add nahi kiya. Jab aap tasks add kareinge to main unki detail aur reminder dungi."
            : pending.length > 0
            ? `📋 Tasks Summary: ${pending.length} pending, ${tasks.length - pending.length} completed. Top priority: ${pending[0].title}${pending[0].dueDate ? ` (${pending[0].dueDate})` : ""}.`
            : `✅ Aapke ${tasks.length} add kiye huye tasks complete ho chuke hain.`;
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: "jarvis",
            text: reply,
            actionExecuted: "TASKS_CHECK",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
        speakWithPersonality(reply);
        return;
      }

      // 0A-2. Live Health, Hydration & Ergonomic Status Report
      if (
        lower.includes("health") ||
        lower.includes("sehat") ||
        lower.includes("pani") ||
        lower.includes("water") ||
        lower.includes("sleep") ||
        lower.includes("steps")
      ) {
        const h = storageService.getHealth();
        const hasHealthData =
          h.waterDrankGlasses > 0 ||
          h.dailySteps > 0 ||
          h.sleepHoursLastNight > 0 ||
          h.mealsLogged.length > 0;
        const reply = !hasHealthData
          ? "💚 Abhi tak aapne pani, steps, sleep ya meals ka koi health log add nahi kiya. Health Guard mein apna data add karein."
          : `💚 Health Guard: Water ${h.waterDrankGlasses} glasses, ${h.dailySteps} steps logged, ${h.sleepHoursLastNight}h sleep, ${h.mealsLogged.length} meals logged.`;
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: "jarvis",
            text: reply,
            actionExecuted: "HEALTH_STATUS",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
        speakWithPersonality(reply);
        return;
      }

      // 0B. Real Phone Hardware Status & Telemetry Voice Report
      if (
        lower.includes("phone info") ||
        lower.includes("phone ki info") ||
        lower.includes("battery") ||
        lower.includes("mere phone") ||
        lower.includes("hardware")
      ) {
        const tel = await readPhoneHardwareTelemetry();
        const reply = `📱 Real Phone Info: ${tel.deviceName} (${tel.osLabel}), CPU ${tel.cpuThreads} Threads, GPU ${tel.gpuRenderer}, RAM ${tel.ramApproxGb ?? "--"} GB, Battery ${tel.batteryPercent !== null ? `${tel.batteryPercent}%` : "N/A"}${tel.isCharging ? " (Charging)" : ""}, Network ${tel.networkType}${tel.downlinkMbps ? ` ${tel.downlinkMbps} Mbps` : ""}, Screen ${tel.screenResolution}.`;
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: "jarvis",
            text: reply,
            actionExecuted: "REAL_PHONE_TELEMETRY",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
        speakWithPersonality(reply);
        return;
      }

      // 0B-2. Phone Flashlight / Torch, Vibrate & Locator Siren commands
      if (lower.includes("torch") || lower.includes("flashlight") || lower.includes("flash light")) {
        const turnOn = !(lower.includes("off") || lower.includes("band") || lower.includes("bujha"));
        const res = await togglePhoneFlashlight(turnOn);
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: "jarvis",
            text: `🔦 ${res.message}`,
            actionExecuted: turnOn ? "FLASHLIGHT_ON" : "FLASHLIGHT_OFF",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
        speakWithPersonality(res.message);
        return;
      }

      if (lower.includes("find phone") || lower.includes("find my phone") || lower.includes("phone bajao") || lower.includes("ring phone") || lower.includes("siren")) {
        playLocatorSiren(2600);
        const reply = "🔔 Phone locator siren aur vibration active kar di gayi hai!";
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: "jarvis",
            text: reply,
            actionExecuted: "FIND_PHONE",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
        speakWithPersonality(reply);
        return;
      }

      if (lower.includes("vibrate") || lower.includes("haptic")) {
        triggerHaptic([120, 60, 120, 60, 160]);
        const reply = "📳 Phone haptic vibration pulse bhej diya gaya hai!";
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: "jarvis",
            text: reply,
            actionExecuted: "VIBRATE_PHONE",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
        speakWithPersonality(reply);
        return;
      }

      // 0C. Reply command for Native Android Notifications ("reply to Ali I am coming" / "Ali ko reply karo ...")
      const replyMatch =
        text.match(/reply\s+(?:to\s+)?([^\s:]+)\s+(?:that\s+)?(.+)/i) ||
        text.match(/([^\s]+)\s+ko\s+reply\s+(?:karo|kro|bhejo|do)\s+(.+)/i);
      if (replyMatch) {
        const targetName = replyMatch[1].toLowerCase();
        const replyMsg = replyMatch[2].trim();
        if (!isNativeAndroidApk()) {
          const msg = "Direct notification auto-reply ke liye Android Notification Access enable hona zaroori hai. Phone Alerts hub khol raha hoon.";
          setMessages((prev) => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              sender: "jarvis",
              text: msg,
              actionExecuted: "OPEN_COMMS",
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          ]);
          speakWithPersonality(msg);
          onExecuteAction("OPEN_COMMS");
          return;
        }
        const { notifications } = await getNativePhoneNotifications();
        const found = notifications.find(
          (n) =>
            n.canReply &&
            (n.title.toLowerCase().includes(targetName) || n.appName.toLowerCase().includes(targetName))
        );
        if (found) {
          const sent = await replyToPhoneNotification(found.key, replyMsg);
          const msg = sent.ok
            ? `✅ ${found.appName} par ${found.title} ko reply bhej diya: "${replyMsg}"`
            : sent.message;
          setMessages((prev) => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              sender: "jarvis",
              text: msg,
              actionExecuted: "NATIVE_AUTO_REPLY",
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          ]);
          speakWithPersonality(msg);
          return;
        }
      }

      // 0D. Read Messages, WhatsApp Notifications & Calls Aloud
      if (
        lower.includes("notification") ||
        lower.includes("whatsapp") ||
        lower.includes("messenger") ||
        lower.includes("msg") ||
        lower.includes("message") ||
        lower.includes("calls") ||
        lower.includes("call log") ||
        lower.includes("missed call")
      ) {
        if (!isNativeAndroidApk()) {
          const honestMsg =
            "Phone Alerts & Notifications hub khol raha hoon — live messages, missed calls aur SMS yahan sync hotay hain jab phone ki Notification Access enabled ho.";
          setMessages((prev) => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              sender: "jarvis",
              text: honestMsg,
              actionExecuted: "OPEN_COMMS",
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          ]);
          speakWithPersonality(honestMsg);
          onExecuteAction("OPEN_COMMS");
          return;
        }

        const [notifRes, callRes, smsRes] = await Promise.all([
          getNativePhoneNotifications(),
          getNativeCallLogs(),
          getNativeSmsMessages(),
        ]);

        const parts: string[] = [];
        if (notifRes.notifications.length > 0) {
          parts.push(
            `App Notifications (${notifRes.notifications.length}): ` +
              notifRes.notifications
                .slice(0, 4)
                .map((n) => `${n.appName} (${n.title}: ${n.text})`)
                .join(" | ")
          );
        }
        if (callRes.length > 0) {
          parts.push(
            `Recent Calls: ` +
              callRes
                .slice(0, 3)
                .map((c) => `${c.type} ${c.name || c.number}`)
                .join(", ")
          );
        }
        if (smsRes.length > 0) {
          parts.push(
            `Latest SMS: ${smsRes[0].address}: ${smsRes[0].body}`
          );
        }
        const summary =
          parts.length > 0
            ? parts.join("\n\n")
            : notifRes.listenerEnabled
            ? "Is waqt koi naya message ya call notification nahi mila."
            : "Notification Access disabled hai — Phone Control Hub mein ja kar Notification Listener ON karein.";

        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: "jarvis",
            text: summary,
            actionExecuted: "OPEN_COMMS",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
        speakWithPersonality(summary);
        onExecuteAction("OPEN_COMMS");
        return;
      }

      // 2. Image Generation in Chat (/image or natural trigger)
      if (
        lower.startsWith("/image") ||
        lower.startsWith("generate image") ||
        lower.startsWith("create image") ||
        lower.includes("tasveer banao")
      ) {
        const cleanPrompt = text.replace(/^(\/image|generate image|create image|tasveer banao)/i, "").trim() || text;
        const imgRes = await generateAIOrCanvasImage(cleanPrompt, "1:1", "Quantum Cyberpunk");
        const reply = `✨ Image generated via ${imgRes.source.toUpperCase()} for: "${cleanPrompt}"`;
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: "jarvis",
            text: reply,
            imageUrl: imgRes.imageUrl,
            actionExecuted: "IN_CHAT_IMAGE_GEN",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
        soundEffects.playBeepConfirm();
        speakWithPersonality(reply);
        return;
      }

      // 3. Video Generation in Chat (/video or natural trigger)
      if (
        lower.startsWith("/video") ||
        lower.startsWith("generate video") ||
        lower.startsWith("create video") ||
        lower.includes("video banao")
      ) {
        const cleanPrompt = text.replace(/^(\/video|generate video|create video|video banao)/i, "").trim() || text;
        const vidRes = await generateAIOrCanvasVideo(cleanPrompt, "16:9", "5s");
        const reply = `🎬 Video synthesized via ${vidRes.source.toUpperCase()} for: "${cleanPrompt}"`;
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: "jarvis",
            text: reply,
            videoUrl: vidRes.videoUrl,
            actionExecuted: "IN_CHAT_VIDEO_GEN",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
        soundEffects.playQuantumStartup();
        speakWithPersonality(reply);
        return;
      }

      // 4. YouTube Link Analysis in Chat
      const ytMatch = text.match(YOUTUBE_REGEX);
      if (ytMatch) {
        const ytUrl = ytMatch[1];
        const res = await fetch("/api/jarvis/analyze-youtube", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            youtubeUrl: ytUrl,
            question: text.replace(ytUrl, "").trim() || "Summarize key points & takeaways from this YouTube video.",
            language,
          }),
        });
        const data = await res.json();
        const replyText = data.reply || "YouTube analysis complete.";
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: "jarvis",
            text: replyText,
            youtubeMeta: data.meta,
            actionExecuted: "YOUTUBE_ANALYSIS",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
        soundEffects.playBeepConfirm();
        speakWithPersonality(replyText);
        return;
      }

      // 5. Standard Fast-Talk Trilingual Chat
      const response = await fetch("/api/jarvis/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          language,
          userProfile,
          characterGender: activeGender,
          personalityName: activeCharName,
          personalityPrompt: activePersonality.systemPromptModifier,
          fastMode: avatarConfig?.fastTalkingMode ?? true,
          currentContext: {
            time: new Date().toISOString(),
            platform: "Wasu's Jarvis Mobile OS",
            userTasks: storageService.getTasks(),
            userLifeRecords: (() => {
              try {
                return JSON.parse(localStorage.getItem("q_nexus_life_records") || "[]");
              } catch {
                return [];
              }
            })(),
            userHealth: storageService.getHealth(),
            userExpenses: storageService.getExpenses(),
          },
        }),
      });

      const data = await response.json();
      const replyText = data.reply || "Quantum Telemetry processed your command, Commander Wasi.";

      const jarvisMsg: JarvisChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: "jarvis",
        text: replyText,
        language: data.languageDetected || language,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        actionExecuted: data.action !== "NONE" ? data.action : undefined,
        quantumTelemetry: data.quantumStatus || "Coherence 99.98%",
      };

      setMessages((prev) => [...prev, jarvisMsg]);
      soundEffects.playBeepConfirm();
      if (data.action === "SHOW_IDENTITY_VIDEO") {
        speechService.cancelSpeech();
        onExecuteAction("SHOW_IDENTITY_VIDEO", data.actionPayload);
      } else {
        speakWithPersonality(replyText, data.languageDetected || language, {
          urduSpeechText: data.urduSpeechText,
        });

        if (data.action && data.action !== "NONE") {
          onExecuteAction(data.action, data.actionPayload);
        }
      }
    } catch (e) {
      console.warn("Voice modal chat fallback:", e);
      const fallbackReply =
        language === "pa"
          ? "Wasi paji, command receive ho gayi ae. Quantum core offline macro active kar reha ae."
          : "Wasi Sahab, aapka hukam receive ho gaya hai. Main local quantum engine se action execute kar raha hoon.";

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: "jarvis",
          text: fallbackReply,
          language,
          timestamp: "Just now",
        },
      ]);
      speakWithPersonality(fallbackReply);
    } finally {
      setIsProcessing(false);
    }
  };

  handleSendRef.current = handleSendMessage;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-3xl h-[88vh] bg-slate-950/95 border border-cyan-500/40 rounded-2xl shadow-2xl shadow-cyan-950/80 flex flex-col overflow-hidden font-rajdhani">
        {/* Glow Header */}
        <div className="px-5 py-3 bg-slate-900/90 border-b border-cyan-500/30 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-cyan-300">
              <Sparkles className="w-4 h-4 animate-spin" style={{ animationDuration: "8s" }} />
            </div>
            <div>
              <h3 className="font-orbitron font-bold text-sm md:text-base text-cyan-300 glow-text-cyan">
                QUANTUM FAST-TALK & MEDIA CHAT
              </h3>
              <p className="text-[10px] font-mono text-slate-400">
                {activePersonality.emoji} {activeCharName} ({activeGender === "male" ? "Male" : "Female"}) • {language.toUpperCase()} •{" "}
                {avatarConfig?.useElevenLabs ? "ElevenLabs" : "Pakistani Urdu HD"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[10px] font-mono">
            {/* Strictly 2 Voice Personas Switcher */}
            {avatarConfig && onUpdateAvatarConfig && (
              <div className="flex items-center rounded-lg bg-slate-950 border border-cyan-500/40 p-0.5">
                <button
                  type="button"
                  onClick={() => {
                    const maleVoice = ELEVENLABS_VOICE_PRESETS.find((v) => v.gender === "male");
                    onUpdateAvatarConfig({
                      ...avatarConfig,
                      characterGender: "male",
                      personalityId: "wasu_male",
                      ...(maleVoice ? { elevenLabsVoiceId: maleVoice.id } : {}),
                    });
                  }}
                  className={`px-2 py-0.5 rounded cursor-pointer transition ${
                    activeGender === "male"
                      ? "bg-sky-500 text-slate-950 font-bold"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  🛡️ {maleCharName}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const femaleVoice = ELEVENLABS_VOICE_PRESETS.find((v) => v.gender === "female");
                    onUpdateAvatarConfig({
                      ...avatarConfig,
                      characterGender: "female",
                      personalityId: "wasi_ki_jan_female",
                      ...(femaleVoice ? { elevenLabsVoiceId: femaleVoice.id } : {}),
                    });
                  }}
                  className={`px-2 py-0.5 rounded cursor-pointer transition ${
                    activeGender === "female"
                      ? "bg-cyan-400 text-slate-950 font-bold"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  💠 {femaleCharName}
                </button>
              </div>
            )}

            {/* Fast Talk Toggle */}
            {avatarConfig && onUpdateAvatarConfig && (
              <button
                type="button"
                onClick={() =>
                  onUpdateAvatarConfig({
                    ...avatarConfig,
                    fastTalkingMode: !avatarConfig.fastTalkingMode,
                  })
                }
                className={`px-2 py-1 rounded-lg border flex items-center gap-1 cursor-pointer ${
                  avatarConfig.fastTalkingMode
                    ? "bg-emerald-950 border-emerald-400 text-emerald-300 font-bold"
                    : "bg-slate-900 border-slate-700 text-slate-400"
                }`}
              >
                <Zap className="w-3 h-3" />
                <span>FAST</span>
              </button>
            )}

            <button
              onClick={() => {
                speechService.cancelSpeech();
                onClose();
              }}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Audio Waveform Visualizer Bar */}
        <div className="px-5 py-2 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 h-5">
              {waveformLevels.map((lvl, idx) => (
                <div
                  key={idx}
                  className={`w-1 rounded-full transition-all duration-75 ${
                    isListening ? "bg-amber-400" : isProcessing ? "bg-purple-500" : "bg-cyan-500"
                  }`}
                  style={{ height: `${Math.max(5, (lvl / 100) * 20)}px` }}
                />
              ))}
            </div>
            <span className="text-[11px] font-mono text-slate-300">
              {isListening
                ? "🔴 WAVE LISTENING (Auto-stops when done)..."
                : isProcessing
                ? "⏳ PROCESSING VOICE..."
                : 'Mic OFF — Say "Hi Jarvis" for Wave Listener'}
            </span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/30">
            WAVE TRIGGER
          </span>
        </div>

        {/* Chat Stream */}
        <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[85%] md:max-w-[78%] rounded-2xl p-3.5 shadow-lg space-y-2 ${
                  msg.sender === "user"
                    ? "bg-cyan-600/20 border border-cyan-400/50 text-slate-100 rounded-br-none"
                    : "bg-slate-900/90 border border-purple-500/30 text-slate-200 rounded-bl-none"
                }`}
              >
                <div className="flex items-center justify-between gap-4 text-[10px] font-mono opacity-60">
                  <span>{msg.sender === "user" ? "COMMANDER WASI" : activeCharName.toUpperCase()}</span>
                  <span>{msg.timestamp}</span>
                </div>

                {msg.screenSnapshotUrl && (
                  <img
                    src={msg.screenSnapshotUrl}
                    alt="Screen Capture"
                    className="w-full max-h-44 object-cover rounded-xl border border-cyan-500/40"
                  />
                )}

                {msg.youtubeMeta && (
                  <div className="p-2 rounded-xl bg-rose-950/40 border border-rose-500/40 flex items-center gap-3">
                    {msg.youtubeMeta.thumbnailUrl && (
                      <img
                        src={msg.youtubeMeta.thumbnailUrl}
                        alt={msg.youtubeMeta.title}
                        className="w-20 h-14 object-cover rounded-lg"
                      />
                    )}
                    <div className="text-xs font-mono">
                      <div className="text-rose-300 font-bold flex items-center gap-1">
                        <Youtube className="w-3.5 h-3.5" />
                        <span>{msg.youtubeMeta.title}</span>
                      </div>
                      {msg.youtubeMeta.author && (
                        <div className="text-[10px] text-slate-400">{msg.youtubeMeta.author}</div>
                      )}
                    </div>
                  </div>
                )}

                <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</div>

                {msg.imageUrl && (
                  <img
                    src={msg.imageUrl}
                    alt="Generated AI Image"
                    className="w-full max-h-64 object-contain rounded-xl border border-purple-400/50"
                  />
                )}

                {msg.videoUrl && (
                  <video
                    src={msg.videoUrl}
                    controls
                    autoPlay
                    loop
                    className="w-full max-h-64 rounded-xl border border-cyan-400/50 bg-black"
                  />
                )}

                {msg.actionExecuted && (
                  <div className="pt-2 border-t border-slate-700/60 flex items-center gap-1.5 text-[11px] font-mono text-emerald-400">
                    <Terminal className="w-3.5 h-3.5" />
                    <span>EXECUTED: [{msg.actionExecuted}]</span>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Pills */}
        <div className="px-4 py-1.5 bg-slate-900/40 border-t border-slate-800 flex items-center gap-2 overflow-x-auto text-[11px] font-mono">
          <span className="text-slate-500 shrink-0">QUICK:</span>
          {suggestedCommands.map((cmd, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(cmd)}
              className="shrink-0 px-2.5 py-0.5 rounded-full bg-slate-800/80 hover:bg-cyan-950 hover:text-cyan-300 border border-slate-700 text-slate-300 transition cursor-pointer"
            >
              {cmd}
            </button>
          ))}
        </div>

        {/* Input & Multimedia Chat Action Bar */}
        <div className="p-3 bg-slate-900 border-t border-cyan-500/20 space-y-2">
          {micNotice && (
            <div className="p-2 rounded-lg bg-amber-950/60 border border-amber-500/40 text-amber-300 text-xs font-mono">
              {micNotice}
            </div>
          )}

          {/* Multimodal Quick Tools */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
            <button
              type="button"
              onClick={() => handleQuickMediaCommand("image")}
              disabled={isProcessing}
              className="px-2.5 py-1 rounded-lg bg-purple-950/70 hover:bg-purple-900 border border-purple-500/50 text-purple-200 flex items-center gap-1 cursor-pointer"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Image Gen</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickMediaCommand("video")}
              disabled={isProcessing}
              className="px-2.5 py-1 rounded-lg bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-200 flex items-center gap-1 cursor-pointer"
            >
              <Video className="w-3.5 h-3.5" />
              <span>Video Gen</span>
            </button>
            <button
              type="button"
              onClick={handleScreenHelpInChat}
              disabled={isProcessing}
              className="px-2.5 py-1 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-200 flex items-center gap-1 cursor-pointer"
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Capture Screen Help</span>
            </button>
            <label className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 flex items-center gap-1 cursor-pointer">
              <Upload className="w-3.5 h-3.5 text-cyan-400" />
              <span>Upload Screen</span>
              <input type="file" accept="image/*" onChange={handleUploadScreenInChat} className="hidden" />
            </label>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <button
              type="button"
              onClick={toggleMic}
              title={isListening ? "Stop Wave Capture" : "Start Wave Capture"}
              className={`p-2.5 rounded-xl transition cursor-pointer ${
                isListening
                  ? "bg-amber-500 text-slate-950 animate-pulse"
                  : "bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-cyan-400 border border-cyan-500/30"
              }`}
            >
              {isListening ? <Square className="w-5 h-5" /> : <AudioWaveform className="w-5 h-5" />}
            </button>

            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="Ask anything, paste YouTube URL, /image <prompt>, /video <prompt>..."
              className="flex-1 px-3.5 py-2.5 bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none font-mono text-xs md:text-sm"
            />

            <button
              type="submit"
              disabled={!inputVal.trim() || isProcessing}
              className="p-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 font-bold transition cursor-pointer"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
