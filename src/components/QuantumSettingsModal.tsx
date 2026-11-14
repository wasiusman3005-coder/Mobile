import React, { useState, useRef, useEffect } from "react";
import { Settings, X, Palette, Volume2, AudioWaveform, Image, Shield, Clock, Upload, Check, RefreshCw, Sparkles, Sliders, Globe, Radio, Play, Zap, Fingerprint, ScanFace, Lock, Trash2 } from "lucide-react";
import { soundEffects } from "../services/soundEffects";
import { speechService } from "../services/speechService";
import { storageService, defaultAvatarConfig, defaultSecurityConfig } from "../services/storage";
import {
  checkBiometricCapabilities,
  enrollDeviceBiometric,
  verifyDeviceBiometric,
  saveStoredSecurityConfig,
} from "../services/biometricAuth";
import { triggerHaptic } from "../services/mobileDeviceActions";
import { DashboardCustomization, CustomVoiceProfile, AccentTheme, LanguageCode, MobileSecurityConfig } from "../types";
import { ELEVENLABS_VOICE_PRESETS, getCharacterDisplayName } from "../data/jarvisCatalog";

interface QuantumSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  customization: DashboardCustomization;
  onUpdateCustomization: (updated: DashboardCustomization) => void;
  language: LanguageCode;
  onLanguageChange: (lang: LanguageCode) => void;
  isWakeWordActive: boolean;
  onToggleWakeWord: () => void;
  onExportBackup: () => void;
  onImportBackup: () => void;
}

export const QuantumSettingsModal: React.FC<QuantumSettingsModalProps> = ({
  isOpen,
  onClose,
  customization,
  onUpdateCustomization,
  language,
  onLanguageChange,
  isWakeWordActive,
  onToggleWakeWord,
  onExportBackup,
  onImportBackup,
}) => {
  const [activeTab, setActiveTab] = useState<"appearance" | "voice" | "security" | "screensaver" | "health" | "data">("appearance");

  // Custom Voice Recording, Upload & Browser Voice List State
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [recordedAudioBase64, setRecordedAudioBase64] = useState<string | null>(null);
  const [newVoiceName, setNewVoiceName] = useState("");
  const [newVoiceGender, setNewVoiceGender] = useState<"male" | "female">("female");
  const [newVoicePitch, setNewVoicePitch] = useState(1.03);
  const [newVoiceRate, setNewVoiceRate] = useState(0.98);
  const [newVoiceBrowserURI, setNewVoiceBrowserURI] = useState("");
  const [newVoiceAssignTo, setNewVoiceAssignTo] = useState<"custom" | "male" | "female">("custom");
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [micBannerError, setMicBannerError] = useState<string | null>(null);
  const [elevenServerConfigured, setElevenServerConfigured] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Biometric (Fingerprint & Face Unlock) State
  const [bioCaps, setBioCaps] = useState({
    webAuthnSupported: false,
    platformAuthenticatorAvailable: false,
    cameraSupported: false,
    nativeApkSupported: false,
    blockedByIframe: false,
  });
  const [bioStatusMsg, setBioStatusMsg] = useState<string | null>(null);
  const [isEnrollingBio, setIsEnrollingBio] = useState(false);
  const [isFaceCamOpen, setIsFaceCamOpen] = useState(false);
  const faceVideoRef = useRef<HTMLVideoElement | null>(null);
  const faceStreamRef = useRef<MediaStream | null>(null);

  const avatarCfg = customization.avatarConfig || defaultAvatarConfig;
  const securityCfg: MobileSecurityConfig = customization.securityConfig || defaultSecurityConfig;
  const femaleCharName = getCharacterDisplayName(avatarCfg, "female");
  const maleCharName = getCharacterDisplayName(avatarCfg, "male");
  const activeCharName = getCharacterDisplayName(avatarCfg);

  const stopFaceCamera = () => {
    if (faceStreamRef.current) {
      faceStreamRef.current.getTracks().forEach((t) => t.stop());
      faceStreamRef.current = null;
    }
    setIsFaceCamOpen(false);
  };

  useEffect(() => {
    if (!isOpen) {
      stopFaceCamera();
      return;
    }
    checkBiometricCapabilities().then(setBioCaps);
    setBrowserVoices(speechService.getAvailableBrowserVoices());
    fetch("/api/tts/elevenlabs/status")
      .then((r) => r.json())
      .then((d) => setElevenServerConfigured(Boolean(d.configured)))
      .catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  // Preset themes
  const colorPresets: { theme: AccentTheme; label: string; hex: string; desc: string }[] = [
    { theme: "cyan", label: "Quantum Cyan", hex: "#06b6d4", desc: "Tachyon Coherence Default" },
    { theme: "purple", label: "Quantum Amethyst", hex: "#a855f7", desc: "Deep Violet Entanglement" },
    { theme: "emerald", label: "Matrix Emerald", hex: "#10b981", desc: "Bio-Plasma Resonance" },
    { theme: "amber", label: "Solar Gold", hex: "#f59e0b", desc: "Fusion Reactor Glow" },
    { theme: "rose", label: "Tachyon Rose", hex: "#f43f5e", desc: "Supernova Red Shift" },
    { theme: "blue", label: "Electric Cobalt", hex: "#3b82f6", desc: "Cybernetic High Voltage" },
  ];

  const handleSelectTheme = (theme: AccentTheme, hex: string) => {
    soundEffects.playClick();
    onUpdateCustomization({
      ...customization,
      accentTheme: theme,
      customAccentHex: hex,
    });
  };

  // Custom Logo upload handler
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target?.result as string;
      onUpdateCustomization({
        ...customization,
        customLogoUrl: url,
      });
      soundEffects.playBeepConfirm();
    };
    reader.readAsDataURL(file);
  };

  // Custom Wallpaper upload handler
  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target?.result as string;
      onUpdateCustomization({
        ...customization,
        customBgUrl: url,
      });
      soundEffects.playBeepConfirm();
    };
    reader.readAsDataURL(file);
  };

  // Voice Recording Functionality (Microphone)
  const startRecordingVoice = async () => {
    try {
      soundEffects.playClick();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = String(reader.result || "");
          if (dataUrl) {
            setRecordedAudioBase64(dataUrl);
            setRecordedAudioUrl(dataUrl);
          }
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setMicBannerError(null);
      setIsRecordingVoice(true);
    } catch {
      setMicBannerError("Microphone permission denied or unavailable. Pitch & rate sliders or Audio File Upload still work cleanly.");
    }
  };

  const stopRecordingVoice = () => {
    soundEffects.playBeepConfirm();
    if (mediaRecorderRef.current && isRecordingVoice) {
      mediaRecorderRef.current.stop();
      setIsRecordingVoice(false);
    }
  };

  const handleUploadCustomVoiceFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      setMicBannerError("Audio file 4MB se chhoti rakhein taa-ke phone storage mein save ho sake.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = String(ev.target?.result || "");
      if (dataUrl) {
        setMicBannerError(null);
        setRecordedAudioBase64(dataUrl);
        setRecordedAudioUrl(dataUrl);
        if (!newVoiceName.trim()) {
          setNewVoiceName(file.name.replace(/\.[^.]+$/, ""));
        }
        soundEffects.playBeepConfirm();
      }
    };
    reader.readAsDataURL(file);
  };

  // Save new custom voice profile (Persistent Base64 + Slot Assignment)
  const handleSaveCustomVoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVoiceName.trim()) return;

    soundEffects.playQuantumStartup();

    const newProfile: CustomVoiceProfile = {
      id: "voice-" + Date.now(),
      name: newVoiceName.trim(),
      gender: newVoiceGender,
      pitch: Number(newVoicePitch),
      rate: Number(newVoiceRate),
      audioBase64: recordedAudioBase64 || undefined,
      browserVoiceURI: newVoiceBrowserURI || undefined,
      assignedTo: newVoiceAssignTo === "male" || newVoiceAssignTo === "female" ? newVoiceAssignTo : "both",
      description: `Custom ${newVoiceGender} voice profile customized by Commander Wasi`,
      dateAdded: new Date().toLocaleDateString(),
    };

    const updatedVoices = [...customization.customVoices, newProfile];
    const nextAvatar = { ...avatarCfg };
    if (newVoiceAssignTo === "male") {
      nextAvatar.maleVoiceSettings = {
        pitch: newProfile.pitch,
        rate: newProfile.rate,
        preferredBrowserVoiceURI: newProfile.browserVoiceURI,
        activeCustomVoiceId: newProfile.id,
      };
      nextAvatar.characterGender = "male";
      nextAvatar.personalityId = "wasu_male";
    } else if (newVoiceAssignTo === "female") {
      nextAvatar.femaleVoiceSettings = {
        pitch: newProfile.pitch,
        rate: newProfile.rate,
        preferredBrowserVoiceURI: newProfile.browserVoiceURI,
        activeCustomVoiceId: newProfile.id,
      };
      nextAvatar.characterGender = "female";
      nextAvatar.personalityId = "wasi_ki_jan_female";
    }

    onUpdateCustomization({
      ...customization,
      customVoices: updatedVoices,
      avatarConfig: nextAvatar,
      activeVoiceMode: newVoiceAssignTo === "male" ? "male" : newVoiceAssignTo === "female" ? "female" : "custom",
      activeCustomVoiceId: newProfile.id,
    });

    setNewVoiceName("");
    setRecordedAudioUrl(null);
    setRecordedAudioBase64(null);
  };

  const handleTestVoice = (
    pitch: number,
    rate: number,
    gender: "male" | "female",
    preferredBrowserVoiceURI?: string
  ) => {
    soundEffects.playClick();
    const charLabel = gender === "male" ? maleCharName : femaleCharName;
    const demo =
      language === "pa"
        ? `Sat Sri Akal Wasi paji! Main ${charLabel} haan, eh tuhada 100 percent Pakistani custom voice test sample ae.`
        : language === "en"
        ? `Greetings Commander Wasi! This is ${charLabel} testing your customized voice frequency and speed.`
        : gender === "male"
        ? `Assalam o Alaikum Wasi Sahab! Main ${charLabel} hoon, ab main bilkul 100 percent Pakistani Urdu lehje mein baat kar raha hoon.`
        : `Assalam o Alaikum Wasi Sahab! Main ${charLabel} hoon, ab main bilkul 100 percent Pakistani Urdu lehje mein baat kar rahi hoon.`;

    speechService.speak(demo, {
      lang: language,
      gender,
      pitch,
      rate,
      preferredBrowserVoiceURI,
      forceCustomTest: true,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/85 backdrop-blur-xl animate-fadeIn font-rajdhani">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-950/95 border border-cyan-500/40 rounded-3xl shadow-2xl shadow-cyan-950/80 flex flex-col overflow-hidden text-slate-100">
        {/* Glow Header */}
        <div className="px-6 py-4 bg-slate-900/90 border-b border-cyan-500/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-cyan-300">
              <Settings className="w-5 h-5 animate-spin" style={{ animationDuration: "14s" }} />
            </div>
            <div>
              <h2 className="font-orbitron font-bold text-base md:text-lg text-cyan-300 glow-text-cyan uppercase">
                QUANTUM SYSTEM & HUD CUSTOMIZATION
              </h2>
              <p className="text-xs font-mono text-slate-400">
                Personalize dashboard aesthetics, voice cloning, language, screensaver, and health limits
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-900/60 px-6 pt-3 gap-2 overflow-x-auto text-xs font-mono">
          <button
            onClick={() => {
              soundEffects.playClick();
              setActiveTab("appearance");
            }}
            className={`px-4 py-2 rounded-t-lg transition cursor-pointer flex items-center gap-2 ${
              activeTab === "appearance"
                ? "bg-slate-950 text-cyan-400 font-bold border-t-2 border-cyan-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Theme & Colors</span>
          </button>

          <button
            onClick={() => {
              soundEffects.playClick();
              setActiveTab("voice");
            }}
            className={`px-4 py-2 rounded-t-lg transition cursor-pointer flex items-center gap-2 ${
              activeTab === "voice"
                ? "bg-slate-950 text-cyan-400 font-bold border-t-2 border-cyan-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <AudioWaveform className="w-3.5 h-3.5" />
            <span>Voice & Custom Cloning</span>
          </button>

          <button
            onClick={() => {
              soundEffects.playClick();
              setActiveTab("security");
            }}
            className={`px-4 py-2 rounded-t-lg transition cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === "security"
                ? "bg-slate-950 text-emerald-400 font-bold border-t-2 border-emerald-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Fingerprint className="w-3.5 h-3.5" />
            <span>Fingerprint &amp; Face Unlock</span>
          </button>

          <button
            onClick={() => {
              soundEffects.playClick();
              setActiveTab("screensaver");
            }}
            className={`px-4 py-2 rounded-t-lg transition cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === "screensaver"
                ? "bg-slate-950 text-cyan-400 font-bold border-t-2 border-cyan-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Screensaver &amp; Away</span>
          </button>

          <button
            onClick={() => {
              soundEffects.playClick();
              setActiveTab("health");
            }}
            className={`px-4 py-2 rounded-t-lg transition cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === "health"
                ? "bg-slate-950 text-cyan-400 font-bold border-t-2 border-cyan-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Health &amp; Rest Timer</span>
          </button>

          <button
            onClick={() => {
              soundEffects.playClick();
              setActiveTab("data");
            }}
            className={`px-4 py-2 rounded-t-lg transition cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === "data"
                ? "bg-slate-950 text-cyan-400 font-bold border-t-2 border-cyan-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Backup &amp; Sync</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs font-mono">
          {/* 1. APPEARANCE & THEME */}
          {activeTab === "appearance" && (
            <div className="space-y-6">
              {/* SINGLE LOCKED THEME: COCKPIT FIELD TACHYON */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-orbitron font-bold text-sm text-cyan-300 uppercase flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <span>Active Cockpit Interface Theme</span>
                  </h3>
                  <span className="text-[10px] text-emerald-400 font-bold px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40">
                    LOCKED TO COCKPIT TACHYON
                  </span>
                </div>
                <div className="p-4 rounded-2xl border-2 border-cyan-400 bg-slate-900 shadow-xl shadow-cyan-950/70 flex items-center justify-between gap-4">
                  <div>
                    <div className="font-orbitron font-bold text-sm text-white">
                      Cockpit Field Tachyon Theme
                    </div>
                    <p className="text-[11px] text-slate-300 mt-1 font-mono">
                      Primary spatial tachyon cockpit interface with 3D morphing core and live mobile HUD telemetry.
                    </p>
                  </div>
                  <span className="flex items-center gap-1 text-[10px] font-mono px-3 py-1 rounded-full bg-cyan-400 text-black font-bold shrink-0">
                    <Check className="w-3.5 h-3.5" /> ACTIVE
                  </span>
                </div>
              </div>

              {/* Color Presets */}
              <div>
                <h3 className="font-orbitron font-bold text-sm text-cyan-300 uppercase mb-3 flex items-center gap-2">
                  <Palette className="w-4 h-4 text-cyan-400" />
                  <span>Quantum Color Presets</span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {colorPresets.map((preset) => (
                    <button
                      key={preset.theme}
                      onClick={() => handleSelectTheme(preset.theme, preset.hex)}
                      className={`p-3 rounded-2xl border text-left transition flex items-center justify-between cursor-pointer ${
                        customization.accentTheme === preset.theme
                          ? "bg-slate-900 border-cyan-400 shadow-md shadow-cyan-950 text-slate-100"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-4 h-4 rounded-full shadow-sm"
                          style={{ backgroundColor: preset.hex }}
                        ></span>
                        <div>
                          <div className="font-semibold text-xs text-slate-200">{preset.label}</div>
                          <div className="text-[10px] text-slate-500">{preset.desc}</div>
                        </div>
                      </div>
                      {customization.accentTheme === preset.theme && (
                        <Check className="w-4 h-4 text-cyan-400" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Hex Color */}
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-4">
                <div>
                  <div className="font-semibold text-slate-200 text-xs">Custom Hex Accent Color</div>
                  <div className="text-[10px] text-slate-400">Pick any color code for your personalized holographic HUD</div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={customization.customAccentHex}
                    onChange={(e) => handleSelectTheme("custom", e.target.value)}
                    className="w-8 h-8 rounded-lg border border-slate-700 bg-transparent cursor-pointer"
                  />
                  <span className="font-mono text-cyan-400 font-bold">{customization.customAccentHex}</span>
                </div>
              </div>

              {/* Custom Logo & Wallpaper */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Custom Logo */}
                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200 text-xs">Custom Brand Logo</span>
                    {customization.customLogoUrl && (
                      <button
                        onClick={() => onUpdateCustomization({ ...customization, customLogoUrl: "" })}
                        className="text-red-400 hover:text-red-300 text-[10px]"
                      >
                        Reset Default
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Upload your own custom image or avatar to replace the top OS emblem.
                  </p>
                  <label className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-950 border border-dashed border-slate-700 hover:border-cyan-400 text-slate-300 cursor-pointer transition">
                    <Upload className="w-4 h-4 text-cyan-400" />
                    <span>Upload Logo Image</span>
                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  </label>
                </div>

                {/* Custom Wallpaper */}
                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200 text-xs">Custom Background Wallpaper</span>
                    {customization.customBgUrl && (
                      <button
                        onClick={() => onUpdateCustomization({ ...customization, customBgUrl: "" })}
                        className="text-red-400 hover:text-red-300 text-[10px]"
                      >
                        Reset Default
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Set a custom image wallpaper behind the holographic HUD.
                  </p>
                  <label className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-950 border border-dashed border-slate-700 hover:border-cyan-400 text-slate-300 cursor-pointer transition">
                    <Upload className="w-4 h-4 text-cyan-400" />
                    <span>Upload Wallpaper</span>
                    <input type="file" accept="image/*" onChange={handleBgUpload} className="hidden" />
                  </label>
                </div>
              </div>

              {/* 3D Background & Scanlines Toggle */}
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-200 text-xs">3D Dynamic Moving Quantum Logos</div>
                    <div className="text-[10px] text-slate-400">Renders animated rotating Tachyon Torus, Qubit and particles</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={customization.show3DBackground}
                    onChange={(e) =>
                      onUpdateCustomization({ ...customization, show3DBackground: e.target.checked })
                    }
                    className="w-4 h-4 accent-cyan-400 rounded cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                  <div>
                    <div className="font-semibold text-slate-200 text-xs">Cybernetic CRT Scanlines</div>
                    <div className="text-[10px] text-slate-400">Adds subtle retro-futuristic holographic raster lines</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={customization.scanlines}
                    onChange={(e) =>
                      onUpdateCustomization({ ...customization, scanlines: e.target.checked })
                    }
                    className="w-4 h-4 accent-cyan-400 rounded cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 2. VOICE & CUSTOM CLONING */}
          {activeTab === "voice" && (
            <div className="space-y-6">
              {/* Language Selection */}
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                <h3 className="font-orbitron font-bold text-sm text-cyan-300 uppercase flex items-center gap-2">
                  <Globe className="w-4 h-4 text-cyan-400" />
                  <span>Language & Regional Accent</span>
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: "ur" as const, name: "\u0627\u0631\u062f\u0648 (Urdu)", desc: "Pakistani National Clear Accent" },
                    { id: "pa" as const, name: "\u0a2a\u0a70\u0a1c\u0a3e\u0a2c\u0a40 (Punjabi)", desc: "Lahori Crisp Regional Accent" },
                    { id: "en" as const, name: "English (EN)", desc: "Jarvis Neural Cyber Accent" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => onLanguageChange(item.id)}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                        language === item.id
                          ? "bg-cyan-950 border-cyan-400 text-cyan-300 shadow-md shadow-cyan-950"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      <div className="font-bold text-xs">{item.name}</div>
                      <div className="text-[10px] text-slate-500 mt-1">{item.desc}</div>
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                  <div>
                    <div className="font-semibold text-slate-200 text-xs">
                      &quot;Hi Jarvis&quot; &amp; &quot;Hi {activeCharName}&quot; Wake-Only Mic Engine
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Mic remains OFF by default and activates when you say &quot;Hi Jarvis&quot; or &quot;Hi {activeCharName}&quot;
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isWakeWordActive}
                    onChange={onToggleWakeWord}
                    className="w-4 h-4 accent-cyan-400 rounded cursor-pointer"
                  />
                </div>
              </div>

              {/* Custom 2-Voice Personas (Strictly 1 Male "Wasu" + 1 Female "Wasi ki Jan") */}
              {(() => {
                const maleSlot = avatarCfg.maleVoiceSettings || { pitch: 0.94, rate: 0.98 };
                const femaleSlot = avatarCfg.femaleVoiceSettings || { pitch: 1.03, rate: 0.97 };
                const voiceSched = avatarCfg.voiceSchedule || {
                  enabled: false,
                  mode: "manual" as const,
                  dayStartHour: 6,
                  nightStartHour: 19,
                  dayVoice: "female" as const,
                  nightVoice: "male" as const,
                  urduVoice: "female" as const,
                  englishVoice: "male" as const,
                };
                const sortedVoices = [...browserVoices].sort((a, b) => {
                  const score = (v: SpeechSynthesisVoice) =>
                    v.lang.toLowerCase().includes("ur-pk") ? 3 : v.lang.toLowerCase().startsWith("ur") ? 2 : 0;
                  return score(b) - score(a);
                });

                return (
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-slate-900/75 border border-cyan-500/40 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="font-orbitron font-bold text-sm text-cyan-300 uppercase flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-cyan-400" />
                            <span>Dual Voice Roster (Only 2 Voices: {maleCharName} &amp; {femaleCharName})</span>
                          </h3>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                            100% Pakistani Urdu accent ke saath dono characters ki pitch, speed, naam aur custom awaz customize karein.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const sampleGender = avatarCfg.characterGender === "male" ? "male" : "female";
                            const activeSlot = sampleGender === "male" ? maleSlot : femaleSlot;
                            handleTestVoice(
                              activeSlot.pitch,
                              activeSlot.rate,
                              sampleGender,
                              activeSlot.preferredBrowserVoiceURI
                            );
                          }}
                          className="px-3 py-1.5 rounded-xl bg-emerald-950 hover:bg-emerald-900 border border-emerald-400/60 text-emerald-200 text-[11px] font-mono flex items-center gap-1.5 cursor-pointer"
                        >
                          <Play className="w-3 h-3" />
                          <span>Test 100% Pakistani Urdu ({activeCharName})</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* MALE CHARACTER: WASU */}
                        <div
                          className={`p-4 rounded-2xl border space-y-3 transition ${
                            avatarCfg.characterGender === "male" && customization.activeVoiceMode !== "custom"
                              ? "bg-sky-950/35 border-sky-400 shadow-lg shadow-sky-950/40"
                              : "bg-slate-950 border-slate-800"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <div className="font-orbitron font-bold text-xs text-sky-300">
                                MALE VOICE • {maleCharName.toUpperCase()}
                              </div>
                              <div className="text-[10px] text-slate-400">ur-PK-AsadNeural / Charon Pakistani Urdu</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const matchedVoice = ELEVENLABS_VOICE_PRESETS.find((v) => v.gender === "male");
                                onUpdateCustomization({
                                  ...customization,
                                  activeVoiceMode: "male",
                                  avatarConfig: {
                                    ...avatarCfg,
                                    characterGender: "male",
                                    personalityId: "wasu_male",
                                    elevenLabsVoiceId: matchedVoice?.id || avatarCfg.elevenLabsVoiceId,
                                  },
                                });
                                soundEffects.playBeepConfirm();
                              }}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${
                                avatarCfg.characterGender === "male"
                                  ? "bg-sky-400 text-slate-950"
                                  : "bg-slate-900 border border-slate-700 text-slate-300 hover:text-white"
                              }`}
                            >
                              {avatarCfg.characterGender === "male" ? "ACTIVE" : "ACTIVATE"}
                            </button>
                          </div>

                          <div>
                            <label className="block text-[10px] text-sky-300 mb-1">Male Character Name</label>
                            <input
                              type="text"
                              value={avatarCfg.customMaleName ?? "Wasu"}
                              onChange={(e) =>
                                onUpdateCustomization({
                                  ...customization,
                                  avatarConfig: { ...avatarCfg, customMaleName: e.target.value },
                                })
                              }
                              maxLength={24}
                              placeholder="Wasu"
                              className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 focus:border-sky-400 rounded-xl text-slate-100 text-xs focus:outline-none"
                            />
                          </div>

                          <div>
                            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                              <span>Pitch</span>
                              <span className="text-sky-300 font-bold">{maleSlot.pitch.toFixed(2)}x</span>
                            </div>
                            <input
                              type="range"
                              min="0.65"
                              max="1.5"
                              step="0.02"
                              value={maleSlot.pitch}
                              onChange={(e) =>
                                onUpdateCustomization({
                                  ...customization,
                                  avatarConfig: {
                                    ...avatarCfg,
                                    maleVoiceSettings: { ...maleSlot, pitch: parseFloat(e.target.value) },
                                  },
                                })
                              }
                              className="w-full accent-sky-400 cursor-pointer"
                            />
                          </div>

                          <div>
                            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                              <span>Speed</span>
                              <span className="text-sky-300 font-bold">{maleSlot.rate.toFixed(2)}x</span>
                            </div>
                            <input
                              type="range"
                              min="0.75"
                              max="1.35"
                              step="0.02"
                              value={maleSlot.rate}
                              onChange={(e) =>
                                onUpdateCustomization({
                                  ...customization,
                                  avatarConfig: {
                                    ...avatarCfg,
                                    maleVoiceSettings: { ...maleSlot, rate: parseFloat(e.target.value) },
                                  },
                                })
                              }
                              className="w-full accent-sky-400 cursor-pointer"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1">System Voice Engine (Optional)</label>
                            <select
                              value={maleSlot.preferredBrowserVoiceURI || ""}
                              onChange={(e) =>
                                onUpdateCustomization({
                                  ...customization,
                                  avatarConfig: {
                                    ...avatarCfg,
                                    maleVoiceSettings: {
                                      ...maleSlot,
                                      preferredBrowserVoiceURI: e.target.value || undefined,
                                    },
                                  },
                                })
                              }
                              className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 text-[11px]"
                            >
                              <option value="">Auto Pakistani Urdu ({maleCharName})</option>
                              {sortedVoices.map((bv) => (
                                <option key={bv.voiceURI} value={bv.voiceURI}>
                                  {bv.name} ({bv.lang})
                                </option>
                              ))}
                            </select>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              handleTestVoice(maleSlot.pitch, maleSlot.rate, "male", maleSlot.preferredBrowserVoiceURI)
                            }
                            className="w-full py-1.5 rounded-xl bg-sky-950 hover:bg-sky-900 border border-sky-400/50 text-sky-200 text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Play className="w-3 h-3" />
                            <span>Test {maleCharName} Voice</span>
                          </button>
                        </div>

                        {/* FEMALE CHARACTER: WASI KI JAN */}
                        <div
                          className={`p-4 rounded-2xl border space-y-3 transition ${
                            avatarCfg.characterGender === "female" && customization.activeVoiceMode !== "custom"
                              ? "bg-cyan-950/35 border-cyan-400 shadow-lg shadow-cyan-950/40"
                              : "bg-slate-950 border-slate-800"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <div className="font-orbitron font-bold text-xs text-cyan-300">
                                FEMALE VOICE • {femaleCharName.toUpperCase()}
                              </div>
                              <div className="text-[10px] text-slate-400">ur-PK-UzmaNeural / Kore Pakistani Urdu</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const matchedVoice = ELEVENLABS_VOICE_PRESETS.find((v) => v.gender === "female");
                                onUpdateCustomization({
                                  ...customization,
                                  activeVoiceMode: "female",
                                  avatarConfig: {
                                    ...avatarCfg,
                                    characterGender: "female",
                                    personalityId: "wasi_ki_jan_female",
                                    elevenLabsVoiceId: matchedVoice?.id || avatarCfg.elevenLabsVoiceId,
                                  },
                                });
                                soundEffects.playBeepConfirm();
                              }}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${
                                avatarCfg.characterGender === "female"
                                  ? "bg-cyan-400 text-slate-950"
                                  : "bg-slate-900 border border-slate-700 text-slate-300 hover:text-white"
                              }`}
                            >
                              {avatarCfg.characterGender === "female" ? "ACTIVE" : "ACTIVATE"}
                            </button>
                          </div>

                          <div>
                            <label className="block text-[10px] text-cyan-300 mb-1">Female Character Name</label>
                            <input
                              type="text"
                              value={avatarCfg.customFemaleName ?? "Wasi ki Jan"}
                              onChange={(e) => {
                                const val = e.target.value;
                                const activeId = avatarCfg.activeCharacterId || "wasi_ki_jan";
                                onUpdateCustomization({
                                  ...customization,
                                  avatarConfig: {
                                    ...avatarCfg,
                                    customFemaleName: val,
                                    customNicknames: {
                                      ...(avatarCfg.customNicknames || {}),
                                      [activeId]: val,
                                    },
                                  },
                                });
                              }}
                              maxLength={24}
                              placeholder="Wasi ki Jan"
                              className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 focus:border-cyan-400 rounded-xl text-slate-100 text-xs focus:outline-none"
                            />
                          </div>

                          <div>
                            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                              <span>Pitch</span>
                              <span className="text-cyan-300 font-bold">{femaleSlot.pitch.toFixed(2)}x</span>
                            </div>
                            <input
                              type="range"
                              min="0.65"
                              max="1.5"
                              step="0.02"
                              value={femaleSlot.pitch}
                              onChange={(e) =>
                                onUpdateCustomization({
                                  ...customization,
                                  avatarConfig: {
                                    ...avatarCfg,
                                    femaleVoiceSettings: { ...femaleSlot, pitch: parseFloat(e.target.value) },
                                  },
                                })
                              }
                              className="w-full accent-cyan-400 cursor-pointer"
                            />
                          </div>

                          <div>
                            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                              <span>Speed</span>
                              <span className="text-cyan-300 font-bold">{femaleSlot.rate.toFixed(2)}x</span>
                            </div>
                            <input
                              type="range"
                              min="0.75"
                              max="1.35"
                              step="0.02"
                              value={femaleSlot.rate}
                              onChange={(e) =>
                                onUpdateCustomization({
                                  ...customization,
                                  avatarConfig: {
                                    ...avatarCfg,
                                    femaleVoiceSettings: { ...femaleSlot, rate: parseFloat(e.target.value) },
                                  },
                                })
                              }
                              className="w-full accent-cyan-400 cursor-pointer"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1">System Voice Engine (Optional)</label>
                            <select
                              value={femaleSlot.preferredBrowserVoiceURI || ""}
                              onChange={(e) =>
                                onUpdateCustomization({
                                  ...customization,
                                  avatarConfig: {
                                    ...avatarCfg,
                                    femaleVoiceSettings: {
                                      ...femaleSlot,
                                      preferredBrowserVoiceURI: e.target.value || undefined,
                                    },
                                  },
                                })
                              }
                              className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 text-[11px]"
                            >
                              <option value="">Auto Pakistani Urdu ({femaleCharName})</option>
                              {sortedVoices.map((bv) => (
                                <option key={bv.voiceURI} value={bv.voiceURI}>
                                  {bv.name} ({bv.lang})
                                </option>
                              ))}
                            </select>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              handleTestVoice(
                                femaleSlot.pitch,
                                femaleSlot.rate,
                                "female",
                                femaleSlot.preferredBrowserVoiceURI
                              )
                            }
                            className="w-full py-1.5 rounded-xl bg-cyan-950 hover:bg-cyan-900 border border-cyan-400/50 text-cyan-200 text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Play className="w-3 h-3" />
                            <span>Test {femaleCharName} Voice</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* WHEN TO PLAY WHICH VOICE (SCHEDULE & AUTO-SWITCH) */}
                    <div className="p-4 rounded-2xl bg-slate-900/70 border border-emerald-500/35 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="font-orbitron font-bold text-sm text-emerald-300 uppercase flex items-center gap-2">
                            <Clock className="w-4 h-4 text-emerald-400" />
                            <span>Voice Schedule (Kab Kaunsi Awaz Chalani Hai)</span>
                          </h3>
                          <p className="text-[10px] text-slate-400 font-mono">
                            Manual switch rakhein ya waqt (Din/Raat) / zaban (Urdu/English) ke mutabiq automatic awaz badlein.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateCustomization({
                              ...customization,
                              activeVoiceMode: "custom",
                            })
                          }
                          className={`px-3 py-1 rounded-xl border text-[10px] font-bold cursor-pointer ${
                            customization.activeVoiceMode === "custom"
                              ? "bg-purple-600 border-purple-400 text-white"
                              : "bg-slate-950 border-slate-700 text-slate-300 hover:border-purple-400"
                          }`}
                        >
                          {customization.activeVoiceMode === "custom" ? "CUSTOM CLONE ACTIVE" : "USE CUSTOM CLONE"}
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {[
                          { id: "manual" as const, title: "Manual Control", desc: `Hamesha ${activeCharName} bolegi/bolega` },
                          { id: "day_night" as const, title: "Day / Night Schedule", desc: "Din aur raat mein alag awaz" },
                          { id: "language_split" as const, title: "Language Auto-Switch", desc: "Urdu vs English pe khud badle" },
                        ].map((opt) => {
                          const isSelected = (!voiceSched.enabled && opt.id === "manual") || (voiceSched.enabled && voiceSched.mode === opt.id);
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => {
                                soundEffects.playClick();
                                onUpdateCustomization({
                                  ...customization,
                                  avatarConfig: {
                                    ...avatarCfg,
                                    voiceSchedule: {
                                      ...voiceSched,
                                      enabled: opt.id !== "manual",
                                      mode: opt.id,
                                    },
                                  },
                                });
                              }}
                              className={`p-3 rounded-xl border text-left cursor-pointer transition ${
                                isSelected
                                  ? "bg-emerald-950/60 border-emerald-400 text-emerald-200"
                                  : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                              }`}
                            >
                              <div className="font-bold text-xs">{opt.title}</div>
                              <div className="text-[10px] text-slate-400 mt-0.5">{opt.desc}</div>
                            </button>
                          );
                        })}
                      </div>

                      {voiceSched.enabled && voiceSched.mode === "day_night" && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800 text-[11px]">
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1">Day Starts (Hour)</label>
                            <select
                              value={voiceSched.dayStartHour}
                              onChange={(e) =>
                                onUpdateCustomization({
                                  ...customization,
                                  avatarConfig: {
                                    ...avatarCfg,
                                    voiceSchedule: { ...voiceSched, dayStartHour: Number(e.target.value) },
                                  },
                                })
                              }
                              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200"
                            >
                              {[5, 6, 7, 8, 9, 10].map((hr) => (
                                <option key={hr} value={hr}>
                                  {hr}:00 AM
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1">Daytime Voice</label>
                            <select
                              value={voiceSched.dayVoice}
                              onChange={(e) =>
                                onUpdateCustomization({
                                  ...customization,
                                  avatarConfig: {
                                    ...avatarCfg,
                                    voiceSchedule: {
                                      ...voiceSched,
                                      dayVoice: e.target.value === "male" ? "male" : "female",
                                    },
                                  },
                                })
                              }
                              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200"
                            >
                              <option value="female">{femaleCharName} (Female)</option>
                              <option value="male">{maleCharName} (Male)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1">Night Starts (Hour)</label>
                            <select
                              value={voiceSched.nightStartHour}
                              onChange={(e) =>
                                onUpdateCustomization({
                                  ...customization,
                                  avatarConfig: {
                                    ...avatarCfg,
                                    voiceSchedule: { ...voiceSched, nightStartHour: Number(e.target.value) },
                                  },
                                })
                              }
                              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200"
                            >
                              {[17, 18, 19, 20, 21, 22].map((hr) => (
                                <option key={hr} value={hr}>
                                  {hr - 12}:00 PM
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1">Nighttime Voice</label>
                            <select
                              value={voiceSched.nightVoice}
                              onChange={(e) =>
                                onUpdateCustomization({
                                  ...customization,
                                  avatarConfig: {
                                    ...avatarCfg,
                                    voiceSchedule: {
                                      ...voiceSched,
                                      nightVoice: e.target.value === "male" ? "male" : "female",
                                    },
                                  },
                                })
                              }
                              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200"
                            >
                              <option value="male">{maleCharName} (Male)</option>
                              <option value="female">{femaleCharName} (Female)</option>
                            </select>
                          </div>
                        </div>
                      )}

                      {voiceSched.enabled && voiceSched.mode === "language_split" && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800 text-[11px]">
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1">When Speaking Urdu / Punjabi</label>
                            <select
                              value={voiceSched.urduVoice}
                              onChange={(e) =>
                                onUpdateCustomization({
                                  ...customization,
                                  avatarConfig: {
                                    ...avatarCfg,
                                    voiceSchedule: {
                                      ...voiceSched,
                                      urduVoice: e.target.value === "male" ? "male" : "female",
                                    },
                                  },
                                })
                              }
                              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200"
                            >
                              <option value="female">{femaleCharName} (Female)</option>
                              <option value="male">{maleCharName} (Male)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-1">When Speaking English</label>
                            <select
                              value={voiceSched.englishVoice}
                              onChange={(e) =>
                                onUpdateCustomization({
                                  ...customization,
                                  avatarConfig: {
                                    ...avatarCfg,
                                    voiceSchedule: {
                                      ...voiceSched,
                                      englishVoice: e.target.value === "male" ? "male" : "female",
                                    },
                                  },
                                })
                              }
                              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200"
                            >
                              <option value="male">{maleCharName} (Male)</option>
                              <option value="female">{femaleCharName} (Female)</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* ElevenLabs + Fast Talking Settings */}
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-cyan-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-orbitron font-bold text-sm text-cyan-300 uppercase flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span>ElevenLabs Neural Voice &amp; Fast Talk</span>
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] ${
                      elevenServerConfigured
                        ? "bg-emerald-950 text-emerald-300 border border-emerald-500/40"
                        : "bg-slate-950 text-slate-400 border border-slate-700"
                    }`}
                  >
                    {elevenServerConfigured ? "ELEVENLABS ONLINE" : "100% PAKISTANI URDU HD"}
                  </span>
                </div>

                {micBannerError && (
                  <div className="p-2 rounded-lg bg-amber-950/60 border border-amber-500/40 text-amber-300 text-xs">
                    {micBannerError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between cursor-pointer">
                    <div>
                      <div className="font-bold text-slate-200">Connect ElevenLabs TTS</div>
                      <div className="text-[10px] text-slate-400">Ultra-realistic neural synthesis</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={avatarCfg.useElevenLabs}
                      onChange={(e) =>
                        onUpdateCustomization({
                          ...customization,
                          avatarConfig: { ...avatarCfg, useElevenLabs: e.target.checked },
                        })
                      }
                      className="w-4 h-4 accent-cyan-400 cursor-pointer"
                    />
                  </label>

                  <label className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between cursor-pointer">
                    <div>
                      <div className="font-bold text-slate-200">Real-Time Fast Talking</div>
                      <div className="text-[10px] text-slate-400">Instant low-latency response &amp; speech</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={avatarCfg.fastTalkingMode}
                      onChange={(e) =>
                        onUpdateCustomization({
                          ...customization,
                          avatarConfig: { ...avatarCfg, fastTalkingMode: e.target.checked },
                        })
                      }
                      className="w-4 h-4 accent-emerald-400 cursor-pointer"
                    />
                  </label>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">ElevenLabs Voice Preset</label>
                  <select
                    value={avatarCfg.elevenLabsVoiceId}
                    onChange={(e) =>
                      onUpdateCustomization({
                        ...customization,
                        avatarConfig: { ...avatarCfg, elevenLabsVoiceId: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200"
                  >
                    {ELEVENLABS_VOICE_PRESETS.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({v.style})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Custom Voice Studio (Record, Upload MP3/WAV, & Assign to Wasu / Wasi ki Jan) */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-purple-500/30 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-orbitron font-bold text-sm text-purple-300 uppercase flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-purple-400" />
                    <span>Custom Voice Studio &amp; Audio Uploader</span>
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-500/30">
                    ADD YOUR OWN VOICE
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  Apni khud ki voice add karein, mic se record karein ya MP3/WAV/M4A file upload karein — aur choose karein ke woh <span className="text-sky-300 font-bold">{maleCharName}</span> ya <span className="text-cyan-300 font-bold">{femaleCharName}</span> par kab chale.
                </p>

                <form onSubmit={handleSaveCustomVoice} className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-mono text-slate-400 mb-1">Voice Profile Name</label>
                      <input
                        type="text"
                        value={newVoiceName}
                        onChange={(e) => setNewVoiceName(e.target.value)}
                        placeholder={`e.g. Custom ${maleCharName} or Sweet ${femaleCharName}`}
                        required
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono text-slate-400 mb-1">Base Gender</label>
                      <select
                        value={newVoiceGender}
                        onChange={(e) => setNewVoiceGender(e.target.value === "male" ? "male" : "female")}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs font-mono"
                      >
                        <option value="female">Female ({femaleCharName})</option>
                        <option value="male">Male ({maleCharName})</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono text-slate-400 mb-1">Assign To</label>
                      <select
                        value={newVoiceAssignTo}
                        onChange={(e) => setNewVoiceAssignTo(e.target.value as "custom" | "male" | "female")}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs font-mono"
                      >
                        <option value="custom">Standalone Custom Voice</option>
                        <option value="male">Attach to {maleCharName} (Male)</option>
                        <option value="female">Attach to {femaleCharName} (Female)</option>
                      </select>
                    </div>
                  </div>

                  {/* Pitch & Speed Sliders */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <div>
                      <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                        <span>Vocal Pitch</span>
                        <span className="text-cyan-400 font-bold">{newVoicePitch.toFixed(2)}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.65"
                        max="1.5"
                        step="0.02"
                        value={newVoicePitch}
                        onChange={(e) => setNewVoicePitch(parseFloat(e.target.value))}
                        className="w-full accent-cyan-400 cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                        <span>Speech Speed</span>
                        <span className="text-purple-400 font-bold">{newVoiceRate.toFixed(2)}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.75"
                        max="1.35"
                        step="0.02"
                        value={newVoiceRate}
                        onChange={(e) => setNewVoiceRate(parseFloat(e.target.value))}
                        className="w-full accent-purple-400 cursor-pointer"
                      />
                    </div>
                  </div>

                  {browserVoices.length > 0 && (
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Browser/Device Voice Override (Optional)</label>
                      <select
                        value={newVoiceBrowserURI}
                        onChange={(e) => setNewVoiceBrowserURI(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs"
                      >
                        <option value="">Default Pakistani Urdu Voice</option>
                        {browserVoices.map((bv) => (
                          <option key={bv.voiceURI} value={bv.voiceURI}>
                            {bv.name} ({bv.lang})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Microphone Record Sample + Audio File Upload */}
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={isRecordingVoice ? stopRecordingVoice : startRecordingVoice}
                        className={`px-3 py-2 rounded-xl text-xs font-mono transition flex items-center gap-1.5 cursor-pointer ${
                          isRecordingVoice
                            ? "bg-red-500 text-white animate-pulse"
                            : "bg-slate-900 border border-slate-700 hover:border-purple-400 text-slate-300"
                        }`}
                      >
                        <AudioWaveform className={`w-3.5 h-3.5 ${isRecordingVoice ? "text-white animate-pulse" : "text-purple-400"}`} />
                        <span>{isRecordingVoice ? "STOP RECORDING" : "RECORD VOICE"}</span>
                      </button>

                      <label className="px-3 py-2 rounded-xl text-xs font-mono bg-slate-900 border border-slate-700 hover:border-cyan-400 text-slate-300 flex items-center gap-1.5 cursor-pointer">
                        <Upload className="w-3.5 h-3.5 text-cyan-400" />
                        <span>UPLOAD AUDIO</span>
                        <input type="file" accept="audio/*" onChange={handleUploadCustomVoiceFile} className="hidden" />
                      </label>

                      {recordedAudioUrl && (
                        <audio src={recordedAudioUrl} controls className="h-7 max-w-[180px]" />
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleTestVoice(newVoicePitch, newVoiceRate, newVoiceGender, newVoiceBrowserURI || undefined)
                        }
                        className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-cyan-400 text-cyan-300 font-mono text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <Play className="w-3 h-3" />
                        <span>TEST VOICE</span>
                      </button>

                      <button
                        type="submit"
                        className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold font-mono text-xs cursor-pointer shadow-lg shadow-purple-900/50"
                      >
                        SAVE CUSTOM VOICE
                      </button>
                    </div>
                  </div>
                </form>

                {/* Saved Profiles List */}
                <div className="space-y-2">
                  <span className="text-[11px] font-mono text-slate-400">SAVED VOICE PROFILES:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {customization.customVoices.map((v) => {
                      const sampleSrc = v.audioBase64 || v.audioBlobUrl;
                      const isActiveCustom =
                        customization.activeCustomVoiceId === v.id && customization.activeVoiceMode === "custom";
                      const isSystemBuiltIn =
                        v.id === "voice-wasi-ki-jan-ur" || v.id === "voice-wasu-ur";
                      return (
                        <div
                          key={v.id}
                          className={`p-3 rounded-xl border flex flex-col gap-2 ${
                            isActiveCustom
                              ? "bg-purple-950/40 border-purple-400 text-purple-200"
                              : "bg-slate-950 border-slate-800 text-slate-300"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-bold text-xs text-slate-100">{v.name}</div>
                              <div className="text-[10px] text-slate-400">
                                Pitch: {v.pitch.toFixed(2)}x {"\u2022"} Speed: {v.rate.toFixed(2)}x {"\u2022"} {v.gender.toUpperCase()}
                                {sampleSrc ? " • Audio Sample Attached" : ""}
                              </div>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  if (sampleSrc) {
                                    speechService.playCustomAudioSample(sampleSrc);
                                  } else {
                                    handleTestVoice(v.pitch, v.rate, v.gender, v.browserVoiceURI);
                                  }
                                }}
                                className="p-1 rounded bg-slate-900 hover:text-cyan-300 text-slate-400 cursor-pointer"
                                title={sampleSrc ? "Play Recorded/Uploaded Clip" : "Test Pakistani Urdu Speech"}
                              >
                                <Play className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const matchedPreset = ELEVENLABS_VOICE_PRESETS.find((p) => p.gender === v.gender);
                                  onUpdateCustomization({
                                    ...customization,
                                    activeVoiceMode: isSystemBuiltIn ? v.gender : "custom",
                                    activeCustomVoiceId: v.id,
                                    avatarConfig: {
                                      ...avatarCfg,
                                      characterGender: v.gender,
                                      personalityId: v.gender === "male" ? "wasu_male" : "wasi_ki_jan_female",
                                      ...(matchedPreset ? { elevenLabsVoiceId: matchedPreset.id } : {}),
                                    },
                                  });
                                  soundEffects.playBeepConfirm();
                                }}
                                className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer ${
                                  isActiveCustom ||
                                  (isSystemBuiltIn && customization.activeVoiceMode === v.gender)
                                    ? "bg-purple-600 text-white"
                                    : "bg-slate-900 text-slate-300 hover:text-white"
                                }`}
                              >
                                {isActiveCustom || (isSystemBuiltIn && customization.activeVoiceMode === v.gender)
                                  ? "ACTIVE"
                                  : "USE"}
                              </button>
                              {!isSystemBuiltIn && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const filtered = customization.customVoices.filter((cv) => cv.id !== v.id);
                                    onUpdateCustomization({
                                      ...customization,
                                      customVoices: filtered,
                                      activeVoiceMode:
                                        customization.activeCustomVoiceId === v.id ? "female" : customization.activeVoiceMode,
                                      activeCustomVoiceId:
                                        customization.activeCustomVoiceId === v.id ? undefined : customization.activeCustomVoiceId,
                                    });
                                    soundEffects.playClick();
                                  }}
                                  className="p-1 rounded bg-slate-900 hover:text-rose-400 text-slate-500 cursor-pointer"
                                  title="Delete Custom Voice"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 text-[10px]">
                            <button
                              type="button"
                              onClick={() => {
                                onUpdateCustomization({
                                  ...customization,
                                  activeVoiceMode: "male",
                                  avatarConfig: {
                                    ...avatarCfg,
                                    characterGender: "male",
                                    personalityId: "wasu_male",
                                    maleVoiceSettings: {
                                      pitch: v.pitch,
                                      rate: v.rate,
                                      preferredBrowserVoiceURI: v.browserVoiceURI,
                                      activeCustomVoiceId: v.id,
                                    },
                                  },
                                });
                                soundEffects.playBeepConfirm();
                              }}
                              className={`px-2 py-0.5 rounded border cursor-pointer ${
                                avatarCfg.maleVoiceSettings?.activeCustomVoiceId === v.id
                                  ? "bg-sky-500/20 border-sky-400 text-sky-200"
                                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-sky-200"
                              }`}
                            >
                              Set for {maleCharName}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onUpdateCustomization({
                                  ...customization,
                                  activeVoiceMode: "female",
                                  avatarConfig: {
                                    ...avatarCfg,
                                    characterGender: "female",
                                    personalityId: "wasi_ki_jan_female",
                                    femaleVoiceSettings: {
                                      pitch: v.pitch,
                                      rate: v.rate,
                                      preferredBrowserVoiceURI: v.browserVoiceURI,
                                      activeCustomVoiceId: v.id,
                                    },
                                  },
                                });
                                soundEffects.playBeepConfirm();
                              }}
                              className={`px-2 py-0.5 rounded border cursor-pointer ${
                                avatarCfg.femaleVoiceSettings?.activeCustomVoiceId === v.id
                                  ? "bg-cyan-500/20 border-cyan-400 text-cyan-200"
                                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-cyan-200"
                              }`}
                            >
                              Set for {femaleCharName}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2B. FINGERPRINT & FACE UNLOCK MOBILE BIOMETRIC SECURITY */}
          {activeTab === "security" && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/50 to-cyan-950/30 border border-emerald-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-orbitron font-bold text-sm text-emerald-300 uppercase flex items-center gap-2">
                    <Fingerprint className="w-4 h-4 text-emerald-400" />
                    <span>Phone Fingerprint &amp; Face Unlock Guard</span>
                  </h3>
                  <p className="text-[11px] text-slate-300 mt-1">
                    Apne Android / iPhone ka Fingerprint sensor ya Face ID / Front Camera Face Scan enable karein taa-ke sirf aap Q-NEXUS unlock kar sakein.
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                      bioCaps.nativeApkSupported || (bioCaps.platformAuthenticatorAvailable && !bioCaps.blockedByIframe)
                        ? "bg-emerald-950 text-emerald-300 border-emerald-500/50"
                        : "bg-amber-950 text-amber-300 border-amber-500/40"
                    }`}
                  >
                    {bioCaps.nativeApkSupported
                      ? "ANDROID BIOMETRIC SENSOR READY"
                      : bioCaps.blockedByIframe
                      ? "OPEN STANDALONE APP / APK FOR SENSOR"
                      : bioCaps.platformAuthenticatorAvailable
                      ? "HARDWARE SENSOR READY"
                      : "CAMERA FACE SCAN READY"}
                  </span>
                </div>
              </div>

              {bioStatusMsg && (
                <div className="p-3 rounded-xl bg-cyan-950/60 border border-cyan-400/50 text-cyan-200 text-xs flex items-center justify-between">
                  <span>🔐 {bioStatusMsg}</span>
                  <button onClick={() => setBioStatusMsg(null)} className="text-slate-400 hover:text-white cursor-pointer">
                    ×
                  </button>
                </div>
              )}

              {/* Fingerprint & Face Unlock Toggle Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Fingerprint Unlock Card */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-emerald-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-400/60 flex items-center justify-center text-emerald-300">
                        <Fingerprint className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-orbitron font-bold text-xs text-slate-100">FINGERPRINT UNLOCK</div>
                        <div className="text-[10px] text-slate-400">
                          {securityCfg.fingerprintEnabled ? "Enabled • Sensor Linked" : "Not Enabled"}
                        </div>
                      </div>
                    </div>

                    <input
                      type="checkbox"
                      checked={securityCfg.fingerprintEnabled}
                      onChange={(e) => {
                        const next: MobileSecurityConfig = {
                          ...securityCfg,
                          fingerprintEnabled: e.target.checked,
                        };
                        saveStoredSecurityConfig(next);
                        onUpdateCustomization({ ...customization, securityConfig: next });
                      }}
                      className="w-4 h-4 accent-emerald-400 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isEnrollingBio}
                      onClick={async () => {
                        soundEffects.playClick();
                        triggerHaptic([20, 40]);
                        setIsEnrollingBio(true);
                        const res = await enrollDeviceBiometric("fingerprint", "Wasi");
                        setIsEnrollingBio(false);
                        setBioStatusMsg(res.message);
                        if (res.ok) {
                          soundEffects.playBeepConfirm();
                          const next: MobileSecurityConfig = {
                            ...securityCfg,
                            fingerprintEnabled: true,
                            biometricCredentialId: res.credentialId,
                            enrolledAt: new Date().toISOString(),
                          };
                          saveStoredSecurityConfig(next);
                          onUpdateCustomization({ ...customization, securityConfig: next });
                        }
                      }}
                      className="flex-1 py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer transition"
                    >
                      {securityCfg.fingerprintEnabled ? "Re-Register Fingerprint" : "Enable & Register Fingerprint"}
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        const test = await verifyDeviceBiometric("fingerprint");
                        setBioStatusMsg(test.message);
                        if (test.ok) soundEffects.playBeepConfirm();
                      }}
                      className="py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 hover:border-emerald-400 text-emerald-300 text-xs cursor-pointer"
                    >
                      Test
                    </button>
                  </div>
                </div>

                {/* Face Unlock Card */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-cyan-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-400/60 flex items-center justify-center text-cyan-300">
                        <ScanFace className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-orbitron font-bold text-xs text-slate-100">FACE UNLOCK / FACE ID</div>
                        <div className="text-[10px] text-slate-400">
                          {securityCfg.faceUnlockEnabled ? "Enabled • Face Mesh Active" : "Not Enabled"}
                        </div>
                      </div>
                    </div>

                    <input
                      type="checkbox"
                      checked={securityCfg.faceUnlockEnabled}
                      onChange={(e) => {
                        const next: MobileSecurityConfig = {
                          ...securityCfg,
                          faceUnlockEnabled: e.target.checked,
                        };
                        saveStoredSecurityConfig(next);
                        onUpdateCustomization({ ...customization, securityConfig: next });
                      }}
                      className="w-4 h-4 accent-cyan-400 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        soundEffects.playClick();
                        triggerHaptic([20, 30]);
                        // Open live front-camera face enrollment scan if camera is available
                        if (bioCaps.cameraSupported) {
                          try {
                            const stream = await navigator.mediaDevices.getUserMedia({
                              video: { facingMode: "user" },
                            });
                            faceStreamRef.current = stream;
                            setIsFaceCamOpen(true);
                            setTimeout(() => {
                              if (faceVideoRef.current) {
                                faceVideoRef.current.srcObject = stream;
                              }
                            }, 50);
                            setTimeout(async () => {
                              stopFaceCamera();
                              const res = await enrollDeviceBiometric("face", "Wasi");
                              setBioStatusMsg(res.message);
                              if (res.ok) {
                                soundEffects.playBeepConfirm();
                                const next: MobileSecurityConfig = {
                                  ...securityCfg,
                                  faceUnlockEnabled: true,
                                  faceTemplateCaptured: true,
                                  biometricCredentialId: res.credentialId,
                                  enrolledAt: new Date().toISOString(),
                                };
                                saveStoredSecurityConfig(next);
                                onUpdateCustomization({ ...customization, securityConfig: next });
                              }
                            }, 1800);
                            return;
                          } catch {}
                        }
                        const res = await enrollDeviceBiometric("face", "Wasi");
                        setBioStatusMsg(res.message);
                        if (res.ok) {
                          const next: MobileSecurityConfig = {
                            ...securityCfg,
                            faceUnlockEnabled: true,
                            faceTemplateCaptured: true,
                            biometricCredentialId: res.credentialId,
                            enrolledAt: new Date().toISOString(),
                          };
                          saveStoredSecurityConfig(next);
                          onUpdateCustomization({ ...customization, securityConfig: next });
                        }
                      }}
                      className="flex-1 py-2 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs cursor-pointer transition"
                    >
                      {securityCfg.faceUnlockEnabled ? "Re-Scan Face ID" : "Scan & Enable Face Unlock"}
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        const test = await verifyDeviceBiometric("face");
                        setBioStatusMsg(test.message);
                        if (test.ok) soundEffects.playBeepConfirm();
                      }}
                      className="py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 hover:border-cyan-400 text-cyan-300 text-xs cursor-pointer"
                    >
                      Test
                    </button>
                  </div>
                </div>
              </div>

              {/* Live Front Camera Face Enrollment Feed */}
              {isFaceCamOpen && (
                <div className="p-4 rounded-2xl bg-slate-950 border-2 border-cyan-400 flex flex-col items-center gap-2 animate-fadeIn">
                  <div className="text-cyan-300 font-orbitron font-bold text-xs animate-pulse">
                    SCANNING FACE GEOMETRY... LOOK AT FRONT CAMERA
                  </div>
                  <div className="relative w-44 h-44 rounded-full overflow-hidden border-2 border-cyan-400 shadow-[0_0_25px_rgba(6,182,212,0.5)]">
                    <video ref={faceVideoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                    <div className="absolute inset-0 border-4 border-emerald-400/40 rounded-full animate-ping pointer-events-none" />
                  </div>
                  <button
                    type="button"
                    onClick={stopFaceCamera}
                    className="px-3 py-1 rounded-lg bg-slate-800 text-slate-300 text-[11px] cursor-pointer"
                  >
                    Cancel Camera
                  </button>
                </div>
              )}

              {/* Additional Lock Controls */}
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-200 text-xs">Auto-Prompt Biometric Unlock on App Open</div>
                    <div className="text-[10px] text-slate-400">
                      Jab bhi phone par app open karein, Fingerprint/Face prompt khud trigger ho
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={securityCfg.requireBiometricOnLaunch}
                    onChange={(e) => {
                      const next: MobileSecurityConfig = {
                        ...securityCfg,
                        requireBiometricOnLaunch: e.target.checked,
                      };
                      saveStoredSecurityConfig(next);
                      onUpdateCustomization({ ...customization, securityConfig: next });
                    }}
                    className="w-4 h-4 accent-cyan-400 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                  <div>
                    <div className="font-semibold text-slate-200 text-xs">Mobile Auto-Lock Timeout</div>
                    <div className="text-[10px] text-slate-400">Screen lock hone ka waqt</div>
                  </div>
                  <select
                    value={securityCfg.autoLockMinutes}
                    onChange={(e) => {
                      const next: MobileSecurityConfig = {
                        ...securityCfg,
                        autoLockMinutes: Number(e.target.value),
                      };
                      saveStoredSecurityConfig(next);
                      onUpdateCustomization({ ...customization, securityConfig: next });
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 text-xs"
                  >
                    <option value={1}>1 Minute</option>
                    <option value={2}>2 Minutes</option>
                    <option value={5}>5 Minutes</option>
                    <option value={15}>15 Minutes</option>
                    <option value={0}>Manual Lock Only</option>
                  </select>
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500">
                    {securityCfg.enrolledAt
                      ? `Registered: ${new Date(securityCfg.enrolledAt).toLocaleString()}`
                      : "Abhi koi biometric register nahi hua"}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const cleared: MobileSecurityConfig = { ...defaultSecurityConfig };
                      saveStoredSecurityConfig(cleared);
                      onUpdateCustomization({ ...customization, securityConfig: cleared });
                      setBioStatusMsg("Fingerprint & Face Unlock settings reset.");
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-950/60 border border-red-500/40 text-red-300 text-[11px] cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Reset Biometrics</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 3. SCREENSAVER & AWAY */}
          {activeTab === "screensaver" && (
            <div className="space-y-4">
              <h3 className="font-orbitron font-bold text-sm text-cyan-300 uppercase mb-2 flex items-center gap-2">
                <Shield className="w-4 h-4 text-cyan-400" />
                <span>Screensaver & Away Auto-Pilot Customizer</span>
              </h3>

              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">Screensaver Theme</label>
                  <select
                    value={customization.screensaverType}
                    onChange={(e) =>
                      onUpdateCustomization({
                        ...customization,
                        screensaverType: e.target.value as any,
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 text-xs font-mono"
                  >
                    <option value="sentry">Quantum Sentry Radar & Task Patrol</option>
                    <option value="vortex">Tachyon Vortex & Particle Core</option>
                    <option value="nebula">Deep Space Nebula Starfield</option>
                    <option value="matrix">Matrix Code Rain Cyber Stream</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">Screensaver Banner Message</label>
                  <input
                    type="text"
                    value={customization.screensaverMessage}
                    onChange={(e) =>
                      onUpdateCustomization({
                        ...customization,
                        screensaverMessage: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">Inactivity Timeout (Auto-engage screensaver)</label>
                  <select
                    value={customization.screensaverTimeoutMinutes}
                    onChange={(e) =>
                      onUpdateCustomization({
                        ...customization,
                        screensaverTimeoutMinutes: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 text-xs font-mono"
                  >
                    <option value="2">2 Minutes of inactivity</option>
                    <option value="5">5 Minutes (Recommended)</option>
                    <option value="10">10 Minutes</option>
                    <option value="0">Never auto-engage</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* 4. HEALTH & REST TIMER */}
          {activeTab === "health" && (
            <div className="space-y-4">
              <h3 className="font-orbitron font-bold text-sm text-cyan-300 uppercase mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4 text-cyan-400" />
                <span>Mandatory Screen-Time Health Lockdown Limits</span>
              </h3>

              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">
                    Continuous Screen Work Limit (Triggers Forced Rest)
                  </label>
                  <select
                    value={customization.continuousWorkLimitMinutes}
                    onChange={(e) =>
                      onUpdateCustomization({
                        ...customization,
                        continuousWorkLimitMinutes: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 text-xs font-mono"
                  >
                    <option value="30">30 Minutes (High protection for eyes)</option>
                    <option value="45">45 Minutes (Recommended ergonomic balance)</option>
                    <option value="60">60 Minutes</option>
                    <option value="90">90 Minutes (Intensive sessions)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">
                    Mandatory Rest Lockdown Duration (Screen Block Time)
                  </label>
                  <select
                    value={customization.mandatoryRestMinutes}
                    onChange={(e) =>
                      onUpdateCustomization({
                        ...customization,
                        mandatoryRestMinutes: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 text-xs font-mono"
                  >
                    <option value="3">3 Minutes rest</option>
                    <option value="5">5 Minutes rest (Recommended)</option>
                    <option value="10">10 Minutes rest</option>
                  </select>
                </div>

                <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 text-amber-300 text-[11px] flex items-center gap-2">
                  <Shield className="w-4 h-4 shrink-0" />
                  <span>Jab yeh timer poora hoga to {activeCharName} aapke phone ko mandatory eye-rest mode mein daal degi taa-ke aankhon ko sakoon mil sake.</span>
                </div>
              </div>
            </div>
          )}

          {/* 5. BACKUP & SYNC */}
          {activeTab === "data" && (
            <div className="space-y-4">
              <h3 className="font-orbitron font-bold text-sm text-cyan-300 uppercase mb-2 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cyan-400" />
                <span>Quantum Data Backup & Cloud Synchronization</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                  <div className="font-semibold text-slate-200 text-xs">Export Encrypted Backup</div>
                  <p className="text-[11px] text-slate-400">
                    Saves all customizations, tasks, study records, custom voices, biometrics &amp; memories to a JSON file on your phone.
                  </p>
                  <button
                    onClick={onExportBackup}
                    className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-mono text-xs transition cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    <span>DOWNLOAD BACKUP JSON</span>
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                  <div className="font-semibold text-slate-200 text-xs">Restore Backup Snapshot</div>
                  <p className="text-[11px] text-slate-400">
                    Upload your previously saved Quantum Jarvis backup file to restore all settings on this or another phone.
                  </p>
                  <button
                    onClick={onImportBackup}
                    className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold font-mono text-xs transition cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    <span>RESTORE BACKUP FILE</span>
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-rose-300 text-xs flex items-center gap-1.5">
                    <Trash2 className="w-4 h-4" />
                    <span>Clear All Cache &amp; Personal Data</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Deletes all cached tasks, expenses, life records, health logs, and browser caches so you start 100% blank.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    soundEffects.playAlert();
                    await storageService.clearAllCacheAndPersonalData();
                    window.location.reload();
                  }}
                  className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold font-mono text-xs transition cursor-pointer shrink-0"
                >
                  CLEAR CACHE &amp; RESET
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
          <div className="text-[11px] font-mono text-slate-400">
            Current Theme: <span className="text-cyan-400 font-bold uppercase">{customization.accentTheme}</span> {"\u2022"} Voice: <span className="text-purple-400 uppercase font-bold">{customization.activeVoiceMode}</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-mono text-xs cursor-pointer shadow-md shadow-cyan-500/20"
          >
            APPLY & CLOSE SETTINGS
          </button>
        </div>
      </div>
    </div>
  );
};
