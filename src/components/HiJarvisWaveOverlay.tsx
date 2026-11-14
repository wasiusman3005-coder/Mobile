import React, { useEffect, useState, useRef } from "react";
import { X, Sparkles, CheckSquare, Heart, Bell, MessageSquare, Radio, Trash2, Send, AudioWaveform } from "lucide-react";
import { speechService } from "../services/speechService";
import { soundEffects } from "../services/soundEffects";
import { storageService } from "../services/storage";
import {
  PERSONALITY_MODES,
  getCharacterDisplayName,
  isIdentityVideoCommand,
} from "../data/jarvisCatalog";
import { readPhoneHardwareTelemetry } from "../services/systemTelemetry";
import {
  isNativeAndroidApk,
  getNativePhoneNotifications,
  getNativeCallLogs,
  getNativeSmsMessages,
  replyToPhoneNotification,
} from "../services/nativeAndroidBridge";
import {
  LanguageCode,
  VoiceGender,
  UserProfile,
  AvatarStudioConfig,
} from "../types";

interface HiJarvisWaveOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenFullChat: () => void;
  language: LanguageCode;
  voiceGender: VoiceGender;
  userProfile: UserProfile;
  avatarConfig: AvatarStudioConfig;
  autoListenNonce: number;
  initialCommand?: { id: number; text: string } | null;
  onExecuteAction: (action: string, payload?: any) => void;
}

export const HiJarvisWaveOverlay: React.FC<HiJarvisWaveOverlayProps> = ({
  isOpen,
  onClose,
  onOpenFullChat,
  language,
  voiceGender,
  userProfile,
  avatarConfig,
  autoListenNonce,
  initialCommand,
  onExecuteAction,
}) => {
  const activeGender = avatarConfig?.characterGender === "male" ? "male" : "female";
  const activePersonality =
    PERSONALITY_MODES.find((p) => p.id === avatarConfig?.personalityId) ||
    PERSONALITY_MODES.find((p) => p.voiceGender === activeGender) ||
    PERSONALITY_MODES[0];
  const activeCharName = getCharacterDisplayName(avatarConfig, activeGender);

  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [phaseTick, setPhaseTick] = useState(0);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [waWaveBars, setWaWaveBars] = useState<number[]>(() => Array(34).fill(18));
  const [liveTranscript, setLiveTranscript] = useState("");
  const [replyText, setReplyText] = useState("");
  const [actionBadge, setActionBadge] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const audioLevelRef = useRef(0);
  audioLevelRef.current = audioLevel;

  const isProcessingRef = useRef(false);
  isProcessingRef.current = isProcessing;
  const lastListenNonceRef = useRef(0);
  const lastInitCmdRef = useRef(0);
  const handleCommandRef = useRef<(text: string) => Promise<void>>(async () => {});

  const speakReply = (
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
      rate: fast ? Math.max(baseRate, 1.04) : baseRate,
      fast,
      useElevenLabs: voiceOverride?.useElevenLabs ?? avatarConfig?.useElevenLabs,
      elevenLabsVoiceId: avatarConfig?.elevenLabsVoiceId,
      urduSpeechText: voiceOverride?.urduSpeechText,
    });
  };

  // Subscribe to speaking & live audio wave levels
  useEffect(() => {
    if (!isOpen) return;
    const unsubSpeak = speechService.subscribeSpeaking(setIsSpeaking);
    const unsubLevel = speechService.subscribeAudioLevel((lvl) => setAudioLevel(lvl));

    let rafId = 0;
    const animate = () => {
      setPhaseTick((t) => (t + 0.14) % (Math.PI * 200));
      rafId = requestAnimationFrame(animate);
    };
    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      unsubSpeak();
      unsubLevel();
    };
  }, [isOpen]);

  // WhatsApp-style ticking timer & scrolling voice waveform bars while recording
  useEffect(() => {
    if (!isOpen || !isListening) {
      if (!isListening) setRecordingSeconds(0);
      return;
    }
    setRecordingSeconds(0);
    setWaWaveBars(Array(34).fill(18));

    const secTimer = setInterval(() => {
      setRecordingSeconds((s) => s + 1);
    }, 1000);

    const waveTimer = setInterval(() => {
      const lvl = audioLevelRef.current;
      const heightPct = Math.min(100, Math.max(16, Math.round(16 + lvl * 84 + Math.random() * 8)));
      setWaWaveBars((prev) => [...prev.slice(1), heightPct]);
    }, 85);

    return () => {
      clearInterval(secTimer);
      clearInterval(waveTimer);
    };
  }, [isOpen, isListening]);

  // Process spoken or quick-chip commands with full awareness of Tasks, Health, Calls/Notifications, Phone Info & AI Chat
  const processSpokenCommand = async (rawText: string) => {
    const text = rawText.trim();
    if (!text || isProcessingRef.current) return;

    setLiveTranscript(text);
    setErrorMsg(null);
    setIsListening(false);
    setIsProcessing(true);
    setActionBadge(null);

    try {
      const lower = text.toLowerCase();

      // 0. Holographic Identity Video Trigger ("mjy apna ap dikhao")
      if (isIdentityVideoCommand(text)) {
        const msg =
          language === "pa"
            ? `Ji Wasi paji! Dekho, main ${activeCharName} tuhade saamne hazir haan.`
            : language === "en"
            ? `Presenting Wasu and Wasi ki Jan live on screen, Commander Wasi.`
            : `Ji Wasi Sahab! Dekhein, main ${activeCharName} aapke saamne hazir hoon.`;
        setReplyText(msg);
        setActionBadge("SHOW_IDENTITY_VIDEO");
        soundEffects.playBeepConfirm();
        speechService.cancelSpeech();
        onExecuteAction("SHOW_IDENTITY_VIDEO");
        return;
      }

      // 1. Tasks intent
      if (
        lower.includes("task") ||
        lower.includes("kaam") ||
        lower.includes("todo") ||
        lower.includes("routine") ||
        lower.includes("reminder")
      ) {
        const tasks = storageService.getTasks();
        const pending = tasks.filter((t) => !t.completed);
        const completedCount = tasks.length - pending.length;
        const msg =
          tasks.length === 0
            ? language === "en"
              ? "You haven't added any tasks yet. Add your tasks and I will track and remind you."
              : "Abhi aapne koi task add nahi kiya. Jab aap apne tasks add kareinge, main unki detail aur reminder dungi."
            : pending.length > 0
            ? language === "en"
              ? `You have ${pending.length} pending tasks and ${completedCount} completed. Top priority: ${pending[0].title}${pending[0].dueDate ? ` (${pending[0].dueDate})` : ""}.`
              : `Aapke ${pending.length} pending tasks hain aur ${completedCount} mukammal ho chuke hain. Sab se zaroori kaam: ${pending[0].title}${pending[0].dueDate ? ` (${pending[0].dueDate})` : ""}.`
            : language === "en"
            ? `All ${tasks.length} added tasks are completed!`
            : `Aapke ${tasks.length} add kiye huye tasks mukammal ho chuke hain.`;

        setReplyText(msg);
        setActionBadge("TASKS CHECKED");
        soundEffects.playBeepConfirm();
        speakReply(msg);
        onExecuteAction("OPEN_TASKS");
        return;
      }

      // 2. Health / Water / Eye rest intent
      if (
        lower.includes("health") ||
        lower.includes("sehat") ||
        lower.includes("pani") ||
        lower.includes("water") ||
        lower.includes("eye") ||
        lower.includes("posture") ||
        lower.includes("steps")
      ) {
        const health = storageService.getHealth();
        const hasHealthData =
          health.waterDrankGlasses > 0 ||
          health.dailySteps > 0 ||
          health.sleepHoursLastNight > 0 ||
          health.mealsLogged.length > 0;
        const msg = !hasHealthData
          ? language === "en"
            ? "No health, water, steps, or sleep logs recorded yet. Add your daily health entry to track it here."
            : "Abhi tak aapne pani, steps ya neend ka koi health record add nahi kiya. Health Guard mein apni real entry add karein."
          : language === "en"
          ? `Health Status: ${health.waterDrankGlasses} glasses water logged, ${health.dailySteps} steps today, and ${health.sleepHoursLastNight} hours sleep.`
          : `Health Update: Aaj aapne ${health.waterDrankGlasses} glasses pani piya hai, ${health.dailySteps} steps aur ${health.sleepHoursLastNight} ghante neend record ki hai.`;

        setReplyText(msg);
        setActionBadge("HEALTH GUARD");
        soundEffects.playBeepConfirm();
        speakReply(msg);
        onExecuteAction("HEALTH_ALERT", { message: "Health Check Complete" });
        return;
      }

      // 3. Auto-reply via voice ("reply to Ali ...")
      const replyMatch =
        text.match(/reply\s+(?:to\s+)?([^\s:]+)\s+(?:that\s+)?(.+)/i) ||
        text.match(/([^\s]+)\s+ko\s+reply\s+(?:karo|kro|bhejo|do)\s+(.+)/i);
      if (replyMatch) {
        const targetName = replyMatch[1].toLowerCase();
        const replyMsg = replyMatch[2].trim();
        if (!isNativeAndroidApk()) {
          const msg =
            "WhatsApp aur SMS auto-reply ke liye Q-NEXUS Android APK install hona zaroori hai. Phone Control Hub khol diya gaya hai.";
          setReplyText(msg);
          setActionBadge("OPEN_COMMS");
          speakReply(msg);
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
            ? `${found.appName} par ${found.title} ko reply bhej diya hai: ${replyMsg}`
            : sent.message;
          setReplyText(msg);
          setActionBadge("NATIVE_AUTO_REPLY");
          speakReply(msg);
          return;
        }
      }

      // 4. Calls & Notifications intent
      if (
        lower.includes("notification") ||
        lower.includes("whatsapp") ||
        lower.includes("messenger") ||
        lower.includes("msg") ||
        lower.includes("message") ||
        lower.includes("calls") ||
        lower.includes("call")
      ) {
        if (!isNativeAndroidApk()) {
          const msg =
            "Aap abhi Chrome browser mein hain jahan Android security ki wajah se WhatsApp ya Call Logs blocked hoti hain. Android APK install kar ke Notification Access allow karne par main har call aur message bol kar sunaungi.";
          setReplyText(msg);
          setActionBadge("OPEN_COMMS");
          speakReply(msg);
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
            `${notifRes.notifications.length} notifications: ` +
              notifRes.notifications
                .slice(0, 3)
                .map((n) => `${n.appName} par ${n.title}: ${n.text}`)
                .join(". ")
          );
        }
        if (callRes.length > 0) {
          parts.push(
            `Recent calls: ` +
              callRes
                .slice(0, 3)
                .map((c) => `${c.type} ${c.name || c.number}`)
                .join(", ")
          );
        }
        if (smsRes.length > 0) {
          parts.push(`Latest SMS ${smsRes[0].address}: ${smsRes[0].body}`);
        }
        const msg =
          parts.length > 0
            ? parts.join(". ")
            : notifRes.listenerEnabled
            ? "Is waqt koi naya message ya call notification nahi hai."
            : "Notification Access disabled hai — Phone Control Hub mein ON karein.";

        setReplyText(msg);
        setActionBadge("CALLS & NOTIFICATIONS");
        soundEffects.playBeepConfirm();
        speakReply(msg);
        onExecuteAction("OPEN_COMMS");
        return;
      }

      // 5. Phone hardware specs
      if (
        lower.includes("phone info") ||
        lower.includes("battery") ||
        lower.includes("hardware")
      ) {
        const tel = await readPhoneHardwareTelemetry();
        const msg = `Phone Info: ${tel.deviceName}, CPU ${tel.cpuThreads} cores, Battery ${tel.batteryPercent !== null ? `${tel.batteryPercent}%` : "N/A"}, Network ${tel.networkType}.`;
        setReplyText(msg);
        setActionBadge("PHONE TELEMETRY");
        speakReply(msg);
        return;
      }
      // 6. General Gemini AI Chat response
      const res = await fetch("/api/jarvis/chat", {
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
            platform: "Hi Jarvis Wave Interface",
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
      const data = await res.json();
      const msg = (data.reply || "Ji Commander Wasi, command execute ho gayi hai.").trim();
      setReplyText(msg);
      if (data.action && data.action !== "NONE") {
        setActionBadge(data.action);
        onExecuteAction(data.action, data.actionPayload);
      }
      soundEffects.playBeepConfirm();
      if (data.action === "SHOW_IDENTITY_VIDEO") {
        speechService.cancelSpeech();
      } else {
        speakReply(msg, data.languageDetected || language, {
          urduSpeechText: data.urduSpeechText,
        });
      }
    } catch (err) {
      console.error("HiJarvis wave command error:", err);
      const fallback = "Wasi Sahab, command sun li hai — server connection check karein ya Full Chat kholein.";
      setReplyText(fallback);
      speakReply(fallback);
    } finally {
      setIsProcessing(false);
    }
  };

  handleCommandRef.current = processSpokenCommand;

  // Bind command callbacks ONLY while Wave Overlay is open
  useEffect(() => {
    if (!isOpen) return;

    speechService.setCommandCallbacks({
      onStart: () => {
        setErrorMsg(null);
        setIsListening(true);
      },
      onResult: (transcript, isFinal) => {
        setLiveTranscript(transcript);
        if (isFinal && transcript.trim()) {
          handleCommandRef.current(transcript.trim());
        }
      },
      onAudioCaptured: async (audioBase64, mimeType) => {
        if (isProcessingRef.current) return;
        setIsListening(false);
        setIsProcessing(true);
        setErrorMsg(null);
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
            setErrorMsg("Voice processing failed — please say 'Hi Jarvis' again.");
            return;
          }
          const data = await res.json();
          if (data.silentAudio) {
            setErrorMsg(data.reply || "Awaaz clear nahi aayi — dobara 'Hi Jarvis' bolein.");
            return;
          }
          const heard = (data.transcript || "").trim();
          const msg = (data.reply || "Ji Commander, hukam farmaein.").trim();
          if (heard) setLiveTranscript(heard);
          setReplyText(msg);
          if (data.action && data.action !== "NONE") {
            setActionBadge(data.action);
            onExecuteAction(data.action, data.actionPayload);
          }
          soundEffects.playBeepConfirm();
          if (data.action === "SHOW_IDENTITY_VIDEO") {
            speechService.cancelSpeech();
          } else {
            speakReply(msg, data.languageDetected || language, {
              urduSpeechText: data.urduSpeechText,
            });
          }
        } catch {
          setErrorMsg("Voice processing failed — please say 'Hi Jarvis' again.");
        } finally {
          setIsProcessing(false);
        }
      },
      onError: (err) => {
        setIsListening(false);
        setErrorMsg(err || "Awaaz detect nahi hui. Dobara 'Hi Jarvis' bolein.");
      },
      onEnd: () => {
        setIsListening(false);
      },
    });
  }, [isOpen, language, activeGender, activePersonality.id, userProfile, avatarConfig?.fastTalkingMode]);

  // Start WhatsApp voice recording phase immediately when triggered by "Hi Jarvis"
  useEffect(() => {
    if (!isOpen || !autoListenNonce || autoListenNonce === lastListenNonceRef.current) return;
    lastListenNonceRef.current = autoListenNonce;
    setLiveTranscript("");
    setReplyText("");
    setActionBadge(null);
    setErrorMsg(null);
    setIsListening(true);

    const t = setTimeout(() => {
      const ok = speechService.startListening(language);
      if (!ok) {
        setIsListening(false);
        setErrorMsg("Browser mein Microphone permission allow karein.");
      }
    }, 15);

    return () => clearTimeout(t);
  }, [isOpen, autoListenNonce, language]);

  // Execute trailing command if user spoke everything in one breath ("Hi Jarvis mere tasks batao")
  useEffect(() => {
    if (!isOpen || !initialCommand || initialCommand.id === lastInitCmdRef.current) return;
    lastInitCmdRef.current = initialCommand.id;
    setReplyText("");
    setErrorMsg(null);
    handleCommandRef.current(initialCommand.text);
  }, [isOpen, initialCommand]);

  // Resume wake detection automatically whenever overlay closes
  useEffect(() => {
    if (!isOpen) {
      speechService.resumeWakeMode();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Build smooth SVG wave paths driven by real audioLevel / speaking / processing state
  const buildWavePath = (ampScale: number, freq: number, phaseShift: number, yCenter = 70) => {
    const dynamicAmp = isListening
      ? Math.max(8, audioLevel * 52) * ampScale
      : isSpeaking
      ? (18 + Math.sin(phaseTick * 1.9) * 14) * ampScale
      : isProcessing
      ? 14 * ampScale
      : 5 * ampScale;

    const points: string[] = [];
    const width = 600;
    const step = 12;
    for (let x = 0; x <= width; x += step) {
      const norm = x / width;
      const envelope = Math.sin(norm * Math.PI); // Smooth tapered ends
      const y =
        yCenter +
        Math.sin(norm * Math.PI * freq + phaseTick + phaseShift) * dynamicAmp * envelope;
      points.push(`${x === 0 ? "M" : "L"} ${x} ${y.toFixed(1)}`);
    }
    return points.join(" ");
  };

  const bars = Array.from({ length: 28 }, (_, idx) => {
    const distFromCenter = Math.abs(idx - 13.5) / 14;
    const envelope = Math.max(0.2, 1 - distFromCenter * 0.85);
    const waveMod = Math.abs(Math.sin(phaseTick * 0.9 + idx * 0.45));
    const amp = isListening
      ? Math.max(0.14, audioLevel * 1.15) * waveMod
      : isSpeaking
      ? (0.35 + waveMod * 0.65)
      : isProcessing
      ? 0.28 + waveMod * 0.35
      : 0.1;
    return Math.min(100, Math.round(amp * envelope * 100));
  });

  const waveColor = isListening
    ? "#22d3ee"
    : isProcessing
    ? "#a855f7"
    : isSpeaking
    ? "#34d399"
    : "#06b6d4";

  const formatWaTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${mins}:${rem < 10 ? "0" : ""}${rem}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fadeIn font-rajdhani">
      <div className="relative w-full max-w-2xl rounded-3xl bg-slate-950/95 border border-cyan-400/50 shadow-[0_0_70px_rgba(6,182,212,0.35)] overflow-hidden p-5 sm:p-7 space-y-4">
        {/* Top Glowing Gradient Accent */}
        <div
          className="absolute top-0 left-0 right-0 h-1 transition-all duration-300"
          style={{
            background: `linear-gradient(90deg, transparent, ${waveColor}, transparent)`,
          }}
        />

        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center shadow-lg ${
              isListening
                ? "bg-emerald-950 border-emerald-400 text-emerald-300 shadow-emerald-500/25"
                : "bg-cyan-950 border-cyan-400/60 text-cyan-300 shadow-cyan-500/20"
            }`}>
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-orbitron font-extrabold text-sm sm:text-base text-cyan-300 tracking-wider">
                  &quot;HI JARVIS&quot; VOICE RECORDER
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-cyan-500/40 text-cyan-200 uppercase">
                  {activeCharName} ({activeGender})
                </span>
              </div>
              <p className="text-[11px] font-mono text-slate-300">
                {isListening
                  ? `● Recording Voice — ${activeCharName} aapki awaaz sun ${activeGender === "male" ? "raha hai" : "rahi hai"}...`
                  : isProcessing
                  ? "Voice decode ho rahi hai — jawab tayar hai..."
                  : isSpeaking
                  ? `${activeCharName} Pakistani Urdu mein jawab de ${activeGender === "male" ? "raha hai" : "rahi hai"}...`
                  : `Dobara record karne ke liye 'Record Voice' dabayein ya 'Hi ${activeCharName}' bolein`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              speechService.cancelListening();
              speechService.cancelSpeech();
              onClose();
            }}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white cursor-pointer"
            title="Close Voice Recorder"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* WhatsApp-Style Live Voice Recording Phase Bar (Appears Immediately on Wake!) */}
        {isListening ? (
          <div className="rounded-2xl bg-[#0b141a] border border-emerald-500/60 shadow-[0_0_35px_rgba(0,168,132,0.3)] p-3.5 sm:p-4 space-y-3">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="flex items-center gap-2 text-emerald-300 font-bold">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-85" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                </span>
                <span>{activeCharName} SUN {activeGender === "male" ? "RAHA HAI" : "RAHI HAI"} • VOICE NOTE</span>
              </span>
              <span className="text-slate-400">Auto-send on silence ya Green ➤ dabayein</span>
            </div>

            {/* Exact WhatsApp Recording Bar Layout: [Red Dot + Timer] [Scrolling Waveform] [Cancel Trash] [Green Send] */}
            <div className="flex items-center gap-2.5 sm:gap-3 px-3 py-2.5 rounded-full bg-[#202c33] border border-slate-700/80 shadow-inner">
              {/* Red Dot + Timer */}
              <div className="flex items-center gap-2 shrink-0 pl-1">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                <span className="font-mono font-bold text-sm text-slate-100 tabular-nums min-w-[38px]">
                  {formatWaTimer(recordingSeconds)}
                </span>
              </div>

              {/* Scrolling Real-Time WhatsApp Voice Bars */}
              <div className="flex-1 flex items-center justify-end gap-[3px] h-9 overflow-hidden px-1">
                {waWaveBars.map((heightPct, idx) => (
                  <div
                    key={idx}
                    className="w-[3px] rounded-full transition-all duration-75 shrink-0"
                    style={{
                      height: `${Math.max(5, Math.round((heightPct / 100) * 32))}px`,
                      backgroundColor: heightPct > 40 ? "#25d366" : "#8696a0",
                    }}
                  />
                ))}
              </div>

              {/* WhatsApp Trash / Cancel Recording Button */}
              <button
                type="button"
                onClick={() => {
                  soundEffects.playClick();
                  speechService.cancelListening();
                  setIsListening(false);
                  setLiveTranscript("");
                  setErrorMsg("Recording cancel kar di gayi. Dobara 'Hi Jarvis' bolein.");
                }}
                className="p-2.5 rounded-full bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 text-rose-300 transition cursor-pointer shrink-0"
                title="Cancel Voice Recording"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              {/* WhatsApp Emerald Green Send Button */}
              <button
                type="button"
                onClick={() => {
                  soundEffects.playBeepConfirm();
                  speechService.stopListening();
                }}
                className="p-2.5 rounded-full bg-[#00a884] hover:bg-[#06cf9c] text-slate-950 shadow-lg shadow-emerald-500/35 transition cursor-pointer shrink-0"
                title="Send Voice Command Now"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* Holographic Audio Wave Visualizer (Processing / Speaking / Standby) */
          <div className="relative rounded-2xl bg-[#030917] border border-cyan-500/35 p-4 overflow-hidden">
            <div
              className="absolute inset-0 pointer-events-none opacity-35"
              style={{
                background: `radial-gradient(circle at 50% 50%, ${waveColor}33 0%, transparent 72%)`,
              }}
            />

            <svg viewBox="0 0 600 140" className="w-full h-28 sm:h-32">
              <path d={buildWavePath(1.0, 4.0, 0)} fill="none" stroke={waveColor} strokeWidth="3" strokeLinecap="round" />
              <path d={buildWavePath(0.75, 5.5, 1.4)} fill="none" stroke="#a855f7" strokeWidth="2" strokeOpacity="0.85" strokeLinecap="round" />
              <path d={buildWavePath(0.55, 3.0, 2.8)} fill="none" stroke="#38bdf8" strokeWidth="1.6" strokeOpacity="0.7" strokeLinecap="round" />
            </svg>

            <div className="flex items-center justify-center gap-1 h-9 mt-1">
              {bars.map((heightPct, i) => (
                <div
                  key={i}
                  className="w-1.5 rounded-full transition-all duration-75"
                  style={{
                    height: `${Math.max(4, (heightPct / 100) * 34)}px`,
                    backgroundColor: waveColor,
                    opacity: 0.45 + (heightPct / 100) * 0.55,
                    boxShadow: heightPct > 45 ? `0 0 8px ${waveColor}` : undefined,
                  }}
                />
              ))}
            </div>

            {!isProcessing && (
              <div className="mt-3 flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    soundEffects.playBeepConfirm();
                    setErrorMsg(null);
                    setLiveTranscript("");
                    setReplyText("");
                    speechService.startListening(language);
                  }}
                  className="px-4 py-2 rounded-full bg-[#00a884] hover:bg-[#06cf9c] text-slate-950 font-orbitron font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/30 cursor-pointer"
                >
                  <AudioWaveform className="w-4 h-4" />
                  <span>RECORD NEW VOICE NOTE</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Live Transcript & Spoken Reply */}
        <div className="space-y-2.5">
          {liveTranscript && (
            <div className="p-3 rounded-xl bg-slate-900/90 border border-emerald-500/45 text-xs sm:text-sm font-mono text-emerald-200">
              <span className="text-[10px] text-emerald-400 block mb-0.5 uppercase font-bold">
                {isListening ? "Aap Bol Rahe Hain (Live Heard):" : "You Said:"}
              </span>
              &quot;{liveTranscript}&quot;
            </div>
          )}

          {replyText && (
            <div className="p-3.5 rounded-xl bg-emerald-950/35 border border-emerald-400/45 text-sm text-slate-100 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-mono text-emerald-300">
                <span className="flex items-center gap-1 font-bold uppercase">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{activeCharName}</span>
                </span>
                {actionBadge && (
                  <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/40">
                    {actionBadge}
                  </span>
                )}
              </div>
              <p className="leading-relaxed">{replyText}</p>
            </div>
          )}

          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-amber-950/60 border border-amber-400/50 text-amber-200 text-xs font-mono">
              {errorMsg}
            </div>
          )}
        </div>

        {/* Quick Proactive Feature Triggers + Full Chat Link */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800 text-xs font-mono">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleCommandRef.current("Mere pending tasks batao")}
              className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-cyan-950 border border-cyan-500/40 text-cyan-200 flex items-center gap-1.5 cursor-pointer"
            >
              <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
              <span>Tasks Update</span>
            </button>
            <button
              type="button"
              onClick={() => handleCommandRef.current("Meri health aur pani ka status batao")}
              className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-emerald-950 border border-emerald-500/40 text-emerald-200 flex items-center gap-1.5 cursor-pointer"
            >
              <Heart className="w-3.5 h-3.5 text-emerald-400" />
              <span>Health Check</span>
            </button>
            <button
              type="button"
              onClick={() => handleCommandRef.current("Mere calls aur notifications batao")}
              className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-amber-950 border border-amber-500/40 text-amber-200 flex items-center gap-1.5 cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5 text-amber-400" />
              <span>Calls &amp; Alerts</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              speechService.stopListening();
              onClose();
              onOpenFullChat();
            }}
            className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-orbitron font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>OPEN CHAT</span>
          </button>
        </div>
      </div>
    </div>
  );
};
