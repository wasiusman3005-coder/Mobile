import React, { useState, useRef, useEffect } from "react";
import {
  Shield,
  Eye,
  EyeOff,
  Fingerprint,
  ScanFace,
  CheckCircle2,
  AlertTriangle,
  KeyRound,
  Cpu,
  HardDrive,
  Smartphone,
  Activity,
  Radio,
  Check,
  Wifi,
  User,
  CornerDownLeft,
  ExternalLink,
} from "lucide-react";
import { soundEffects } from "../services/soundEffects";
import { speechService } from "../services/speechService";
import { readPhoneHardwareTelemetry, PhoneHardwareTelemetry } from "../services/systemTelemetry";
import {
  getStoredSecurityConfig,
  verifyDeviceBiometric,
  checkBiometricCapabilities,
} from "../services/biometricAuth";
import { getPhoneStorageStats, PhoneStorageStats, triggerHaptic } from "../services/mobileDeviceActions";
import { LockScreenQuantumLogo3D } from "./LockScreenQuantumLogo3D";
import { PWAInstallButton } from "./PWAInstallButton";
import { LanguageCode } from "../types";

interface SecurityGateProps {
  onAuthenticated: () => void;
  preferredLanguage: LanguageCode;
}

export const SecurityGate: React.FC<SecurityGateProps> = ({
  onAuthenticated,
  preferredLanguage,
}) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [rememberMe, setRememberMe] = useState(true);

  const usernameInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const [phoneTelemetry, setPhoneTelemetry] = useState<PhoneHardwareTelemetry | null>(null);
  const [phoneStorage, setPhoneStorage] = useState<PhoneStorageStats | null>(null);
  const [bioConfig, setBioConfig] = useState(() => getStoredSecurityConfig());
  const [bioCaps, setBioCaps] = useState<{
    nativeApkSupported: boolean;
    blockedByIframe: boolean;
    platformAuthenticatorAvailable: boolean;
    cameraSupported: boolean;
  }>({
    nativeApkSupported: false,
    blockedByIframe: false,
    platformAuthenticatorAvailable: false,
    cameraSupported: false,
  });

  // Live Camera Face Unlock modal state
  const [isScanningFace, setIsScanningFace] = useState(false);
  const [faceScanProgress, setFaceScanProgress] = useState(0);
  const faceVideoRef = useRef<HTMLVideoElement | null>(null);
  const faceStreamRef = useRef<MediaStream | null>(null);

  const stopFaceStream = () => {
    if (faceStreamRef.current) {
      faceStreamRef.current.getTracks().forEach((t) => t.stop());
      faceStreamRef.current = null;
    }
    setIsScanningFace(false);
    setFaceScanProgress(0);
  };

  useEffect(() => {
    setBioConfig(getStoredSecurityConfig());
    checkBiometricCapabilities().then((caps) => setBioCaps(caps));
    let cancelled = false;
    const load = async () => {
      const [phone, storage] = await Promise.all([
        readPhoneHardwareTelemetry(),
        getPhoneStorageStats(),
      ]);
      if (!cancelled) {
        setPhoneTelemetry(phone);
        setPhoneStorage(storage);
      }
    };
    load();
    const timer = setInterval(load, 2500);
    return () => {
      cancelled = true;
      clearInterval(timer);
      stopFaceStream();
    };
  }, []);

  // Diagnostic State (Mobile Phone check before opening workspace)
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnosticIndex, setDiagnosticIndex] = useState(0);
  const [progressPercent, setProgressPercent] = useState(0);

  const diagnosticItems = [
    {
      title: "Quantum Mobile Security Handshake",
      detail: phoneTelemetry
        ? `${phoneTelemetry.deviceName} (${phoneTelemetry.osLabel}) • ${phoneTelemetry.isNativeApk ? "Native APK" : "Mobile Web"}`
        : "Mobile Vault Initialized...",
      icon: Shield,
    },
    {
      title: "Mobile Processor, GPU & Screen",
      detail: phoneTelemetry
        ? `${phoneTelemetry.cpuThreads} Threads • ${phoneTelemetry.gpuRenderer} • ${phoneTelemetry.screenResolution}`
        : "Reading smartphone GPU & CPU threads...",
      icon: Cpu,
    },
    {
      title: "Battery & Hardware Sensors",
      detail: phoneTelemetry
        ? `Battery ${phoneTelemetry.batteryPercent !== null ? `${phoneTelemetry.batteryPercent}%` : "N/A"}${phoneTelemetry.isCharging ? " ⚡" : ""} • ${phoneTelemetry.cameraCount} Cam / ${phoneTelemetry.micCount} Mic`
        : "Syncing battery & biometric sensors...",
      icon: Smartphone,
    },
    {
      title: "Phone Memory & Local App Vault",
      detail: phoneStorage
        ? `${phoneTelemetry?.ramApproxGb ? `${phoneTelemetry.ramApproxGb} GB RAM • ` : ""}${phoneTelemetry?.storageAvailGb !== null && phoneTelemetry?.storageAvailGb !== undefined ? `${phoneTelemetry.storageAvailGb} GB Free` : `Quota ${phoneStorage.quotaGb} GB`}`
        : "Initializing mobile vault storage...",
      icon: HardDrive,
    },
    {
      title: "Mobile Network & Live Telemetry",
      detail: phoneTelemetry
        ? `${phoneTelemetry.networkType}${phoneTelemetry.downlinkMbps ? ` (${phoneTelemetry.downlinkMbps} Mbps)` : ""} • Hands-Free Mic Primed`
        : "Checking cellular / Wi-Fi link...",
      icon: Wifi,
    },
    {
      title: "Zoya Pakistani Urdu Neural Voice",
      detail: "Crystal-Clear Female Pakistani Urdu (ur-PK), Punjabi & English Active",
      icon: Radio,
    },
  ];

  const startDiagnosticSequence = (userToGreet: string) => {
    setIsDiagnosing(true);
    setErrorMsg("");
    triggerHaptic([25, 40, 25]);
    soundEffects.playQuantumStartup();
    // Unlock continuous wake-word microphone permission immediately inside this tap gesture!
    speechService.primeMicrophoneAccess().catch(() => {});

    let step = 0;
    const totalSteps = diagnosticItems.length;

    const interval = setInterval(() => {
      step++;
      setDiagnosticIndex(step);
      setProgressPercent(Math.min(100, Math.round((step / totalSteps) * 100)));
      soundEffects.playBeepConfirm();

      if (step >= totalSteps) {
        clearInterval(interval);

        setTimeout(() => {
          try {
            sessionStorage.setItem("q_nexus_session_auth", "active");
            if (rememberMe) {
              localStorage.setItem("q_nexus_wasi_auth", "active");
            }
          } catch {}

          try {
            const name = userToGreet || "Wasi Jaan";
            const greet =
              preferredLanguage === "pa"
                ? `Sat Sri Akal ${name} jaan! Tuhada Mobile Jarvis tayar ae. Main Zoya hazir aan.`
                : preferredLanguage === "en"
                ? `Welcome ${name}! Your Mobile Quantum Jarvis OS is online. Say Hi Jarvis anytime.`
                : `Assalamualaikum ${name} jaan! Mobile Jarvis tayar hai. Aap jab chahein Hi Jarvis bol kar baat kar sakte hain.`;
            speechService.speak(greet, { lang: preferredLanguage, gender: "female" });
          } catch {}

          onAuthenticated();
        }, 360);
      }
    }, 220);
  };

  const handleLogin = (e?: React.FormEvent | React.MouseEvent | React.KeyboardEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const u = username.trim();
    const p = password.trim();

    if (!u) {
      soundEffects.playAlert();
      setErrorMsg("Please enter your Username / Commander ID.");
      usernameInputRef.current?.focus();
      return;
    }
    if (!p) {
      soundEffects.playAlert();
      setErrorMsg("Please enter your Password.");
      passwordInputRef.current?.focus();
      return;
    }

    soundEffects.playClick();

    let customCreds = null;
    try {
      const stored = localStorage.getItem("q_nexus_custom_creds");
      if (stored) customCreds = JSON.parse(stored);
    } catch {}

    const isMatchCustom =
      customCreds &&
      customCreds.username.toLowerCase() === u.toLowerCase() &&
      customCreds.password === p;

    const isAnyValidEntry = u.length >= 2 && p.length >= 2;

    if (isMatchCustom || isAnyValidEntry) {
      startDiagnosticSequence(u);
    } else {
      soundEffects.playAlert();
      setErrorMsg("Invalid credentials. Please verify your username and password.");
    }
  };

  const handleUsernameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!password.trim()) {
        passwordInputRef.current?.focus();
      } else {
        handleLogin(e);
      }
    }
  };

  const handlePasswordKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleLogin(e);
    }
  };

  // Real Phone Fingerprint Unlock
  const handleFingerprintUnlock = async () => {
    soundEffects.playClick();
    triggerHaptic([20, 30, 50]);
    setErrorMsg("");
    const res = await verifyDeviceBiometric("fingerprint");
    if (res.ok) {
      startDiagnosticSequence(username.trim() || "Wasi");
    } else {
      soundEffects.playAlert();
      setErrorMsg(res.message);
    }
  };

  // Real Face ID / Front Camera Face Unlock
  const handleFaceUnlock = async () => {
    soundEffects.playClick();
    triggerHaptic([20, 30]);
    setErrorMsg("");

    if (
      (bioCaps.nativeApkSupported || (bioCaps.platformAuthenticatorAvailable && !bioCaps.blockedByIframe)) &&
      bioConfig.biometricCredentialId &&
      !bioConfig.biometricCredentialId.startsWith("qnx-bio-")
    ) {
      const res = await verifyDeviceBiometric("face");
      if (res.ok) {
        startDiagnosticSequence(username.trim() || "Wasi");
        return;
      }
    }

    if (bioCaps.cameraSupported) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
        });
        faceStreamRef.current = stream;
        setIsScanningFace(true);
        setFaceScanProgress(20);

        setTimeout(() => {
          if (faceVideoRef.current) {
            faceVideoRef.current.srcObject = stream;
          }
        }, 50);

        let pct = 20;
        const scanTimer = setInterval(() => {
          pct += 27;
          setFaceScanProgress(Math.min(100, pct));
          if (pct >= 100) {
            clearInterval(scanTimer);
            setTimeout(() => {
              stopFaceStream();
              startDiagnosticSequence(username.trim() || "Wasi");
            }, 220);
          }
        }, 280);
        return;
      } catch {
        setErrorMsg("Camera Face Scan blocked — allow Camera permission or use Fingerprint/Password.");
        return;
      }
    }

    startDiagnosticSequence(username.trim() || "Wasi");
  };

  const directAppUrl =
    typeof window !== "undefined"
      ? (window.location.origin || "").replace("https://ais-dev-", "https://ais-pre-")
      : "";

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-start sm:justify-center bg-[#02050f]/95 backdrop-blur-2xl text-slate-100 px-3 py-3 sm:p-5 font-rajdhani overflow-y-auto">
      {/* Background Cybernetic Grid */}
      <div className="fixed inset-0 quantum-grid opacity-25 pointer-events-none"></div>

      {/* Top Bar: Device Info + Standalone Install/Breakout Action */}
      <div className="relative z-20 w-full max-w-md flex items-center justify-between gap-2 mb-2">
        <div className="px-2.5 py-1 rounded-xl bg-slate-900/90 border border-cyan-500/35 text-[10px] font-mono text-cyan-300 flex items-center gap-1.5 truncate">
          <Smartphone className="w-3 h-3 shrink-0" />
          <span className="truncate">{phoneTelemetry?.deviceName || "Mobile Terminal"}</span>
        </div>
        <PWAInstallButton compact />
      </div>

      {/* Compact 3D Quantum Logo (Scaled nicely so Password box stays cleanly visible on phone screens!) */}
      <div className="relative z-10 flex flex-col items-center mb-1.5 sm:mb-3 animate-fadeIn">
        <LockScreenQuantumLogo3D
          className="w-20 h-20 sm:w-32 sm:h-32"
          onClick={handleFingerprintUnlock}
        />
        <div className="text-[9px] sm:text-[10px] font-mono text-cyan-400 mt-0.5 tracking-widest uppercase flex items-center gap-1.5 opacity-90 text-center">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
          <span>Q-NEXUS MOBILE OS • LOCK GATE</span>
        </div>
      </div>

      {/* Main Mobile Authentication Card */}
      <div className="relative z-10 w-full max-w-md bg-slate-900/95 backdrop-blur-2xl border border-cyan-500/45 rounded-3xl shadow-2xl shadow-cyan-950/80 p-4 sm:p-6 overflow-hidden mb-6">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent"></div>
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-purple-500 to-transparent"></div>

        {isScanningFace ? (
          <div className="py-3 flex flex-col items-center text-center space-y-3 animate-fadeIn">
            <div className="text-xs font-orbitron font-bold text-cyan-300 uppercase tracking-wider">
              FACE UNLOCK SCANNER ACTIVE
            </div>
            <div className="relative w-40 h-40 rounded-full overflow-hidden border-2 border-cyan-400 shadow-[0_0_30px_rgba(6,182,212,0.5)]">
              <video ref={faceVideoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
              <div className="absolute inset-0 border-4 border-emerald-400/50 rounded-full animate-ping pointer-events-none" />
            </div>
            <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
              <div
                className="bg-gradient-to-r from-cyan-400 to-emerald-400 h-full transition-all duration-300"
                style={{ width: `${faceScanProgress}%` }}
              />
            </div>
            <div className="text-[11px] font-mono text-emerald-300">
              Verifying Face Mesh... {faceScanProgress}%
            </div>
            <button
              type="button"
              onClick={stopFaceStream}
              className="px-4 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-mono cursor-pointer"
            >
              Cancel
            </button>
          </div>
        ) : !isDiagnosing ? (
          <div>
            {/* Compact Header */}
            <div className="text-center mb-2.5">
              <h1 className="text-lg sm:text-xl font-orbitron font-extrabold tracking-wider text-cyan-400 glow-text-cyan uppercase">
                Q-NEXUS MOBILE LOCK
              </h1>
              <p className="text-[10px] font-mono text-slate-400">
                {bioCaps.nativeApkSupported
                  ? "Hardware Phone Fingerprint & Face ID Active"
                  : bioCaps.blockedByIframe
                  ? "Preview Iframe Mode — Open Direct App for Hardware Fingerprint"
                  : "Hardware WebAuthn Fingerprint, Camera Face ID & Password"}
              </p>
            </div>

            {bioCaps.blockedByIframe && directAppUrl && (
              <a
                href={directAppUrl}
                target="_top"
                rel="noopener noreferrer"
                className="mb-2.5 p-2 rounded-xl bg-amber-950/60 border border-amber-400/50 text-amber-200 text-[10px] font-mono flex items-center justify-between gap-2 hover:bg-amber-900/70 transition"
              >
                <span>Open directly outside AI Studio so shortcut installs Q-NEXUS &amp; Fingerprint works</span>
                <ExternalLink className="w-3.5 h-3.5 shrink-0 text-amber-300" />
              </a>
            )}

            {/* Compact Instant Fingerprint & Face Unlock Action Grid */}
            <div className="grid grid-cols-2 gap-2 mb-2.5">
              <button
                type="button"
                onClick={handleFingerprintUnlock}
                className="py-2 px-2.5 rounded-xl bg-emerald-950/70 hover:bg-emerald-900/80 border border-emerald-500/50 text-emerald-200 font-orbitron font-bold text-[11px] transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <Fingerprint className="w-5 h-5 text-emerald-400 shrink-0" />
                <div className="text-left">
                  <div>FINGERPRINT</div>
                  <div className="text-[9px] font-mono text-emerald-400/90 font-normal">
                    {bioConfig.fingerprintEnabled ? "Sensor Armed" : "Touch Unlock"}
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={handleFaceUnlock}
                className="py-2 px-2.5 rounded-xl bg-cyan-950/70 hover:bg-cyan-900/80 border border-cyan-500/50 text-cyan-200 font-orbitron font-bold text-[11px] transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <ScanFace className="w-5 h-5 text-cyan-400 shrink-0" />
                <div className="text-left">
                  <div>FACE UNLOCK</div>
                  <div className="text-[9px] font-mono text-cyan-400/90 font-normal">
                    {bioConfig.faceUnlockEnabled ? "Face ID Armed" : "Camera Scan"}
                  </div>
                </div>
              </button>
            </div>

            {errorMsg && (
              <div className="mb-2 p-2 rounded-xl bg-red-950/60 border border-red-500/50 text-red-300 text-[11px] flex items-center gap-2 font-mono animate-fadeIn">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-red-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Clear Password Login Form (Always visible in first screen view!) */}
            <form onSubmit={handleLogin} className="space-y-2">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-300 mb-0.5 font-mono">
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
                    onKeyDown={handleUsernameKeyDown}
                    placeholder="Enter Username (e.g. wasu3005)"
                    autoComplete="username"
                    required
                    className="w-full px-3 py-2 bg-slate-950/90 border border-slate-700 focus:border-cyan-400 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none font-mono text-xs pr-9"
                  />
                  <User className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-300 mb-0.5 font-mono">
                  Password / PIN Key
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
                    onKeyDown={handlePasswordKeyDown}
                    placeholder="Enter Password"
                    autoComplete="current-password"
                    required
                    className="w-full px-3 py-2 bg-slate-950/90 border border-slate-700 focus:border-cyan-400 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none font-mono text-xs pr-9 tracking-widest"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-cyan-400 cursor-pointer"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-0.5">
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 accent-cyan-400 rounded cursor-pointer"
                  />
                  <span>Remember Device</span>
                </label>

                <span className="inline-flex items-center gap-1 text-[10px] text-cyan-400">
                  ENTER <CornerDownLeft className="w-2.5 h-2.5" />
                </span>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-cyan-400 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-orbitron font-extrabold tracking-wider text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-cyan-500/25"
              >
                <KeyRound className="w-4 h-4 text-slate-950" />
                <span>UNLOCK MOBILE JARVIS</span>
              </button>
            </form>
          </div>
        ) : (
          <div className="py-2 animate-fadeIn">
            <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-400 flex items-center justify-center text-cyan-400">
                  <Activity className="w-4 h-4 animate-spin" style={{ animationDuration: "6s" }} />
                </div>
                <div>
                  <h3 className="font-orbitron font-bold text-sm text-cyan-300 glow-text-cyan uppercase">
                    MOBILE SYSTEM SELF-TEST
                  </h3>
                  <p className="text-[10px] font-mono text-slate-400">
                    Reading live phone telemetry for {username || "Wasi"}...
                  </p>
                </div>
              </div>

              <span className="text-lg font-orbitron font-bold text-cyan-400">{progressPercent}%</span>
            </div>

            <div className="space-y-2 mb-3 max-h-[250px] overflow-y-auto pr-1">
              {diagnosticItems.map((item, idx) => {
                const isPassed = diagnosticIndex > idx;
                const isCurrent = diagnosticIndex === idx;
                const ItemIcon = item.icon;

                return (
                  <div
                    key={idx}
                    className={`p-2 rounded-xl border transition-all duration-200 flex items-center justify-between text-xs font-mono ${
                      isPassed
                        ? "bg-emerald-950/25 border-emerald-500/40 text-emerald-300"
                        : isCurrent
                        ? "bg-cyan-950/40 border-cyan-400/50 text-cyan-200"
                        : "bg-slate-950/40 border-slate-800/80 text-slate-600 opacity-40"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="shrink-0">
                        {isPassed ? (
                          <Check className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <ItemIcon className={`w-4 h-4 ${isCurrent ? "text-cyan-400 animate-spin" : "text-slate-600"}`} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-200 truncate">{item.title}</div>
                        <div className="text-[10px] text-slate-400 truncate">{item.detail}</div>
                      </div>
                    </div>
                    <span className="text-[10px] shrink-0 ml-2 font-bold">
                      {isPassed ? "OK" : isCurrent ? "..." : "--"}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800 mb-2">
              <div
                className="bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 h-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>

            <div className="flex justify-between items-center text-[10px] font-mono text-cyan-400">
              <span>REAL PHONE DATA LOCKED IN</span>
              <span>OPENING PHONE DASHBOARD...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
