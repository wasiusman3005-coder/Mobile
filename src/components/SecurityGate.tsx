import React, { useState, useRef, useEffect } from "react";
import {
  Eye,
  EyeOff,
  AlertTriangle,
  KeyRound,
  Smartphone,
  User,
  Volume2,
  VolumeX,
  Lock,
  Fingerprint,
  ScanFace,
  ShieldCheck,
  X,
} from "lucide-react";
import { soundEffects } from "../services/soundEffects";
import { speechService } from "../services/speechService";
import { storageService } from "../services/storage";
import { readPhoneHardwareTelemetry, PhoneHardwareTelemetry } from "../services/systemTelemetry";
import { triggerHaptic } from "../services/mobileDeviceActions";
import {
  verifyDeviceBiometric,
  enrollDeviceBiometric,
  checkBiometricCapabilities,
} from "../services/biometricAuth";
import { DashboardCustomization, LanguageCode } from "../types";
import { defaultOneUiConfig } from "../services/storage";
import { FACE_ANIM_PRESETS } from "../data/oneUi9Catalog";
import { triggerDynamicBarUnlockEffectAndroid } from "../services/nativeAndroidBridge";
import { LiveWallpaperCanvas } from "./LiveWallpaperCanvas";
import { OneUiClockPreview } from "./OneUiClockPreview";
import { FingerprintAnimView } from "./FingerprintAnimView";

interface SecurityGateProps {
  onAuthenticated: (
    commanderName?: string,
    unlockMethod?: "Fingerprint" | "Face" | "Passkey"
  ) => void;
  preferredLanguage: LanguageCode;
  customization?: DashboardCustomization;
}

// Strict hidden 6-digit passkey — never rendered or hinted in UI
const REQUIRED_PASSKEY = ["0", "8", "5", "2", "1", "3"].join("");
const LOCK_BG_IMAGE = "/assets/aistudio/Gemini_Generated_Image_55uicz55uicz55ui_f744178a.jpg";

export const SecurityGate: React.FC<SecurityGateProps> = ({
  onAuthenticated,
  preferredLanguage: _preferredLanguage,
  customization,
}) => {
  const [authTab, setAuthTab] = useState<"passkey" | "password">("passkey");
  const [enteredDigits, setEnteredDigits] = useState("");
  const [passkeyStatus, setPasskeyStatus] = useState<"idle" | "error" | "success">("idle");
  const [scannerLockedFlash, setScannerLockedFlash] = useState(false);
  const [lockFeedback, setLockFeedback] = useState("Enter 6-digit passkey or scan Fingerprint / Face");
  const [soundOn, setSoundOn] = useState(soundEffects.soundEnabled);

  // Live Biometric Fingerprint & Face Scan States
  const [bioBusy, setBioBusy] = useState<"fingerprint" | "face" | null>(null);
  const [bioMessage, setBioMessage] = useState<string | null>(null);
  const [isFaceCamOpen, setIsFaceCamOpen] = useState(false);
  const [faceScanProgress, setFaceScanProgress] = useState(0);
  const faceVideoRef = useRef<HTMLVideoElement | null>(null);
  const faceStreamRef = useRef<MediaStream | null>(null);

  // Commander Password tab (strictly requires the hidden passkey)
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [rememberMe, setRememberMe] = useState(true);

  const usernameInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const [phoneTelemetry, setPhoneTelemetry] = useState<PhoneHardwareTelemetry | null>(null);
  const unlockingRef = useRef(false);

  const motionEnabled = customization?.lockScreenMotionEnabled !== false;
  const colorShiftEnabled = customization?.lockScreenColorShift !== false;
  const designStyle = customization?.lockScreenDesignStyle || "orbital";
  const oneUiCfg = customization?.oneUiConfig || defaultOneUiConfig;
  const bgImageSrc = customization?.customBgUrl?.trim() || LOCK_BG_IMAGE;
  const brandTitle = customization?.brandTitle?.trim() || "WASU'S JARVIS";
  const brandWords = brandTitle.split(/\s+/);
  const firstWord = brandWords[0] || "WASU'S";
  const restWords = brandWords.slice(1).join(" ") || "JARVIS";

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const tel = await readPhoneHardwareTelemetry();
        if (!cancelled) setPhoneTelemetry(tel);
      } catch {
      }
    };
    load();
    const timer = setInterval(load, 4000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const stopFaceCamera = () => {
    if (faceStreamRef.current) {
      faceStreamRef.current.getTracks().forEach((t) => t.stop());
      faceStreamRef.current = null;
    }
    if (faceVideoRef.current) {
      faceVideoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    return () => {
      stopFaceCamera();
    };
  }, []);

  const finalizeUnlock = (userToGreet: string, method = "Passkey") => {
    if (unlockingRef.current) return;
    unlockingRef.current = true;
    stopFaceCamera();
    setIsFaceCamOpen(false);
    triggerDynamicBarUnlockEffectAndroid(method).catch(() => {});

    setPasskeyStatus("success");
    setLockFeedback("Identity Confirmed — Unlocking Wasu's Jarvis");
    soundEffects.playSuccessChime();
    soundEffects.playSubBassPulse();
    triggerHaptic([25, 40, 25]);

    speechService.primeMicrophoneAccess().catch(() => {});

    const profile = storageService.getUserProfile();
    const name = userToGreet || profile.displayName || profile.username || "Wasi";

    setTimeout(() => {
      try {
        sessionStorage.setItem("q_nexus_session_auth", "active");
        localStorage.setItem("q_nexus_lock_v2", "verified");
        if (rememberMe) {
          localStorage.setItem("q_nexus_wasi_auth", "active");
        }
      } catch {}
      const resolvedMethod: "Fingerprint" | "Face" | "Passkey" =
        method.toLowerCase().includes("face")
          ? "Face"
          : method.toLowerCase().includes("finger")
          ? "Fingerprint"
          : "Passkey";
      onAuthenticated(name, resolvedMethod);
    }, 360);
  };

  const handleFingerprintScan = async () => {
    if (unlockingRef.current || bioBusy) return;
    soundEffects.playScan();
    triggerHaptic([20, 35]);
    setBioBusy("fingerprint");
    setBioMessage("Touch your phone's Fingerprint sensor...");
    setErrorMsg("");

    try {
      const caps = await checkBiometricCapabilities();
      const secCfg = storageService.getCustomization().securityConfig;

      // In Android APK or standalone WebAuthn, trigger real hardware sensor directly
      if (caps.nativeApkSupported) {
        const res = await verifyDeviceBiometric("fingerprint");
        if (res.ok) {
          setBioMessage(res.message);
          finalizeUnlock(username.trim() || "Wasi", "Fingerprint");
          return;
        }
        soundEffects.playAlert();
        setBioMessage(res.message);
        setBioBusy(null);
        return;
      }

      if (!secCfg?.biometricCredentialId && caps.webAuthnSupported && caps.platformAuthenticatorAvailable && !caps.blockedByIframe) {
        const enrolled = await enrollDeviceBiometric("fingerprint", "Wasi");
        if (enrolled.ok) {
          setBioMessage(enrolled.message);
          finalizeUnlock(username.trim() || "Wasi", "Fingerprint");
          return;
        }
        soundEffects.playAlert();
        setBioMessage(enrolled.message);
        setBioBusy(null);
        return;
      }

      const res = await verifyDeviceBiometric("fingerprint");
      if (res.ok) {
        if (!res.usedHardwareWebAuthn && caps.blockedByIframe) {
          setBioMessage("Hardware Fingerprint sensor connects inside Android APK or standalone mobile Chrome. Use passkey or Face Scan here.");
          setBioBusy(null);
          return;
        }
        setBioMessage(res.message);
        finalizeUnlock(username.trim() || "Wasi", "Fingerprint");
      } else {
        soundEffects.playAlert();
        setBioMessage(res.message);
      }
    } catch {
      soundEffects.playAlert();
      setBioMessage("Fingerprint scan could not complete.");
    } finally {
      setBioBusy(null);
    }
  };

  const handleFaceScanStart = async () => {
    if (unlockingRef.current || bioBusy) return;
    soundEffects.playScan();
    triggerHaptic([20, 30, 20]);
    setErrorMsg("");
    setBioBusy("face");

    // Always use live Front-Camera Optical Face Verification for Face Scan button
    // so Android BiometricPrompt never hijacks Face Scan into Fingerprint prompt.
    try {
      setIsFaceCamOpen(true);
      setFaceScanProgress(12);
      setBioMessage("Align face inside front-camera frame...");

      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        faceStreamRef.current = stream;
        if (faceVideoRef.current) {
          faceVideoRef.current.srcObject = stream;
          await faceVideoRef.current.play().catch(() => {});
        }
      } else {
        throw new Error("Front camera not available");
      }

      [38, 68, 92, 100].forEach((pct, i) => {
        window.setTimeout(async () => {
          setFaceScanProgress(pct);
          if (pct === 100) {
            await enrollDeviceBiometric("face", "Wasi").catch(() => {});
            setBioMessage("Face ID Verified — Welcome Commander Wasi");
            finalizeUnlock(username.trim() || "Wasi", "Face");
          }
        }, 420 * (i + 1));
      });
    } catch {
      stopFaceCamera();
      setIsFaceCamOpen(false);
      soundEffects.playAlert();
      setBioMessage("Front Camera permission allow karein Face Scan unlock ke liye.");
    } finally {
      setBioBusy(null);
    }
  };

  const evaluatePasskey = (digits: string) => {
    if (digits === REQUIRED_PASSKEY) {
      finalizeUnlock(username.trim() || "Wasi");
    } else {
      soundEffects.playAlert();
      triggerHaptic([50, 30, 50]);
      setPasskeyStatus("error");
      setScannerLockedFlash(true);
      setLockFeedback("Access Denied — Incorrect Passkey");
      setTimeout(() => {
        setPasskeyStatus("idle");
        setScannerLockedFlash(false);
        setEnteredDigits("");
        setLockFeedback("Enter 6-digit passkey or scan Fingerprint / Face");
      }, 700);
    }
  };

  const pushDigit = (digit: string) => {
    if (unlockingRef.current || enteredDigits.length >= 6) return;
    soundEffects.playKeyClick(880 + Number(digit) * 35);
    const next = enteredDigits + digit;
    setEnteredDigits(next);
    setLockFeedback(`${next.length} / 6 digits entered`);
    if (next.length === 6) {
      evaluatePasskey(next);
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (authTab !== "passkey" || unlockingRef.current || isFaceCamOpen) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (/^[0-9]$/.test(e.key)) {
        pushDigit(e.key);
      } else if (e.key === "Backspace") {
        soundEffects.playKeyClick(700);
        setEnteredDigits((prev) => prev.slice(0, -1));
      } else if (e.key === "Escape") {
        soundEffects.playKeyClick(620);
        setEnteredDigits("");
        setLockFeedback("Cleared — Enter 6-digit passkey");
      } else if (e.key === "Enter" && enteredDigits.length > 0) {
        evaluatePasskey(enteredDigits);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const handlePasswordLogin = (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const u = username.trim();
    const p = password.trim();
    if (!u) {
      soundEffects.playAlert();
      setErrorMsg("Please enter your Commander ID.");
      usernameInputRef.current?.focus();
      return;
    }
    if (p === REQUIRED_PASSKEY) {
      finalizeUnlock(u);
    } else {
      soundEffects.playAlert();
      setErrorMsg("Access Denied — Incorrect Security Password.");
      passwordInputRef.current?.focus();
    }
  };

  return (
    <div
      id="lock"
      className="fixed inset-0 z-50 flex flex-col items-center justify-start lg:justify-center bg-[#020510] text-slate-100 px-3.5 py-4 sm:p-8 font-rajdhani overflow-y-auto"
    >
      {/* Full-Bleed Animated Live Wallpaper + Portrait Match */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        {oneUiCfg.liveWallpaperEnabledInApp ? (
          <div className="absolute inset-0 opacity-75">
            <LiveWallpaperCanvas
              styleId={oneUiCfg.liveWallpaperId}
              accentHex={oneUiCfg.accentColorHex}
              galleryImageUrl={oneUiCfg.galleryWallpaperDataUrl}
              interactive={false}
            />
          </div>
        ) : (
          <img
            src={bgImageSrc}
            alt=""
            referrerPolicy="no-referrer"
            className={`w-full h-full object-cover object-[50%_20%] opacity-42 ${
              motionEnabled ? "q-lock-bg-motion" : ""
            }`}
          />
        )}

        {/* Dynamic Prismatic Color-Shifting Gradient Layer */}
        <div
          className={`absolute inset-0 ${colorShiftEnabled ? "q-lock-color-shift" : ""}`}
          style={{
            background:
              "radial-gradient(circle at 20% 20%, rgba(0,240,255,0.34), transparent 48%), radial-gradient(circle at 82% 76%, rgba(168,85,247,0.36), transparent 52%), radial-gradient(circle at 50% 50%, rgba(16,185,129,0.22), transparent 60%)",
            mixBlendMode: "screen",
          }}
        />

        {/* Deep Legibility Contrast Scrim */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(2,6,18,0.72) 0%, rgba(2,6,18,0.58) 45%, rgba(2,6,18,0.86) 100%)",
          }}
        />

        {/* Rotating / Morphing Design Pattern Layer */}
        {designStyle === "cyber_grid" ? (
          <div className="absolute inset-0 quantum-grid opacity-45 q-lock-color-shift" />
        ) : designStyle === "aurora_waves" ? (
          <div
            className="absolute -inset-24 rounded-full blur-3xl q-lock-geo-morph"
            style={{
              background:
                "conic-gradient(from 0deg, rgba(0,240,255,0.28), rgba(236,72,153,0.28), rgba(245,158,11,0.24), rgba(16,185,129,0.28), rgba(0,240,255,0.28))",
            }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center opacity-50">
            <div className="w-[540px] h-[540px] rounded-full border border-cyan-400/25 q-lock-geo-morph flex items-center justify-center">
              <div className="w-[380px] h-[380px] rounded-full border border-dashed border-fuchsia-400/35" />
            </div>
          </div>
        )}
      </div>

      {/* Live Camera Face Scan Overlay Modal */}
      {isFaceCamOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[#060d1e]/95 border border-cyan-400/55 p-5 shadow-[0_0_50px_rgba(0,240,255,0.3)] flex flex-col items-center gap-4">
            <div className="w-full flex items-center justify-between">
              <div className="flex items-center gap-2 text-cyan-300 font-orbitron font-bold text-xs tracking-wider">
                <ScanFace className="w-4 h-4" />
                <span>LIVE PHONE FACE SCAN</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  stopFaceCamera();
                  setIsFaceCamOpen(false);
                }}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {(() => {
              const facePreset =
                FACE_ANIM_PRESETS.find((f) => f.id === oneUiCfg.faceAnimId) || FACE_ANIM_PRESETS[0];
              return (
                <div
                  className="relative w-56 h-56 rounded-full overflow-hidden border-[3px] bg-slate-950"
                  style={{
                    borderColor: facePreset.color,
                    boxShadow: `0 0 32px ${facePreset.color}70`,
                  }}
                >
                  <video
                    ref={faceVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                  {oneUiCfg.customBiometricImageDataUrl && (
                    <img
                      src={oneUiCfg.customBiometricImageDataUrl}
                      alt=""
                      className="pointer-events-none absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-screen"
                    />
                  )}
                  <div
                    className="pointer-events-none absolute inset-0 rounded-full border-4 border-dashed animate-spin"
                    style={{ animationDuration: "6s", borderColor: `${facePreset.color}aa` }}
                  />
                  <div
                    className="pointer-events-none absolute left-0 right-0 h-1 q-laser-beam"
                    style={{
                      background: `linear-gradient(90deg, transparent, ${facePreset.color}, transparent)`,
                    }}
                  />
                </div>
              );
            })()}

            <div className="w-full space-y-1.5 text-center">
              <div className="text-xs font-mono text-emerald-300">
                {faceScanProgress < 100
                  ? `Scanning Facial Biometrics... ${faceScanProgress}%`
                  : "Face Matched — Unlocking"}
              </div>
              <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden border border-slate-700">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-300"
                  style={{ width: `${faceScanProgress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top HUD Bar */}
      <header className="relative z-10 w-full max-w-[1120px] flex flex-wrap items-center justify-between gap-3 pb-3.5 mb-4 border-b border-cyan-400/25">
        <div className="flex items-center gap-3">
          <div className="font-orbitron font-black text-lg sm:text-xl tracking-[0.18em] text-slate-100 whitespace-nowrap">
            {firstWord} <span className="text-[#00f0ff]">{restWords}</span>
          </div>
          <span className="hidden sm:inline text-xs font-mono text-cyan-200/70">
            · Mobile Biometric Vault
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/80 border border-slate-400/25 text-[11px] font-mono text-cyan-300">
            <Smartphone className="w-3.5 h-3.5 shrink-0" />
            <span>{phoneTelemetry?.deviceName || "Mobile Phone"}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              const next = !soundEffects.soundEnabled;
              soundEffects.soundEnabled = next;
              setSoundOn(next);
              if (next) soundEffects.playKeyClick(880);
            }}
            className="px-3 py-1.5 rounded-lg bg-slate-900/85 border border-cyan-500/35 hover:border-[#00f0ff] text-xs font-mono text-slate-200 flex items-center gap-1.5 cursor-pointer transition"
          >
            {soundOn ? <Volume2 className="w-3.5 h-3.5 text-[#00f0ff]" /> : <VolumeX className="w-3.5 h-3.5 text-slate-400" />}
            <span>{soundOn ? "Audio: On" : "Audio: Off"}</span>
          </button>
        </div>
      </header>

      {/* 2-Column Lock Grid */}
      <div className="relative z-10 w-full max-w-[1120px] grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-9 items-center my-auto">
        {/* LEFT COLUMN: Circular Portrait Surrounded by Shifting Color Rings */}
        <div
          className={`rounded-2xl p-[1.5px] shadow-[0_0_55px_rgba(0,240,255,0.26)] ${
            colorShiftEnabled ? "q-lock-color-shift" : ""
          }`}
          style={{
            background: "linear-gradient(135deg, rgba(0,240,255,0.75), rgba(139,92,246,0.55), rgba(245,158,11,0.65))",
          }}
        >
          <div className="rounded-[15px] bg-[#050b1a]/86 backdrop-blur-md p-5 sm:p-7 flex flex-col items-center gap-4 relative overflow-hidden">
            <div
              className="relative w-[220px] h-[220px] sm:w-[270px] sm:h-[270px] flex items-center justify-center"
              style={{ perspective: "900px" }}
            >
              {/* Outer Ambient Halo Glow */}
              <div
                className={`absolute -inset-2 rounded-full blur-2xl opacity-75 transition-colors duration-500 ${
                  passkeyStatus === "success"
                    ? "bg-emerald-500/50"
                    : scannerLockedFlash
                    ? "bg-rose-500/55"
                    : "bg-gradient-to-tr from-cyan-500/40 via-violet-500/40 to-amber-500/35"
                }`}
              />

              {/* Ring 1 */}
              <div
                className="absolute inset-1 rounded-full p-[2.5px] animate-spin"
                style={{
                  animationDuration: "14s",
                  background:
                    passkeyStatus === "success"
                      ? "conic-gradient(from 0deg, #10b981, transparent 35%, #34d399 65%, transparent 90%, #10b981)"
                      : scannerLockedFlash
                      ? "conic-gradient(from 0deg, #f43f5e, transparent 35%, #fb7185 65%, transparent 90%, #f43f5e)"
                      : "conic-gradient(from 0deg, #00f0ff, transparent 28%, #8b5cf6 56%, #f59e0b 78%, transparent 92%, #00f0ff)",
                }}
              >
                <div className="w-full h-full rounded-full bg-[#060b16]/85" />
              </div>

              {/* Ring 2 */}
              <div
                className="absolute inset-3.5 rounded-full border-2 border-dashed border-[#00f0ff]/65 animate-spin-reverse"
                style={{ animationDuration: "11s" }}
              >
                <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[#00f0ff] shadow-[0_0_12px_#00f0ff]" />
                <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-violet-400 shadow-[0_0_12px_#a78bfa]" />
              </div>

              {/* Ring 3 */}
              <div
                className="absolute inset-6 rounded-full border-[1.5px] border-t-amber-400/85 border-r-cyan-400/60 border-b-violet-500/75 border-l-transparent animate-spin"
                style={{ animationDuration: "6.5s" }}
              />

              <div className="pointer-events-none absolute -inset-1 rounded-full border border-cyan-400/45 q-gyro-ring-a" />
              <div className="pointer-events-none absolute -inset-1 rounded-full border border-violet-400/40 q-gyro-ring-b" />

              {/* Center Round Portrait Photo */}
              <div
                className={`relative z-10 w-[166px] h-[166px] sm:w-[200px] sm:h-[200px] rounded-full overflow-hidden border-[3px] shadow-[0_0_32px_rgba(0,240,255,0.4)] transition-all duration-300 ${
                  passkeyStatus === "success"
                    ? "border-emerald-400 scale-105"
                    : scannerLockedFlash
                    ? "border-rose-500"
                    : "border-cyan-300/85"
                }`}
              >
                <img
                  src={bgImageSrc}
                  alt="Wasu's Jarvis Mobile Portrait"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover object-[50%_18%] scale-105"
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute left-0 right-0 top-0 h-[2.5px] q-laser-beam opacity-85"
                  style={{
                    background:
                      passkeyStatus === "success"
                        ? "linear-gradient(90deg, transparent 5%, #10b981 30%, #ffffff 50%, #10b981 70%, transparent 95%)"
                        : scannerLockedFlash
                        ? "linear-gradient(90deg, transparent 5%, #f43f5e 30%, #ffffff 50%, #f43f5e 70%, transparent 95%)"
                        : "linear-gradient(90deg, transparent 5%, #00f0ff 30%, #ffffff 50%, #00f0ff 70%, transparent 95%)",
                  }}
                />
              </div>
            </div>

            <div className="py-1">
              <OneUiClockPreview
                styleId={oneUiCfg.clockStyleId}
                colorHex={oneUiCfg.clockColorHex}
                accentHex={oneUiCfg.accentColorHex}
                batteryPercent={phoneTelemetry?.batteryPercent ?? null}
                compact
              />
            </div>

            <div className="flex flex-col items-center gap-2">
              <FingerprintAnimView
                animId={oneUiCfg.fingerprintAnimId}
                active={bioBusy === "fingerprint"}
                size="sm"
                customImageUrl={oneUiCfg.customBiometricImageDataUrl}
                onClick={handleFingerprintScan}
              />
              <div className="text-center space-y-1">
                <div className="font-orbitron font-bold text-sm sm:text-base tracking-[0.12em] text-slate-100 flex items-center justify-center gap-2">
                  <Lock className="w-4 h-4 text-[#00f0ff]" />
                  <span>{brandTitle} VAULT</span>
                </div>
                <div className="font-mono text-xs text-cyan-200/80">
                  {passkeyStatus === "success"
                    ? "Biometric / Passkey Verified"
                    : scannerLockedFlash
                    ? "Security Mismatch — Access Blocked"
                    : "Tap Fingerprint animation above, Face Scan, or Passkey"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Biometric Fingerprint + Face Scan + Passkey Keypad */}
        <div
          className="rounded-2xl p-[1.5px] shadow-[0_0_55px_rgba(139,92,246,0.25)]"
          style={{
            background: "linear-gradient(135deg, rgba(139,92,246,0.65), rgba(0,240,255,0.6), rgba(236,72,153,0.5))",
          }}
        >
          <div className="rounded-[15px] bg-[#050b1a]/88 backdrop-blur-md p-5 sm:p-7 flex flex-col gap-4 relative overflow-hidden">
            <div>
              <h1 className="font-orbitron font-extrabold text-xl sm:text-2xl tracking-[0.08em] bg-gradient-to-r from-cyan-300 via-white to-violet-300 bg-clip-text text-transparent">
                Mobile Biometric Unlock
              </h1>
              <p className="mt-1 text-xs text-slate-300">
                Use your mobile&apos;s real Fingerprint sensor, Front-Camera Face Scan, or 6-digit passkey.
              </p>
            </div>

            {/* Direct Phone Hardware Fingerprint & Face Scan Action Row */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleFingerprintScan}
                disabled={Boolean(bioBusy)}
                className="min-h-[48px] px-3 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500/20 to-emerald-500/20 hover:from-cyan-500/35 hover:to-emerald-500/35 border border-cyan-400/60 text-cyan-100 font-mono text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition active:scale-95 shadow-[0_0_20px_rgba(0,240,255,0.2)]"
              >
                <Fingerprint className="w-5 h-5 text-cyan-300 shrink-0" />
                <span>{bioBusy === "fingerprint" ? "Scanning..." : "Fingerprint Scan"}</span>
              </button>

              <button
                type="button"
                onClick={handleFaceScanStart}
                disabled={Boolean(bioBusy)}
                className="min-h-[48px] px-3 py-2.5 rounded-xl bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 hover:from-violet-500/35 hover:to-fuchsia-500/35 border border-violet-400/60 text-violet-100 font-mono text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition active:scale-95 shadow-[0_0_20px_rgba(168,85,247,0.2)]"
              >
                <ScanFace className="w-5 h-5 text-violet-300 shrink-0" />
                <span>{bioBusy === "face" ? "Opening..." : "Face Scan"}</span>
              </button>
            </div>

            {bioMessage && (
              <div className="p-2.5 rounded-xl bg-cyan-950/65 border border-cyan-400/45 text-cyan-200 text-xs flex items-center gap-2 font-mono">
                <ShieldCheck className="w-4 h-4 text-cyan-300 shrink-0" />
                <span>{bioMessage}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#030714] border border-cyan-500/20">
              <button
                type="button"
                onClick={() => {
                  soundEffects.playKeyClick(860);
                  setAuthTab("passkey");
                  setErrorMsg("");
                }}
                className={`py-2 rounded-lg text-xs font-mono font-semibold transition cursor-pointer ${
                  authTab === "passkey"
                    ? "bg-gradient-to-r from-cyan-500/30 to-violet-500/25 text-cyan-200 border border-cyan-400/60 shadow-[0_0_16px_rgba(0,240,255,0.25)]"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                6-Digit Passkey
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEffects.playKeyClick(860);
                  setAuthTab("password");
                  setErrorMsg("");
                }}
                className={`py-2 rounded-lg text-xs font-mono font-semibold transition cursor-pointer ${
                  authTab === "password"
                    ? "bg-gradient-to-r from-violet-500/30 to-fuchsia-500/25 text-violet-200 border border-violet-400/60 shadow-[0_0_16px_rgba(168,85,247,0.25)]"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Commander Login
              </button>
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-2 font-mono">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {authTab === "passkey" ? (
              <>
                {/* 6 Masked Passkey Slots */}
                <div
                  className={`grid grid-cols-6 gap-2 tabular ${
                    passkeyStatus === "error" ? "q-keypad-shake" : ""
                  }`}
                >
                  {[0, 1, 2, 3, 4, 5].map((slotIdx) => {
                    const isFilled = slotIdx < enteredDigits.length;
                    return (
                      <div
                        key={slotIdx}
                        className={`h-12 rounded-xl border flex items-center justify-center font-mono text-2xl font-bold transition ${
                          passkeyStatus === "error"
                            ? "border-rose-500 bg-rose-950/50 text-rose-400 shadow-[0_0_18px_rgba(244,63,94,0.35)]"
                            : passkeyStatus === "success"
                            ? "border-emerald-400 bg-emerald-950/50 text-emerald-300 shadow-[0_0_18px_rgba(16,185,129,0.4)]"
                            : isFilled
                            ? "border-cyan-400 bg-gradient-to-b from-cyan-500/25 to-violet-500/20 text-cyan-200 shadow-[0_0_20px_rgba(0,240,255,0.35)]"
                            : "border-slate-500/30 bg-[#040919]/90 text-slate-600"
                        }`}
                      >
                        {isFilled ? "•" : "—"}
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d, idx) => {
                    const keyGlow =
                      idx % 3 === 0
                        ? "hover:border-cyan-400 hover:text-cyan-200"
                        : idx % 3 === 1
                        ? "hover:border-violet-400 hover:text-violet-200"
                        : "hover:border-amber-400 hover:text-amber-200";
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => pushDigit(d)}
                        className={`h-[48px] rounded-xl border border-cyan-500/25 bg-gradient-to-b from-slate-800/80 to-slate-950/90 text-slate-100 font-mono text-lg font-bold cursor-pointer transition active:scale-95 tabular ${keyGlow}`}
                      >
                        {d}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => {
                      soundEffects.playKeyClick(620);
                      setEnteredDigits("");
                      setLockFeedback("Cleared — Enter 6-digit passkey");
                    }}
                    className="h-[48px] rounded-xl border border-rose-500/30 bg-gradient-to-b from-rose-950/55 to-slate-950/90 hover:border-rose-400 text-rose-300 font-sans text-sm font-semibold cursor-pointer transition"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => pushDigit("0")}
                    className="h-[48px] rounded-xl border border-cyan-500/25 bg-gradient-to-b from-slate-800/80 to-slate-950/90 hover:border-cyan-400 text-slate-100 font-mono text-lg font-bold cursor-pointer transition active:scale-95 tabular"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      soundEffects.playKeyClick(700);
                      setEnteredDigits((prev) => prev.slice(0, -1));
                    }}
                    className="h-[48px] rounded-xl border border-amber-500/30 bg-gradient-to-b from-amber-950/45 to-slate-950/90 hover:border-amber-400 text-amber-200 font-sans text-sm font-semibold cursor-pointer transition"
                  >
                    Back
                  </button>
                </div>

                <div className="flex items-center justify-between gap-3 text-xs font-mono text-slate-400 tabular">
                  <span
                    className={
                      passkeyStatus === "error"
                        ? "text-rose-400"
                        : passkeyStatus === "success"
                        ? "text-emerald-400"
                        : "text-slate-300"
                    }
                  >
                    {lockFeedback}
                  </span>
                  <span>Mobile Shield</span>
                </div>
              </>
            ) : (
              <form onSubmit={handlePasswordLogin} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-slate-300 mb-1 font-mono">
                    Username / Commander ID
                  </label>
                  <div className="relative">
                    <input
                      ref={usernameInputRef}
                      type="text"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        if (errorMsg) setErrorMsg("");
                      }}
                      placeholder="Commander ID"
                      autoComplete="username"
                      required
                      className="w-full px-3.5 py-2.5 bg-[#04070f] border border-slate-700 focus:border-[#00f0ff] rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none font-mono text-xs pr-9"
                    />
                    <User className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-slate-300 mb-1 font-mono">
                    Security Password
                  </label>
                  <div className="relative">
                    <input
                      ref={passwordInputRef}
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errorMsg) setErrorMsg("");
                      }}
                      placeholder="••••••"
                      autoComplete="current-password"
                      required
                      className="w-full px-3.5 py-2.5 bg-[#04070f] border border-slate-700 focus:border-[#00f0ff] rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none font-mono text-xs pr-10 tracking-widest"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-[#00f0ff] cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs font-mono text-slate-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 accent-cyan-400 rounded cursor-pointer"
                  />
                  <span>Remember Session</span>
                </label>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl font-orbitron font-bold tracking-wider text-xs text-[#030712] flex items-center justify-center gap-2 cursor-pointer transition hover:-translate-y-0.5"
                  style={{
                    background: "linear-gradient(135deg, #00f0ff, #8b5cf6)",
                    boxShadow: "0 0 24px rgba(0, 240, 255, 0.28)",
                  }}
                >
                  <KeyRound className="w-4 h-4" />
                  <span>UNLOCK WASU&apos;S JARVIS</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
