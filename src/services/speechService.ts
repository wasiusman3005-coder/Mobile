import { DashboardCustomization, LanguageCode, VoiceGender } from "../types";
import { WAKE_WORDS_100_PLUS } from "../data/jarvisCatalog";
import { getRemotePcUrl } from "./systemTelemetry";
import {
  isNativeAndroidApk,
  requestMicPermissionAndroid,
  speakNativeAndroid,
  stopNativeAndroidSpeech,
  startNativeAndroidListening,
  stopNativeAndroidListening,
  cancelNativeAndroidListening,
  setNativeAndroidWakeWord,
  subscribeNativeSpeechEvents,
} from "./nativeAndroidBridge";

export interface SpeechListenerCallbacks {
  onStart?: () => void;
  onResult?: (transcript: string, isFinal: boolean) => void;
  onAudioCaptured?: (audioBase64: string, mimeType: string) => void;
  onError?: (error: string) => void;
  onEnd?: () => void;
  onSpeakingStateChange?: (speaking: boolean) => void;
  onWakeWordDetected?: (matchedPhrase?: string, trailingCommand?: string) => void;
  onWakeStatusChange?: (active: boolean, statusText?: string) => void;
  onWakeHeard?: (heardText: string) => void;
}

type WakeEngineState = "idle" | "starting" | "running" | "stopping";

class SpeechService {
  private recognition: any = null;
  private wakeRecognition: any = null;
  private wakeSupported = false;
  private wakeEngineState: WakeEngineState = "idle";
  private wakePermissionDenied = false;
  private wakeNetworkFailures = 0;
  private wakeRestartTimer: ReturnType<typeof setTimeout> | null = null;
  private wakeWatchdogInterval: ReturnType<typeof setInterval> | null = null;
  private wakeAbortResetTimer: ReturnType<typeof setTimeout> | null = null;

  private isListening = false;
  private isWakeWordActive = false;
  private wakePausedForCommand = false;
  private isSpeaking = false;
  private speakingWatchdogTimer: ReturnType<typeof setTimeout> | null = null;
  private wakeCooldownUntil = 0;
  private currentAudioElement: HTMLAudioElement | null = null;
  private speakSeqId = 0;
  private activeTtsAbort: AbortController | null = null;

  // Tier-2 audio-burst wake fallback state (only used when Web Speech API is blocked/network-failed)
  private burstWakeActive = false;
  private burstWakeStream: MediaStream | null = null;
  private burstWakeCtx: AudioContext | null = null;
  private burstWakeInterval: ReturnType<typeof setInterval> | null = null;
  private burstWakeRecorder: MediaRecorder | null = null;
  private burstCheckInFlight = false;

  // Channel-separated callbacks so App wake detector & Voice modal NEVER overwrite each other
  private commandCallbacks: Pick<
    SpeechListenerCallbacks,
    "onStart" | "onResult" | "onAudioCaptured" | "onError" | "onEnd"
  > = {};
  private wakeCallbacks: Pick<
    SpeechListenerCallbacks,
    "onWakeWordDetected" | "onWakeStatusChange" | "onWakeHeard"
  > = {};
  private speakingListeners = new Set<(speaking: boolean) => void>();
  private listeningListeners = new Set<(listening: boolean) => void>();
  private audioLevelListeners = new Set<(level: number) => void>();

  // Capture session state for dual SpeechRecognition + MediaRecorder fallback
  private captureSessionId = 0;
  private finalizedSessionId = 0;
  private bestTranscript = "";
  private activeMediaRecorder: MediaRecorder | null = null;
  private activeMediaStream: MediaStream | null = null;
  private audioChunks: Blob[] = [];
  private maxCaptureTimer: ReturnType<typeof setTimeout> | null = null;
  private vadInterval: ReturnType<typeof setInterval> | null = null;
  private audioCtx: AudioContext | null = null;
  private speechEnergyDetected = false;
  private discardMediaFallback = false;

  private customWakeNames: string[] = ["jarvis", "wasu", "wasi ki jan"];
  private activeWakeWords: string[] = Array.from(
    new Set([
      "hi jarvis",
      "high jarvis",
      "hai jarvis",
      "hi jarvice",
      "hey jarvis",
      "hey jarvice",
      "hi jervis",
      "hi jarvish",
      "hi jarvez",
      "hi jarves",
      "hi javis",
      "i jarvis",
      "a jarvis",
      "my jarvis",
      "bye jarvis",
      "hi service",
      "hey service",
      "hi travis",
      "hey travis",
      "hello jarvis",
      "ok jarvis",
      "okay jarvis",
      "wake up jarvis",
      "wakeup jarvis",
      "suno jarvis",
      "jarvis",
      "jarvish",
      "jarvice",
      "jervis",
      "javis",
      "hi wasu",
      "hey wasu",
      "suno wasu",
      "hi wasi ki jan",
      "hey wasi ki jan",
      "suno wasi ki jan",
      ...WAKE_WORDS_100_PLUS.map((w) => w.phrase.toLowerCase()),
    ])
  );

  private elevenLabsConfig: { enabled: boolean; voiceId: string; fastMode: boolean } = {
    enabled: false,
    voiceId: "EXAVITQu4vr4xnSDxMaL",
    fastMode: true,
  };

  private voiceCustomization: DashboardCustomization | null = null;

  private cachedVoices: SpeechSynthesisVoice[] = [];
  private nativeSpeechUnsub: (() => void) | null = null;
  private nativeTtsResolve: (() => void) | null = null;

  constructor() {
    if (isNativeAndroidApk()) {
      this.initNativeSpeechBridge();
    } else {
      this.initWakeWordDetector();
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const loadVoices = () => {
        const list = window.speechSynthesis.getVoices();
        if (list.length > 0) this.cachedVoices = list;
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }

  private initNativeSpeechBridge() {
    if (this.nativeSpeechUnsub) return;
    this.wakeSupported = true;
    this.nativeSpeechUnsub = subscribeNativeSpeechEvents({
      onStart: () => {
        this.notifyListening(true);
      },
      onPartial: (text) => {
        if (!this.isListening) return;
        this.bestTranscript = text;
        this.speechEnergyDetected = true;
        this.commandCallbacks.onResult?.(text, false);
      },
      onResult: (text) => {
        if (text && text.trim()) {
          this.finalizeSpeechTranscript(this.captureSessionId, text.trim());
        }
      },
      onRms: (level) => {
        if (this.isListening) {
          this.notifyAudioLevel(level);
        }
      },
      onError: (message) => {
        const sid = this.captureSessionId;
        if (this.finalizedSessionId === sid) return;
        if (this.bestTranscript.trim()) {
          this.finalizeSpeechTranscript(sid, this.bestTranscript.trim());
          return;
        }
        this.finalizedSessionId = sid;
        this.notifyListening(false);
        this.cleanupCaptureResources(true);
        this.commandCallbacks.onError?.(message || "Awaaz detect nahi hui. Dobara bolein.");
        this.commandCallbacks.onEnd?.();
      },
      onEnd: () => {
        const sid = this.captureSessionId;
        if (this.finalizedSessionId === sid) return;
        if (this.bestTranscript.trim()) {
          this.finalizeSpeechTranscript(sid, this.bestTranscript.trim());
          return;
        }
        this.finalizedSessionId = sid;
        this.notifyListening(false);
        this.cleanupCaptureResources(true);
        this.commandCallbacks.onEnd?.();
      },
      onTtsStart: () => {
        this.notifySpeaking(true);
      },
      onTtsDone: () => {
        const doneCb = this.nativeTtsResolve;
        this.nativeTtsResolve = null;
        if (doneCb) doneCb();
      },
      onWakeStatus: (active, status) => {
        this.wakeEngineState = active ? "running" : "idle";
        this.wakeCallbacks.onWakeStatusChange?.(active, status || "LISTENING — Say 'Hi Jarvis' anytime");
      },
    });
  }

  public setWakeWords(extraWords: string[] = [], customCharacterNames: string[] = []) {
    const base = WAKE_WORDS_100_PLUS.map((w) => w.phrase.toLowerCase());
    const priority = [
      "hi jarvis",
      "high jarvis",
      "hai jarvis",
      "hi jarvice",
      "hey jarvis",
      "hey jarvice",
      "hi jervis",
      "hi jarvish",
      "hi jarvez",
      "hi jarves",
      "hi javis",
      "i jarvis",
      "a jarvis",
      "my jarvis",
      "bye jarvis",
      "hi service",
      "hey service",
      "hi travis",
      "hey travis",
      "hello jarvis",
      "ok jarvis",
      "okay jarvis",
      "wake up jarvis",
      "wakeup jarvis",
      "suno jarvis",
      "jarvis",
      "jarvish",
      "jarvice",
      "jervis",
      "javis",
      "hi zoya",
      "hey zoya",
      "hai zoya",
      "hello zoya",
      "suno zoya",
    ];
    const extras = extraWords.map((w) => w.trim().toLowerCase()).filter(Boolean);
    this.activeWakeWords = Array.from(new Set([...priority, ...base, ...extras]));
    if (customCharacterNames.length > 0) {
      this.customWakeNames = Array.from(
        new Set([
          "jarvis",
          ...customCharacterNames.map((n) => n.trim().toLowerCase()).filter((n) => n.length >= 2),
        ])
      );
    }
  }

  public setElevenLabsConfig(cfg: { enabled: boolean; voiceId: string; fastMode: boolean }) {
    this.elevenLabsConfig = { ...cfg };
  }

  public setVoiceCustomization(cust: DashboardCustomization) {
    this.voiceCustomization = cust;
    if (cust.avatarConfig) {
      this.elevenLabsConfig = {
        enabled: cust.avatarConfig.useElevenLabs,
        voiceId: cust.avatarConfig.elevenLabsVoiceId,
        fastMode: cust.avatarConfig.fastTalkingMode,
      };
    }
  }

  public getAvailableBrowserVoices(): SpeechSynthesisVoice[] {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
    const live = window.speechSynthesis.getVoices();
    return live.length > 0 ? live : this.cachedVoices;
  }

  public playCustomAudioSample(audioSource: string): Promise<void> {
    return new Promise((resolve) => {
      if (!audioSource) {
        resolve();
        return;
      }
      try {
        const audio = new Audio(audioSource);
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        audio.play().catch(() => resolve());
      } catch {
        resolve();
      }
    });
  }

  public getEffectiveVoiceProfile(lang: LanguageCode = "ur", requestedGender?: VoiceGender) {
    const cust = this.voiceCustomization;
    const avatar = cust?.avatarConfig;
    const schedule = avatar?.voiceSchedule;
    let resolvedGender: "male" | "female" =
      requestedGender === "male"
        ? "male"
        : requestedGender === "female"
        ? "female"
        : avatar?.characterGender === "male"
        ? "male"
        : "female";

    if (requestedGender === "custom" || (!requestedGender && cust?.activeVoiceMode === "custom")) {
      const customProf = cust?.customVoices?.find((v) => v.id === cust.activeCustomVoiceId);
      if (customProf) {
        return {
          gender: customProf.gender,
          pitch: customProf.pitch,
          rate: customProf.rate,
          preferredBrowserVoiceURI: customProf.browserVoiceURI,
          audioSampleSource: customProf.audioBase64 || customProf.audioBlobUrl,
        };
      }
    }

    // Apply time-of-day or language-based automatic switching if enabled and no forced test override
    if (!requestedGender && schedule?.enabled) {
      if (schedule.mode === "day_night") {
        const hour = new Date().getHours();
        const isDay =
          schedule.dayStartHour < schedule.nightStartHour
            ? hour >= schedule.dayStartHour && hour < schedule.nightStartHour
            : hour >= schedule.dayStartHour || hour < schedule.nightStartHour;
        resolvedGender = isDay ? schedule.dayVoice : schedule.nightVoice;
      } else if (schedule.mode === "language_split") {
        resolvedGender = lang === "en" ? schedule.englishVoice : schedule.urduVoice;
      }
    }

    const slot = resolvedGender === "male" ? avatar?.maleVoiceSettings : avatar?.femaleVoiceSettings;
    const slotCustom = slot?.activeCustomVoiceId
      ? cust?.customVoices?.find((v) => v.id === slot.activeCustomVoiceId)
      : undefined;

    return {
      gender: resolvedGender,
      pitch: slotCustom?.pitch ?? slot?.pitch ?? (resolvedGender === "male" ? 0.94 : 1.03),
      rate: slotCustom?.rate ?? slot?.rate ?? (resolvedGender === "male" ? 0.98 : 0.97),
      preferredBrowserVoiceURI: slotCustom?.browserVoiceURI || slot?.preferredBrowserVoiceURI,
      audioSampleSource: slotCustom?.audioBase64 || slotCustom?.audioBlobUrl,
    };
  }

  public getWakeWordCount() {
    return this.activeWakeWords.length;
  }

  public getWakeActiveState() {
    return this.isWakeWordActive && (this.wakeEngineState === "running" || this.burstWakeActive);
  }

  public triggerWakeWordManually(phrase = "Hi Jarvis") {
    this.wakeCallbacks.onWakeWordDetected?.(phrase, "");
  }

  private normalizeForWake(input: string): string {
    return input
      .toLowerCase()
      .replace(/[.,!?'"’`~^*_—\-:;()\[\]{}]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private matchWakeTranscript(rawText: string): { matchedPhrase: string; trailingCommand: string } | null {
    const normalized = this.normalizeForWake(rawText);
    if (!normalized) return null;

    // 1. Direct activeWakeWords list (sorted longest first so multi-word "hi jarvis" beats "jarvis")
    const sorted = [...this.activeWakeWords].sort((a, b) => b.length - a.length);
    for (const phrase of sorted) {
      const cleanPhrase = this.normalizeForWake(phrase);
      if (!cleanPhrase) continue;
      const escaped = cleanPhrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rx = new RegExp(`(?:^|\\s)(${escaped})(?:\\s|$)`, "i");
      const m = rx.exec(normalized);
      if (m) {
        const afterIdx = (m.index ?? 0) + m[0].length;
        const trailing = normalized.slice(afterIdx).trim();
        return { matchedPhrase: phrase, trailingCommand: trailing };
      }
    }

    // 2. Phonetic variants of "Hi Jarvis" / "Jarvis" common in Pakistani English & Urdu ASR
    const jarvisPhoneticRegex =
      /(?:^|\s)((?:(?:hi|hey|hai|high|hii|he|i|a|ai|my|by|bye|ok|okay|hello|hallo|halo|oi|oye|suno|sunno|wake\s*up|wakeup|yo)\s+)?(?:jarvis|jarvish|jarvice|jarvis+h?|jervis|javis|jarvez|jarves|jarwas|jarvas|جاروس)|(?:hi|hey|hai|high|ok|suno)\s+(?:service|travis|charvis|garvis|darvis))(?:\s|$)/i;
    const jm = jarvisPhoneticRegex.exec(normalized);
    if (jm) {
      const afterIdx = (jm.index ?? 0) + jm[0].length;
      return {
        matchedPhrase: jm[1].trim(),
        trailingCommand: normalized.slice(afterIdx).trim(),
      };
    }

    // 3. Dynamic custom character names (e.g. "hi ayesha", "suno sara", or standalone custom name >= 4 chars)
    for (const cname of this.customWakeNames) {
      if (!cname || cname === "jarvis") continue;
      const esc = cname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const prefixRx = new RegExp(
        `(?:^|\\s)((?:hi|hey|hai|high|hello|ok|okay|suno|wake\\s*up|aye|i)\\s+${esc})(?:\\s|$)`,
        "i"
      );
      const pm = prefixRx.exec(normalized);
      if (pm) {
        const afterIdx = (pm.index ?? 0) + pm[0].length;
        return { matchedPhrase: pm[1].trim(), trailingCommand: normalized.slice(afterIdx).trim() };
      }
      if (cname.length >= 4) {
        const soloRx = new RegExp(`(?:^|\\s)(${esc})(?:\\s|$)`, "i");
        const sm = soloRx.exec(normalized);
        if (sm) {
          const afterIdx = (sm.index ?? 0) + sm[0].length;
          return { matchedPhrase: sm[1].trim(), trailingCommand: normalized.slice(afterIdx).trim() };
        }
      }
    }

    // 4. Urdu script wake match
    if (/ہائے\s*جاروس|ہیلو\s*جاروس|سنو\s*جاروس|جاروس/.test(rawText)) {
      return { matchedPhrase: "Hi Jarvis", trailingCommand: "" };
    }

    return null;
  }

  private clearWakeTimers() {
    if (this.wakeRestartTimer) {
      clearTimeout(this.wakeRestartTimer);
      this.wakeRestartTimer = null;
    }
    if (this.wakeAbortResetTimer) {
      clearTimeout(this.wakeAbortResetTimer);
      this.wakeAbortResetTimer = null;
    }
  }

  private abortWakeRecognitionSafely() {
    if (!this.wakeRecognition) return;
    if (this.wakeEngineState === "idle") return;
    this.wakeEngineState = "stopping";
    if (this.wakeAbortResetTimer) clearTimeout(this.wakeAbortResetTimer);
    this.wakeAbortResetTimer = setTimeout(() => {
      if (this.wakeEngineState === "stopping") {
        this.wakeEngineState = "idle";
      }
    }, 650);
    try {
      this.wakeRecognition.abort();
    } catch {
      try {
        this.wakeRecognition.stop();
      } catch {
        this.wakeEngineState = "idle";
      }
    }
  }

  private startWakeRecognitionSafe() {
    if (
      !this.isWakeWordActive ||
      this.isListening ||
      this.isSpeaking ||
      this.wakePausedForCommand ||
      this.wakePermissionDenied
    ) {
      return;
    }

    if (!this.wakeSupported || !this.wakeRecognition) {
      this.startAudioBurstWakeFallback().catch(() => {});
      return;
    }

    if (this.wakeEngineState === "running" || this.wakeEngineState === "starting") {
      return;
    }
    if (this.wakeEngineState === "stopping") {
      this.scheduleWakeRestart(300);
      return;
    }

    try {
      this.wakeEngineState = "starting";
      this.wakeRecognition.start();
    } catch (err: any) {
      const msg = String(err?.message || err || "");
      if (msg.toLowerCase().includes("already started")) {
        this.wakeEngineState = "running";
      } else {
        this.wakeEngineState = "idle";
        this.scheduleWakeRestart(600);
      }
    }
  }

  private scheduleWakeRestart(delayMs = 260) {
    if (this.wakeRestartTimer) {
      clearTimeout(this.wakeRestartTimer);
    }
    this.wakeRestartTimer = setTimeout(() => {
      this.wakeRestartTimer = null;
      this.startWakeRecognitionSafe();
    }, delayMs);
  }

  private ensureWakeWatchdog(active: boolean) {
    if (this.wakeWatchdogInterval) {
      clearInterval(this.wakeWatchdogInterval);
      this.wakeWatchdogInterval = null;
    }
    if (!active) return;
    this.wakeWatchdogInterval = setInterval(() => {
      if (
        this.isWakeWordActive &&
        !this.isListening &&
        !this.isSpeaking &&
        !this.wakePausedForCommand &&
        !this.wakePermissionDenied &&
        !this.burstWakeActive &&
        this.wakeEngineState === "idle"
      ) {
        this.startWakeRecognitionSafe();
      }
    }, 1800);
  }

  public async primeMicrophoneAccess(): Promise<boolean> {
    this.wakePermissionDenied = false;
    this.wakePausedForCommand = false;
    this.wakeNetworkFailures = 0;

    if (isNativeAndroidApk()) {
      const granted = await requestMicPermissionAndroid();
      if (granted) {
        this.isWakeWordActive = true;
        const wakeRes = await setNativeAndroidWakeWord(true, this.activeWakeWords);
        this.wakeEngineState = wakeRes.active ? "running" : "idle";
        this.wakeCallbacks.onWakeStatusChange?.(true, "LISTENING — Say 'Hi Jarvis' anytime");
        return true;
      }
      this.wakePermissionDenied = true;
      this.wakeCallbacks.onWakeStatusChange?.(false, "Tap Mic & Allow Android Microphone permission");
      return false;
    }

    // Never disrupt an already healthy running wake engine
    if (this.wakeEngineState === "running" || this.burstWakeActive) {
      this.wakeCallbacks.onWakeStatusChange?.(true, "LISTENING — Say 'Hi Jarvis' anytime");
      return true;
    }

    try {
      let alreadyGranted = false;
      try {
        if (typeof navigator !== "undefined" && navigator.permissions?.query) {
          const perm = await navigator.permissions.query({ name: "microphone" as PermissionName });
          if (perm.state === "granted") alreadyGranted = true;
        }
      } catch {}

      if (!alreadyGranted && typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
        // Wait briefly so Android Chrome releases mic hardware cleanly before SpeechRecognition opens
        await new Promise((r) => setTimeout(r, 240));
      }

      this.isWakeWordActive = true;
      this.ensureWakeWatchdog(true);
      this.startWakeRecognitionSafe();

      // Verify after a short beat whether Tier-1 or Tier-2 came online
      setTimeout(() => {
        if (!this.isWakeWordActive || this.isListening || this.isSpeaking || this.wakePausedForCommand) return;
        if (this.wakeEngineState === "running" || this.burstWakeActive) {
          this.wakeCallbacks.onWakeStatusChange?.(true, "LISTENING — Say 'Hi Jarvis' anytime");
        } else if (!this.wakeSupported) {
          this.startAudioBurstWakeFallback().catch(() => {});
        }
      }, 650);

      return true;
    } catch {
      this.wakePermissionDenied = true;
      this.wakeCallbacks.onWakeStatusChange?.(false, "Mic Blocked — Tap here & Allow Microphone");
      return false;
    }
  }

  public resumeWakeMode() {
    this.wakePausedForCommand = false;
    this.wakeCooldownUntil = Date.now() + 350;
    if (this.isWakeWordActive) {
      if (isNativeAndroidApk()) {
        setNativeAndroidWakeWord(true, this.activeWakeWords).catch(() => {});
        return;
      }
      this.ensureWakeWatchdog(true);
      this.scheduleWakeRestart(220);
    }
  }

  private createCommandRecognitionInstance(lang: LanguageCode) {
    if (typeof window === "undefined") return null;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    try {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = true;
      rec.maxAlternatives = 3;
      rec.lang = lang === "pa" ? "pa-IN" : lang === "en" ? "en-US" : "ur-PK";
      return rec;
    } catch {
      return null;
    }
  }

  private resumeWakeDetectorSoon() {
    this.wakePausedForCommand = false;
    if (this.isWakeWordActive && !this.isListening && !this.isSpeaking) {
      if (isNativeAndroidApk()) {
        setTimeout(() => {
          if (this.isWakeWordActive && !this.isListening && !this.isSpeaking) {
            setNativeAndroidWakeWord(true, this.activeWakeWords).catch(() => {});
          }
        }, 320);
        return;
      }
      this.scheduleWakeRestart(320);
    }
  }

  // Passive wake-word detector: ONLY listens for "Hi Jarvis" / "Wake up Jarvis" to wake once!
  private initWakeWordDetector() {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      this.wakeSupported = false;
      return;
    }

    try {
      const isAndroid = typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
      this.wakeRecognition = new SpeechRecognition();
      // Android Chrome freezes continuous=true after initial silence; false + clean onend restart stays responsive
      this.wakeRecognition.continuous = !isAndroid;
      this.wakeRecognition.interimResults = true;
      this.wakeRecognition.maxAlternatives = 5;
      this.wakeRecognition.lang = "en-US";
      this.wakeSupported = true;

      this.wakeRecognition.onstart = () => {
        this.wakeEngineState = "running";
        this.wakePermissionDenied = false;
        this.wakeNetworkFailures = 0;
        if (this.wakeAbortResetTimer) {
          clearTimeout(this.wakeAbortResetTimer);
          this.wakeAbortResetTimer = null;
        }
        this.wakeCallbacks.onWakeStatusChange?.(true, "LISTENING — Say 'Hi Jarvis' anytime");
      };

      this.wakeRecognition.onresult = (event: any) => {
        if (
          this.isSpeaking ||
          this.isListening ||
          this.wakePausedForCommand ||
          Date.now() < this.wakeCooldownUntil
        ) {
          return;
        }

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const resultObj = event.results[i];
          const primaryRaw = String(resultObj?.[0]?.transcript || "").trim();
          if (primaryRaw) {
            this.wakeCallbacks.onWakeHeard?.(primaryRaw);
          }

          // Check ALL alternatives returned by browser ASR!
          const altCount = Math.min(5, resultObj?.length || 1);
          for (let alt = 0; alt < altCount; alt++) {
            const altRaw = String(resultObj?.[alt]?.transcript || "").trim();
            if (!altRaw) continue;

            const match = this.matchWakeTranscript(altRaw);
            if (match) {
              this.wakeCooldownUntil = Date.now() + 2600;
              this.wakePausedForCommand = true;
              const trailingCommand =
                resultObj.isFinal && match.trailingCommand.length >= 3 ? match.trailingCommand : "";

              // Abort wake recognition cleanly so hardware mic unlocks immediately for command recording
              this.abortWakeRecognitionSafely();
              this.wakeCallbacks.onWakeWordDetected?.(match.matchedPhrase, trailingCommand);
              return;
            }
          }
        }
      };

      this.wakeRecognition.onerror = (ev: any) => {
        const err = String(ev?.error || "");
        if (err === "not-allowed" || err === "service-not-allowed") {
          this.wakePermissionDenied = true;
          this.wakeEngineState = "idle";
          this.wakeCallbacks.onWakeStatusChange?.(false, "Mic Blocked — Tap here to allow 'Hi Jarvis'");
          return;
        }
        if (err === "network" || err === "audio-capture") {
          this.wakeNetworkFailures += 1;
          this.wakeEngineState = "idle";
          if (this.wakeNetworkFailures >= 2 && this.isWakeWordActive) {
            this.wakeCallbacks.onWakeStatusChange?.(true, "Switching to Audio Burst Wake Fallback...");
            this.startAudioBurstWakeFallback().catch(() => {
              this.wakeCallbacks.onWakeStatusChange?.(false, "Speech Engine Blocked — Tap WAVE button");
            });
          }
          return;
        }
        if (err === "aborted" || err === "no-speech") {
          // Benign stop — onend handles restart cleanly
          return;
        }
      };

      this.wakeRecognition.onend = () => {
        this.wakeEngineState = "idle";
        if (this.wakeAbortResetTimer) {
          clearTimeout(this.wakeAbortResetTimer);
          this.wakeAbortResetTimer = null;
        }
        if (
          this.isWakeWordActive &&
          !this.isListening &&
          !this.isSpeaking &&
          !this.wakePausedForCommand &&
          !this.wakePermissionDenied &&
          !this.burstWakeActive
        ) {
          this.scheduleWakeRestart(isAndroid ? 160 : 280);
        }
      };
    } catch (e) {
      console.warn("Wake word detector init failed:", e);
      this.wakeSupported = false;
    }
  }

  // Tier-2 Fallback: Silence-gated short audio burst wake detection when browser Web Speech API fails/unsupported
  private async startAudioBurstWakeFallback() {
    if (this.burstWakeActive || !this.isWakeWordActive || typeof navigator === "undefined") return;
    if (!navigator.mediaDevices?.getUserMedia) {
      this.wakeCallbacks.onWakeStatusChange?.(false, "Browser Mic unsupported — Use WAVE button");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (!this.isWakeWordActive) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      const ctx = new AudioCtx();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      const buf = new Uint8Array(analyser.fftSize);

      this.burstWakeStream = stream;
      this.burstWakeCtx = ctx;
      this.burstWakeActive = true;
      this.wakeCallbacks.onWakeStatusChange?.(true, "FALLBACK ACTIVE — Say 'Hi Jarvis'");

      let chunks: Blob[] = [];
      let speechActive = false;
      let speechStartedAt = 0;
      let lastLoudAt = 0;

      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";

      this.burstWakeInterval = setInterval(() => {
        if (!this.burstWakeActive || !this.isWakeWordActive) return;
        if (this.isListening || this.isSpeaking || this.wakePausedForCommand || this.burstCheckInFlight) {
          return;
        }

        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length);
        const now = Date.now();

        if (!speechActive && rms > 0.032) {
          speechActive = true;
          speechStartedAt = now;
          lastLoudAt = now;
          chunks = [];
          try {
            const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
            this.burstWakeRecorder = rec;
            rec.ondataavailable = (ev) => {
              if (ev.data && ev.data.size > 0) chunks.push(ev.data);
            };
            rec.onstop = async () => {
              this.burstWakeRecorder = null;
              if (!this.burstWakeActive || this.isListening || this.isSpeaking || this.wakePausedForCommand) return;
              const blob = new Blob(chunks, { type: rec.mimeType || mime || "audio/webm" });
              if (blob.size < 1200) return;

              this.burstCheckInFlight = true;
              try {
                const base64: string = await new Promise((resolve) => {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    const s = String(reader.result || "");
                    resolve(s.includes(",") ? s.split(",")[1] : s);
                  };
                  reader.readAsDataURL(blob);
                });
                const res = await fetch("/api/jarvis/wake-check", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    audioBase64: base64,
                    mimeType: rec.mimeType || mime || "audio/webm",
                    wakeNames: this.customWakeNames,
                  }),
                });
                const data = await res.json();
                if (data.transcript) {
                  this.wakeCallbacks.onWakeHeard?.(data.transcript);
                }
                if (data.needsSpeechApi) {
                  this.stopAudioBurstWakeFallback();
                  this.wakeCallbacks.onWakeStatusChange?.(false, "Use Android APK / Mobile Chrome or tap WAVE button");
                  return;
                }
                if (data.matched) {
                  this.wakePausedForCommand = true;
                  this.stopAudioBurstWakeFallback();
                  this.wakeCallbacks.onWakeWordDetected?.(
                    data.matchedPhrase || "Hi Jarvis",
                    data.trailingCommand || ""
                  );
                }
              } catch {
              } finally {
                this.burstCheckInFlight = false;
              }
            };
            rec.start(150);
          } catch {
            speechActive = false;
          }
        } else if (speechActive) {
          if (rms > 0.024) lastLoudAt = now;
          if (now - lastLoudAt > 600 || now - speechStartedAt > 2400) {
            speechActive = false;
            try {
              if (this.burstWakeRecorder && this.burstWakeRecorder.state !== "inactive") {
                this.burstWakeRecorder.stop();
              }
            } catch {}
          }
        }
      }, 90);
    } catch {
      this.wakeCallbacks.onWakeStatusChange?.(false, "Mic Blocked — Tap here to allow 'Hi Jarvis'");
    }
  }

  private stopAudioBurstWakeFallback() {
    this.burstWakeActive = false;
    if (this.burstWakeInterval) {
      clearInterval(this.burstWakeInterval);
      this.burstWakeInterval = null;
    }
    if (this.burstWakeRecorder && this.burstWakeRecorder.state !== "inactive") {
      try {
        this.burstWakeRecorder.stop();
      } catch {}
    }
    this.burstWakeRecorder = null;
    if (this.burstWakeCtx) {
      try {
        this.burstWakeCtx.close();
      } catch {}
      this.burstWakeCtx = null;
    }
    if (this.burstWakeStream) {
      this.burstWakeStream.getTracks().forEach((t) => t.stop());
      this.burstWakeStream = null;
    }
  }

  public enableWakeWord(enabled: boolean) {
    this.isWakeWordActive = enabled;
    if (isNativeAndroidApk()) {
      if (enabled) {
        if (!this.isListening && !this.isSpeaking && !this.wakePausedForCommand) {
          setNativeAndroidWakeWord(true, this.activeWakeWords).then((res) => {
            this.wakeEngineState = res.active ? "running" : "idle";
            this.wakeCallbacks.onWakeStatusChange?.(
              res.active,
              res.active ? "LISTENING — Say 'Hi Jarvis' anytime" : "Tap Wake Card to allow Android Mic"
            );
          });
        }
      } else {
        setNativeAndroidWakeWord(false, []).catch(() => {});
        this.wakeEngineState = "idle";
        this.wakeCallbacks.onWakeStatusChange?.(false, "Wake trigger off");
      }
      return;
    }

    if (enabled) {
      this.ensureWakeWatchdog(true);
      if (!this.isListening && !this.isSpeaking && !this.wakePausedForCommand && !this.wakePermissionDenied) {
        if (this.wakeSupported && this.wakeRecognition) {
          this.scheduleWakeRestart(120);
        } else {
          this.wakeCallbacks.onWakeStatusChange?.(false, "Tap Wake Card to arm 'Hi Jarvis' Mic");
        }
      }
    } else {
      this.clearWakeTimers();
      this.ensureWakeWatchdog(false);
      this.abortWakeRecognitionSafely();
      this.stopAudioBurstWakeFallback();
      this.wakeCallbacks.onWakeStatusChange?.(false, "Wake trigger off");
    }
  }

  public setWakeCallbacks(
    cbs: Pick<SpeechListenerCallbacks, "onWakeWordDetected" | "onWakeStatusChange" | "onWakeHeard">
  ) {
    this.wakeCallbacks = { ...this.wakeCallbacks, ...cbs };
  }

  public setCommandCallbacks(
    cbs: Pick<SpeechListenerCallbacks, "onStart" | "onResult" | "onAudioCaptured" | "onError" | "onEnd">
  ) {
    this.commandCallbacks = { ...cbs };
  }

  public subscribeSpeaking(cb: (speaking: boolean) => void): () => void {
    this.speakingListeners.add(cb);
    return () => {
      this.speakingListeners.delete(cb);
    };
  }

  public subscribeListening(cb: (listening: boolean) => void): () => void {
    this.listeningListeners.add(cb);
    return () => {
      this.listeningListeners.delete(cb);
    };
  }

  public subscribeAudioLevel(cb: (level: number) => void): () => void {
    this.audioLevelListeners.add(cb);
    return () => {
      this.audioLevelListeners.delete(cb);
    };
  }

  private notifyAudioLevel(level: number) {
    this.audioLevelListeners.forEach((cb) => {
      try {
        cb(level);
      } catch {}
    });
  }

  // Backwards-compatible setter partitioned safely by channel
  public setCallbacks(cbs: SpeechListenerCallbacks) {
    if (
      cbs.onStart !== undefined ||
      cbs.onResult !== undefined ||
      cbs.onAudioCaptured !== undefined ||
      cbs.onError !== undefined ||
      cbs.onEnd !== undefined
    ) {
      this.commandCallbacks = {
        onStart: cbs.onStart,
        onResult: cbs.onResult,
        onAudioCaptured: cbs.onAudioCaptured,
        onError: cbs.onError,
        onEnd: cbs.onEnd,
      };
    }
    if (
      cbs.onWakeWordDetected !== undefined ||
      cbs.onWakeStatusChange !== undefined ||
      cbs.onWakeHeard !== undefined
    ) {
      this.wakeCallbacks = {
        ...this.wakeCallbacks,
        ...(cbs.onWakeWordDetected ? { onWakeWordDetected: cbs.onWakeWordDetected } : {}),
        ...(cbs.onWakeStatusChange ? { onWakeStatusChange: cbs.onWakeStatusChange } : {}),
        ...(cbs.onWakeHeard ? { onWakeHeard: cbs.onWakeHeard } : {}),
      };
    }
    if (cbs.onSpeakingStateChange) {
      this.speakingListeners.add(cbs.onSpeakingStateChange);
    }
  }

  private notifySpeaking(speaking: boolean) {
    this.isSpeaking = speaking;
    if (!speaking && this.speakingWatchdogTimer) {
      clearTimeout(this.speakingWatchdogTimer);
      this.speakingWatchdogTimer = null;
    }
    this.speakingListeners.forEach((cb) => {
      try {
        cb(speaking);
      } catch {}
    });
  }

  private notifyListening(listening: boolean) {
    this.isListening = listening;
    if (!listening) this.notifyAudioLevel(0);
    this.listeningListeners.forEach((cb) => {
      try {
        cb(listening);
      } catch {}
    });
  }

  private cleanupCaptureResources(discardMedia = true) {
    if (this.maxCaptureTimer) {
      clearTimeout(this.maxCaptureTimer);
      this.maxCaptureTimer = null;
    }
    if (this.vadInterval) {
      clearInterval(this.vadInterval);
      this.vadInterval = null;
    }
    if (this.audioCtx) {
      try {
        this.audioCtx.close();
      } catch {}
      this.audioCtx = null;
    }
    if (discardMedia) {
      this.discardMediaFallback = true;
    }
    if (this.activeMediaRecorder && this.activeMediaRecorder.state !== "inactive") {
      try {
        this.activeMediaRecorder.stop();
      } catch {}
    }
    if (this.activeMediaStream) {
      this.activeMediaStream.getTracks().forEach((t) => t.stop());
      this.activeMediaStream = null;
    }
  }

  private finalizeSpeechTranscript(sessionId: number, transcript: string) {
    if (sessionId !== this.captureSessionId || this.finalizedSessionId === sessionId) return;
    const cleaned = transcript.trim();
    if (!cleaned) return;

    this.finalizedSessionId = sessionId;
    this.notifyListening(false);
    this.cleanupCaptureResources(true);
    try {
      this.recognition?.abort();
    } catch {}
    this.commandCallbacks.onResult?.(cleaned, true);
    this.commandCallbacks.onEnd?.();
    this.resumeWakeDetectorSoon();
  }

  // Starts one-shot command recording: Native Android SpeechRecognizer (in APK) or Web Speech API + MediaRecorder (in Browser)
  public startListening(lang: LanguageCode = "ur"): boolean {
    if (typeof window === "undefined") return false;

    const sessionId = ++this.captureSessionId;
    this.bestTranscript = "";
    this.speechEnergyDetected = false;
    this.discardMediaFallback = false;
    this.cleanupCaptureResources(true);
    this.discardMediaFallback = false;
    this.cancelSpeech();

    // Release continuous wake recognition first so hardware mic stream unlocks cleanly
    this.wakePausedForCommand = true;
    this.clearWakeTimers();
    this.abortWakeRecognitionSafely();
    this.stopAudioBurstWakeFallback();

    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {}
      this.recognition = null;
    }

    this.notifyListening(true);
    this.commandCallbacks.onStart?.();

    if (isNativeAndroidApk()) {
      this.maxCaptureTimer = setTimeout(() => {
        if (this.captureSessionId === sessionId && this.isListening) {
          this.stopListening();
        }
      }, 15000);

      (async () => {
        const micOk = await requestMicPermissionAndroid();
        if (this.captureSessionId !== sessionId || this.finalizedSessionId === sessionId) return;
        if (!micOk) {
          this.finalizedSessionId = sessionId;
          this.notifyListening(false);
          this.cleanupCaptureResources(true);
          this.commandCallbacks.onError?.(
            "Android Microphone permission allow karein (Popup par Allow dabayein ya Phone Hub se permissions kholein)."
          );
          this.commandCallbacks.onEnd?.();
          this.resumeWakeDetectorSoon();
          return;
        }
        const nativeRes = await startNativeAndroidListening(lang);
        if (this.captureSessionId !== sessionId || this.finalizedSessionId === sessionId) return;
        if (!nativeRes.ok) {
          this.finalizedSessionId = sessionId;
          this.notifyListening(false);
          this.cleanupCaptureResources(true);
          this.commandCallbacks.onError?.(
            nativeRes.message || "Android Voice engine start nahi ho saka. Dobara Mic par tap karein."
          );
          this.commandCallbacks.onEnd?.();
          this.resumeWakeDetectorSoon();
        }
      })();
      return true;
    }

    // Safety cap: one-shot command mic turns OFF cleanly after 15s max
    this.maxCaptureTimer = setTimeout(() => {
      if (this.captureSessionId === sessionId && this.isListening) {
        this.stopListening();
      }
    }, 15000);

    // 260ms handoff delay guarantees Android Chrome releases wake-mic before opening command capture
    setTimeout(async () => {
      if (this.captureSessionId !== sessionId || !this.isListening) return;

      let speechRecStarted = false;
      const hasMediaDevices =
        typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);

      const mediaCapturePromise: Promise<boolean> = (async () => {
        if (!hasMediaDevices) return false;
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });

          if (this.captureSessionId !== sessionId || this.finalizedSessionId === sessionId) {
            stream.getTracks().forEach((t) => t.stop());
            return false;
          }

          this.activeMediaStream = stream;
          this.audioChunks = [];

          try {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioCtx) {
              const ctx = new AudioCtx();
              this.audioCtx = ctx;
              const src = ctx.createMediaStreamSource(stream);
              const analyser = ctx.createAnalyser();
              analyser.fftSize = 512;
              src.connect(analyser);
              const buf = new Uint8Array(analyser.fftSize);
              const startedAt = Date.now();
              let lastLoudAt = Date.now();

              this.vadInterval = setInterval(() => {
                if (this.captureSessionId !== sessionId || !this.isListening) return;
                analyser.getByteTimeDomainData(buf);
                let sum = 0;
                for (let i = 0; i < buf.length; i++) {
                  const v = (buf[i] - 128) / 128;
                  sum += v * v;
                }
                const rms = Math.sqrt(sum / buf.length);
                this.notifyAudioLevel(Math.min(1, rms * 11));
                if (rms > 0.022) {
                  this.speechEnergyDetected = true;
                  lastLoudAt = Date.now();
                } else if (
                  this.speechEnergyDetected &&
                  Date.now() - lastLoudAt > 1700 &&
                  Date.now() - startedAt > 900
                ) {
                  this.stopListening();
                }
              }, 80);
            }
          } catch {}

          const preferredMime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
            ? "audio/webm;codecs=opus"
            : MediaRecorder.isTypeSupported("audio/webm")
            ? "audio/webm"
            : MediaRecorder.isTypeSupported("audio/mp4")
            ? "audio/mp4"
            : "";

          const recorder = preferredMime
            ? new MediaRecorder(stream, { mimeType: preferredMime })
            : new MediaRecorder(stream);

          this.activeMediaRecorder = recorder;
          recorder.ondataavailable = (ev) => {
            if (ev.data && ev.data.size > 0) {
              this.audioChunks.push(ev.data);
            }
          };

          recorder.onstop = () => {
            this.activeMediaRecorder = null;
            stream.getTracks().forEach((t) => t.stop());
            if (this.vadInterval) {
              clearInterval(this.vadInterval);
              this.vadInterval = null;
            }
            if (this.audioCtx) {
              try {
                this.audioCtx.close();
              } catch {}
              this.audioCtx = null;
            }

            if (
              this.captureSessionId !== sessionId ||
              this.finalizedSessionId === sessionId ||
              this.discardMediaFallback
            ) {
              return;
            }

            if (this.bestTranscript.trim()) {
              this.finalizeSpeechTranscript(sessionId, this.bestTranscript.trim());
              return;
            }

            const blobMime = recorder.mimeType || preferredMime || "audio/webm";
            const blob = new Blob(this.audioChunks, { type: blobMime });

            if (blob.size < 1400) {
              this.finalizedSessionId = sessionId;
              this.notifyListening(false);
              this.commandCallbacks.onError?.(
                "Awaaz record nahi ho saki. Dobara 'Hi Jarvis' bolein ya kareeb se bolein."
              );
              this.commandCallbacks.onEnd?.();
              this.resumeWakeDetectorSoon();
              return;
            }

            const reader = new FileReader();
            reader.onloadend = () => {
              if (this.captureSessionId !== sessionId || this.finalizedSessionId === sessionId) return;
              this.finalizedSessionId = sessionId;
              this.notifyListening(false);
              const dataUrl = String(reader.result || "");
              const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
              if (base64 && this.commandCallbacks.onAudioCaptured) {
                this.commandCallbacks.onAudioCaptured(base64, blobMime);
              } else {
                this.commandCallbacks.onError?.("Voice audio capture ready, lekin handler missing tha.");
              }
              this.commandCallbacks.onEnd?.();
              this.resumeWakeDetectorSoon();
            };
            reader.readAsDataURL(blob);
          };

          recorder.start(250);
          return true;
        } catch (micErr) {
          console.warn("MediaRecorder microphone capture unavailable:", micErr);
          return false;
        }
      })();

      // Engine 1: Fast Web Speech API
      const rec = this.createCommandRecognitionInstance(lang);
      if (rec) {
        this.recognition = rec;
        let accumulatedFinal = "";
        let lastInterim = "";

        rec.onresult = (event: any) => {
          if (this.captureSessionId !== sessionId) return;
          let interim = "";
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const text = String(event.results[i][0]?.transcript || "");
            if (event.results[i].isFinal) {
              accumulatedFinal += " " + text;
            } else {
              interim += " " + text;
            }
          }
          lastInterim = interim.trim();
          const combined = `${accumulatedFinal} ${lastInterim}`.trim();
          if (combined) {
            this.bestTranscript = combined;
            this.speechEnergyDetected = true;
            this.commandCallbacks.onResult?.(combined, false);
          }

          if (accumulatedFinal.trim().length > 0 && !lastInterim) {
            this.finalizeSpeechTranscript(sessionId, accumulatedFinal.trim());
          }
        };

        rec.onerror = (ev: any) => {
          if (this.captureSessionId !== sessionId) return;
          const err = ev?.error || "error";
          console.warn("Command SpeechRecognition error:", err);
        };

        rec.onend = async () => {
          if (this.captureSessionId !== sessionId) return;
          if (this.finalizedSessionId === sessionId) return;

          if (this.bestTranscript.trim()) {
            this.finalizeSpeechTranscript(sessionId, this.bestTranscript.trim());
            return;
          }

          const mediaReady = await mediaCapturePromise;
          if (this.captureSessionId !== sessionId || this.finalizedSessionId === sessionId) return;

          if (mediaReady && this.activeMediaRecorder && this.activeMediaRecorder.state === "recording") {
            if (this.speechEnergyDetected) {
              try {
                this.activeMediaRecorder.stop();
              } catch {}
            } else {
              setTimeout(() => {
                if (
                  this.captureSessionId === sessionId &&
                  this.finalizedSessionId !== sessionId &&
                  this.activeMediaRecorder &&
                  this.activeMediaRecorder.state === "recording"
                ) {
                  try {
                    this.activeMediaRecorder.stop();
                  } catch {}
                }
              }, 2800);
            }
          } else if (this.finalizedSessionId !== sessionId) {
            this.finalizedSessionId = sessionId;
            this.notifyListening(false);
            this.cleanupCaptureResources(true);
            this.commandCallbacks.onError?.(
              "Awaaz detect nahi hui. Mic permission check karein aur dobara bolein."
            );
            this.commandCallbacks.onEnd?.();
            this.resumeWakeDetectorSoon();
          }
        };

        try {
          rec.start();
          speechRecStarted = true;
        } catch (err) {
          console.warn("SpeechRecognition start threw:", err);
        }
      }

      if (!speechRecStarted) {
        const mediaReady = await mediaCapturePromise;
        if (!mediaReady && this.captureSessionId === sessionId && this.finalizedSessionId !== sessionId) {
          this.finalizedSessionId = sessionId;
          this.notifyListening(false);
          this.cleanupCaptureResources(true);
          this.commandCallbacks.onError?.(
            isNativeAndroidApk()
              ? "Android Microphone permission allow karein."
              : "Microphone permission blocked hai! Browser settings mein Microphone Allow karein."
          );
          this.commandCallbacks.onEnd?.();
          this.resumeWakeDetectorSoon();
        }
      }
    }, 260);

    return true;
  }

  public stopListening() {
    const sessionId = this.captureSessionId;
    if (!this.isListening && this.finalizedSessionId === sessionId) {
      this.resumeWakeMode();
      return;
    }

    if (this.bestTranscript.trim()) {
      this.finalizeSpeechTranscript(sessionId, this.bestTranscript.trim());
      return;
    }

    if (isNativeAndroidApk()) {
      stopNativeAndroidListening();
      setTimeout(() => {
        if (this.captureSessionId === sessionId && this.finalizedSessionId !== sessionId) {
          this.finalizedSessionId = sessionId;
          this.notifyListening(false);
          this.cleanupCaptureResources(true);
          this.commandCallbacks.onEnd?.();
          this.resumeWakeDetectorSoon();
        }
      }, 1400);
      return;
    }

    this.notifyListening(false);
    if (this.maxCaptureTimer) {
      clearTimeout(this.maxCaptureTimer);
      this.maxCaptureTimer = null;
    }

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {}
    }

    if (this.activeMediaRecorder && this.activeMediaRecorder.state === "recording") {
      this.discardMediaFallback = false;
      try {
        this.activeMediaRecorder.stop();
      } catch {}
    } else if (this.finalizedSessionId !== sessionId) {
      this.finalizedSessionId = sessionId;
      this.cleanupCaptureResources(true);
      this.commandCallbacks.onEnd?.();
      this.resumeWakeDetectorSoon();
    }
  }

  public cancelListening() {
    const sessionId = this.captureSessionId;
    this.finalizedSessionId = sessionId;
    this.bestTranscript = "";
    this.notifyListening(false);
    this.cleanupCaptureResources(true);
    if (isNativeAndroidApk()) {
      cancelNativeAndroidListening();
    } else {
      try {
        this.recognition?.abort();
      } catch {}
    }
    this.resumeWakeMode();
  }

  public getListeningState() {
    return this.isListening;
  }

  public getSpeakingState() {
    return this.isSpeaking;
  }

  private sanitizeForSpeech(raw: string): string {
    return raw
      .replace(/[\u{1F300}-\u{1FAFF}]/gu, "")
      .replace(/[*_`~#>]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  public async speak(
    text: string,
    options: {
      lang?: LanguageCode;
      gender?: VoiceGender;
      rate?: number;
      pitch?: number;
      fast?: boolean;
      useElevenLabs?: boolean;
      elevenLabsVoiceId?: string;
      urduSpeechText?: string;
      forceCustomTest?: boolean;
      preferredBrowserVoiceURI?: string;
      onEnd?: () => void;
    } = {}
  ) {
    const cleanText = this.sanitizeForSpeech(text);
    if (!cleanText) {
      options.onEnd?.();
      return;
    }

    const {
      lang = "ur",
      fast = this.elevenLabsConfig.fastMode,
      useElevenLabs = this.elevenLabsConfig.enabled,
      elevenLabsVoiceId = this.elevenLabsConfig.voiceId,
    } = options;

    const resolvedProfile = this.getEffectiveVoiceProfile(
      lang,
      options.forceCustomTest ? options.gender : undefined
    );
    const effectiveGender: "male" | "female" =
      options.forceCustomTest && (options.gender === "male" || options.gender === "female")
        ? options.gender
        : resolvedProfile.gender;
    const effectivePitch = options.pitch ?? resolvedProfile.pitch;
    const effectiveRate = options.rate ?? resolvedProfile.rate;
    const effectiveBrowserURI = options.preferredBrowserVoiceURI || resolvedProfile.preferredBrowserVoiceURI;

    this.cancelSpeech();
    const mySpeakId = ++this.speakSeqId;

    let finished = false;
    const finishSpeaking = () => {
      if (finished) return;
      finished = true;
      if (mySpeakId === this.speakSeqId) {
        this.notifySpeaking(false);
        options.onEnd?.();
        this.resumeWakeDetectorSoon();
      }
    };

    // Safety timeout prevents isSpeaking from EVER hanging forever if speechSynthesis drops onend!
    const watchdogMs = Math.max(5500, Math.min(22000, cleanText.length * 125));
    this.speakingWatchdogTimer = setTimeout(() => {
      finishSpeaking();
    }, watchdogMs);

    // Pause wake detector cleanly while TTS plays so Jarvis doesn't hear itself
    this.abortWakeRecognitionSafely();

    // Native Android APK Direct Offline-Ready TextToSpeech (Guaranteed female/male greeting & replies without WebView autoplay block)
    const isApkWithoutRemoteServer = isNativeAndroidApk() && !getRemotePcUrl();
    if (isApkWithoutRemoteServer && !useElevenLabs) {
      this.nativeTtsResolve = finishSpeaking;
      const spokeOk = await speakNativeAndroid({
        text: cleanText,
        lang,
        gender: effectiveGender,
        pitch: effectivePitch,
        rate: effectiveRate,
      });
      if (spokeOk || mySpeakId !== this.speakSeqId) {
        return;
      }
      this.nativeTtsResolve = null;
    }

    // 1. Real ElevenLabs TTS
    if (useElevenLabs) {
      try {
        const elRes = await fetch("/api/tts/elevenlabs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: cleanText,
            voiceId: elevenLabsVoiceId,
            fast,
          }),
        });
        if (mySpeakId !== this.speakSeqId) return;
        if (elRes.ok) {
          const elData = await elRes.json();
          if (mySpeakId !== this.speakSeqId) return;
          if (elData.base64Audio) {
            const audio = new Audio(
              `data:${elData.format || "audio/mpeg"};base64,${elData.base64Audio}`
            );
            this.currentAudioElement = audio;
            audio.playbackRate = Math.min(1.35, Math.max(0.75, effectiveRate));
            audio.onplay = () => {
              if (mySpeakId === this.speakSeqId) this.notifySpeaking(true);
            };
            audio.onended = finishSpeaking;
            audio.onerror = () => {
              if (mySpeakId !== this.speakSeqId) return;
              this.fallbackBrowserSpeak(
                cleanText,
                {
                  ...options,
                  gender: effectiveGender,
                  pitch: effectivePitch,
                  rate: effectiveRate,
                  preferredBrowserVoiceURI: effectiveBrowserURI,
                },
                finishSpeaking
              );
            };
            try {
              await audio.play();
              return;
            } catch {}
          }
        }
      } catch {}
    }

    if (mySpeakId !== this.speakSeqId) return;

    // 2. Server-side 100% Pakistani Urdu Neural TTS (Web preview or linked PC server)
    try {
      const controller = new AbortController();
      this.activeTtsAbort = controller;
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      const res = await fetch("/api/jarvis/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          text: cleanText,
          urduSpeechText: options.urduSpeechText,
          language: lang,
          gender: effectiveGender,
          pitch: effectivePitch,
          rate: effectiveRate,
        }),
      });
      clearTimeout(timeoutId);
      if (this.activeTtsAbort === controller) {
        this.activeTtsAbort = null;
      }

      if (mySpeakId !== this.speakSeqId) return;

      let serverUrduText: string | undefined = options.urduSpeechText;
      if (res.ok) {
        const data = await res.json();
        if (mySpeakId !== this.speakSeqId) return;
        serverUrduText =
          typeof data.urduScriptText === "string" && data.urduScriptText.trim()
            ? data.urduScriptText
            : serverUrduText;
        if (data.base64Audio) {
          const audio = new Audio(
            `data:${data.format || "audio/mpeg"};base64,${data.base64Audio}`
          );
          this.currentAudioElement = audio;
          if (data.singleGenderEngine && effectiveGender === "male") {
            // Shift pitch cleanly downward into a natural male register for Wasu
            (audio as any).preservesPitch = false;
            (audio as any).mozPreservesPitch = false;
            (audio as any).webkitPreservesPitch = false;
            audio.playbackRate = Math.min(0.94, Math.max(0.76, effectivePitch * 0.89));
          } else {
            (audio as any).preservesPitch = true;
            (audio as any).mozPreservesPitch = true;
            (audio as any).webkitPreservesPitch = true;
            audio.playbackRate = Math.min(1.2, Math.max(0.86, effectiveRate));
          }
          audio.onplay = () => {
            if (mySpeakId === this.speakSeqId) this.notifySpeaking(true);
          };
          audio.onended = finishSpeaking;
          audio.onerror = () => {
            if (mySpeakId !== this.speakSeqId) return;
            this.fallbackBrowserSpeak(
              cleanText,
              {
                ...options,
                gender: effectiveGender,
                pitch: effectivePitch,
                rate: effectiveRate,
                urduScriptText: serverUrduText,
                preferredBrowserVoiceURI: effectiveBrowserURI,
              },
              finishSpeaking
            );
          };
          try {
            await audio.play();
            return;
          } catch {}
        }
      }
      if (mySpeakId !== this.speakSeqId) return;
      this.fallbackBrowserSpeak(
        cleanText,
        {
          ...options,
          gender: effectiveGender,
          pitch: effectivePitch,
          rate: effectiveRate,
          urduScriptText: serverUrduText,
          preferredBrowserVoiceURI: effectiveBrowserURI,
        },
        finishSpeaking
      );
      return;
    } catch {}

    if (mySpeakId !== this.speakSeqId) return;

    // 3. Browser Synthesis Fallback
    this.fallbackBrowserSpeak(
      cleanText,
      {
        ...options,
        gender: effectiveGender,
        pitch: effectivePitch,
        rate: effectiveRate,
        urduScriptText: options.urduSpeechText,
        preferredBrowserVoiceURI: effectiveBrowserURI,
      },
      finishSpeaking
    );
  }

  private fallbackBrowserSpeak(
    text: string,
    options: {
      lang?: LanguageCode;
      gender?: VoiceGender;
      rate?: number;
      pitch?: number;
      urduScriptText?: string;
      preferredBrowserVoiceURI?: string;
      onEnd?: () => void;
    } = {},
    onComplete?: () => void
  ) {
    if (isNativeAndroidApk()) {
      this.nativeTtsResolve = () => {
        if (onComplete) onComplete();
        else {
          this.notifySpeaking(false);
          options.onEnd?.();
        }
      };
      speakNativeAndroid({
        text,
        lang: options.lang || "ur",
        gender: options.gender === "male" ? "male" : "female",
        pitch: options.pitch,
        rate: options.rate,
      }).then((ok) => {
        if (!ok) {
          const cb = this.nativeTtsResolve;
          this.nativeTtsResolve = null;
          cb?.();
        }
      });
      return;
    }

    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      if (onComplete) onComplete();
      else options.onEnd?.();
      return;
    }

    window.speechSynthesis.cancel();

    const { lang = "ur", gender = "female", rate = 0.97, pitch, urduScriptText, preferredBrowserVoiceURI } = options;
    const isMaleRequested = gender === "male";

    const liveVoices = window.speechSynthesis.getVoices();
    const voices = liveVoices.length > 0 ? liveVoices : this.cachedVoices;

    const isMaleVoiceName = (name: string) =>
      /\b(david|mark|george|daniel|alex|asad|salman|uzair|ravi|hemant|prabhat|madhur|richard|guy|ryan|andrew|james|steffan|christopher|eric|roger|male)\b/i.test(
        name
      ) && !/\bfemale\b/i.test(name);

    const isFemaleVoiceName = (name: string) =>
      /(uzma|gul|fatima|zira|aria|jenny|sonia|hazel|libby|samantha|swara|heera|kalpana|neerja|priya|lekha|female)/i.test(
        name
      );

    const pool = isMaleRequested ? voices : voices.filter((v) => !isMaleVoiceName(v.name));
    const searchPool = pool.length > 0 ? pool : voices;

    let selectedVoice: SpeechSynthesisVoice | null = null;
    let isSouthAsianVoice = false;

    if (preferredBrowserVoiceURI) {
      const matchedCustom = voices.find((v) => v.voiceURI === preferredBrowserVoiceURI);
      if (matchedCustom) {
        selectedVoice = matchedCustom;
        const l = matchedCustom.lang.toLowerCase();
        isSouthAsianVoice = l.startsWith("ur") || l.startsWith("pa") || l.startsWith("hi");
      }
    }

    if (!selectedVoice && (lang === "ur" || lang === "pa")) {
      const pakUrduVoice =
        searchPool.find(
          (v) =>
            (v.lang.toLowerCase().includes("ur-pk") ||
              v.name.toLowerCase().includes("uzma") ||
              v.name.toLowerCase().includes("asad") ||
              v.name.toLowerCase().includes("salman") ||
              v.name.toLowerCase().includes("gul")) &&
            (isMaleRequested ? isMaleVoiceName(v.name) : !isMaleVoiceName(v.name))
        ) ||
        searchPool.find((v) => v.lang.toLowerCase().startsWith("ur") || v.name.toLowerCase().includes("urdu")) ||
        null;

      if (pakUrduVoice) {
        selectedVoice = pakUrduVoice;
        isSouthAsianVoice = true;
      } else {
        const regionalVoice =
          searchPool.find((v) => v.lang.toLowerCase().startsWith("pa") || v.name.toLowerCase().includes("punjabi")) ||
          searchPool.find((v) => v.lang.toLowerCase().startsWith("hi") || v.name.toLowerCase().includes("hindi")) ||
          voices.find((v) => v.lang.toLowerCase().startsWith("ur") || v.lang.toLowerCase().startsWith("hi")) ||
          null;
        if (regionalVoice) {
          selectedVoice = regionalVoice;
          isSouthAsianVoice = true;
        } else {
          selectedVoice =
            searchPool.find((v) => (isMaleRequested ? isMaleVoiceName(v.name) : isFemaleVoiceName(v.name))) ||
            searchPool[0] ||
            null;
        }
      }
    } else if (!selectedVoice) {
      selectedVoice =
        searchPool.find((v) => (isMaleRequested ? isMaleVoiceName(v.name) : isFemaleVoiceName(v.name))) ||
        searchPool.find((v) => v.lang.startsWith("en-GB") || v.lang.startsWith("en-US") || v.lang.startsWith("en-IN")) ||
        searchPool[0] ||
        null;
    }

    const spokenContent =
      isSouthAsianVoice && urduScriptText && urduScriptText.trim().length > 0 ? urduScriptText.trim() : text;

    const utterance = new SpeechSynthesisUtterance(spokenContent);
    if (lang === "ur" || lang === "pa") {
      utterance.lang = selectedVoice?.lang?.toLowerCase().startsWith("ur")
        ? selectedVoice.lang
        : selectedVoice?.lang?.toLowerCase().startsWith("hi")
        ? selectedVoice.lang
        : "ur-PK";
    } else {
      utterance.lang = selectedVoice?.lang || "en-US";
    }

    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.rate = Math.min(1.35, Math.max(0.75, rate));
    utterance.pitch =
      pitch !== undefined
        ? Math.min(1.5, Math.max(0.65, pitch))
        : isMaleRequested
        ? 0.9
        : 1.04;

    utterance.onstart = () => this.notifySpeaking(true);
    utterance.onend = () => {
      if (onComplete) onComplete();
      else {
        this.notifySpeaking(false);
        options.onEnd?.();
      }
    };
    utterance.onerror = () => {
      if (onComplete) onComplete();
      else {
        this.notifySpeaking(false);
        options.onEnd?.();
      }
    };

    try {
      window.speechSynthesis.speak(utterance);
    } catch {
      if (onComplete) onComplete();
      else {
        this.notifySpeaking(false);
        options.onEnd?.();
      }
    }
  }

  public cancelSpeech() {
    this.speakSeqId += 1;
    this.nativeTtsResolve = null;
    if (isNativeAndroidApk()) {
      stopNativeAndroidSpeech().catch(() => {});
    }
    if (this.activeTtsAbort) {
      try {
        this.activeTtsAbort.abort();
      } catch {}
      this.activeTtsAbort = null;
    }
    if (this.speakingWatchdogTimer) {
      clearTimeout(this.speakingWatchdogTimer);
      this.speakingWatchdogTimer = null;
    }
    if (this.currentAudioElement) {
      this.currentAudioElement.pause();
      this.currentAudioElement = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    this.notifySpeaking(false);
  }
}

export const speechService = new SpeechService();
