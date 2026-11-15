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
} from "lucide-react";
import { soundEffects } from "../services/soundEffects";
import { speechService } from "../services/speechService";
import { storageService } from "../services/storage";
import { readPhoneHardwareTelemetry, PhoneHardwareTelemetry } from "../services/systemTelemetry";
import { triggerHaptic } from "../services/mobileDeviceActions";
import { PWAInstallButton } from "./PWAInstallButton";
import { LanguageCode } from "../types";

interface SecurityGateProps {
  onAuthenticated: (commanderName?: string) => void;
  preferredLanguage: LanguageCode;
}

// Strict hidden 6-digit passkey — never rendered or hinted in UI
const REQUIRED_PASSKEY = ["0", "8", "5", "2", "1", "3"].join("");

export const SecurityGate: React.FC<SecurityGateProps> = ({
  onAuthenticated,
  preferredLanguage: _preferredLanguage,
}) => {
  const [authTab, setAuthTab] = useState<"passkey" | "password">("passkey");
  const [enteredDigits, setEnteredDigits] = useState("");
  const [passkeyStatus, setPasskeyStatus] = useState<"idle" | "error" | "success">("idle");
  const [scannerLockedFlash, setScannerLockedFlash] = useState(false);
  const [lockFeedback, setLockFeedback] = useState("Enter 6-digit security passkey");
  const [soundOn, setSoundOn] = useState(soundEffects.soundEnabled);

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

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const tel = await readPhoneHardwareTelemetry();
      if (!cancelled) setPhoneTelemetry(tel);
    };
    load();
    const timer = setInterval(load, 3000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const finalizeUnlock = (userToGreet: string) => {
    if (unlockingRef.current) return;
    unlockingRef.current = true;

    setPasskeyStatus("success");
    setLockFeedback("Access Granted — Entering Diagnostics");
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
      onAuthenticated(name);
    }, 360);
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
        setLockFeedback("Enter 6-digit security passkey");
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
      if (authTab !== "passkey" || unlockingRef.current) return;
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
      className="fixed inset-0 z-50 flex flex-col items-center justify-start lg:justify-center bg-[#030612]/95 text-slate-100 px-4 py-4 sm:p-8 font-rajdhani overflow-y-auto"
    >
      {/* Multi-Colored Atmospheric Lighting Orbs */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute -top-28 -left-24 w-[420px] h-[420px] rounded-full bg-cyan-500/20 blur-[110px]" />
        <div className="absolute -bottom-32 -right-20 w-[460px] h-[460px] rounded-full bg-fuchsia-600/20 blur-[125px]" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[520px] h-[300px] rounded-full bg-amber-500/12 blur-[120px]" />
      </div>
      <div className="fixed inset-0 quantum-grid opacity-35 pointer-events-none" />

      {/* Top HUD Bar */}
      <header className="relative z-10 w-full max-w-[1120px] flex flex-wrap items-center justify-between gap-3 pb-4 mb-5 border-b border-slate-400/20">
        <div className="flex items-center gap-3">
          <div className="font-orbitron font-extrabold text-lg sm:text-xl tracking-[0.22em] text-slate-100 whitespace-nowrap">
            WASI&apos;S <span className="text-[#00f0ff]">JARVIS</span>
          </div>
          <span className="hidden sm:inline text-xs font-mono text-slate-400">
            · Security Gate · Encrypted Vault Lock
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/80 border border-slate-400/20 text-[11px] font-mono text-cyan-300">
            <Smartphone className="w-3.5 h-3.5 shrink-0" />
            <span>{phoneTelemetry?.deviceName || "Quantum Terminal"}</span>
          </div>
          <PWAInstallButton compact />
          <button
            type="button"
            onClick={() => {
              const next = !soundEffects.soundEnabled;
              soundEffects.soundEnabled = next;
              setSoundOn(next);
              if (next) soundEffects.playKeyClick(880);
            }}
            className="px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-400/25 hover:border-[#00f0ff] text-xs font-mono text-slate-200 flex items-center gap-1.5 cursor-pointer transition"
          >
            {soundOn ? <Volume2 className="w-3.5 h-3.5 text-[#00f0ff]" /> : <VolumeX className="w-3.5 h-3.5 text-slate-400" />}
            <span>{soundOn ? "Audio: On" : "Audio: Off"}</span>
          </button>
        </div>
      </header>

      {/* 2-Column Lock Grid with Prismatic Lighting */}
      <div className="relative z-10 w-full max-w-[1120px] grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 items-center my-auto">
        {/* LEFT COLUMN: Circular Main Character Portrait Surrounded by Multi-Colored Moving 3D Orbital Rings */}
        <div
          className="rounded-2xl p-[1.5px] shadow-[0_0_55px_rgba(0,240,255,0.22)]"
          style={{
            background: "linear-gradient(135deg, rgba(0,240,255,0.65), rgba(139,92,246,0.45), rgba(245,158,11,0.55))",
          }}
        >
        <div className="rounded-[15px] bg-[#060c1b]/94 p-6 sm:p-8 flex flex-col items-center gap-5 relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-72 h-40 rounded-full bg-cyan-400/20 blur-3xl"
          />
          <div
            className="relative w-[250px] h-[250px] sm:w-[290px] sm:h-[290px] flex items-center justify-center"
            style={{ perspective: "900px" }}
          >
            {/* Outer Ambient Multi-Hue Halo Glow */}
            <div
              className={`absolute -inset-2 rounded-full blur-2xl opacity-70 transition-colors duration-500 ${
                passkeyStatus === "success"
                  ? "bg-emerald-500/45"
                  : scannerLockedFlash
                  ? "bg-rose-500/50"
                  : "bg-gradient-to-tr from-cyan-500/35 via-violet-500/35 to-amber-500/30"
              }`}
            />

            {/* Ring 1: Slow Clockwise Conic Neon Halo */}
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
              <div className="w-full h-full rounded-full bg-[#060b16]/90" />
            </div>

            {/* Ring 2: Counter-Clockwise Segmented Tech Radar Ring with Orbiting Nodes */}
            <div
              className="absolute inset-3.5 rounded-full border-2 border-dashed border-[#00f0ff]/60 animate-spin-reverse"
              style={{ animationDuration: "11s" }}
            >
              <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[#00f0ff] shadow-[0_0_12px_#00f0ff]" />
              <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-violet-400 shadow-[0_0_12px_#a78bfa]" />
            </div>

            {/* Ring 3: Clockwise Fine Gold/Violet Arc Ring */}
            <div
              className="absolute inset-6 rounded-full border-[1.5px] border-t-amber-400/85 border-r-cyan-400/60 border-b-violet-500/75 border-l-transparent animate-spin"
              style={{ animationDuration: "6.5s" }}
            >
              <span className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-amber-300 shadow-[0_0_10px_#fbbf24]" />
            </div>

            {/* Ring 4 & 5: 3D Tilted Gyroscopic Orbital Rings */}
            <div className="pointer-events-none absolute -inset-1 rounded-full border border-cyan-400/45 q-gyro-ring-a" />
            <div className="pointer-events-none absolute -inset-1 rounded-full border border-violet-400/40 q-gyro-ring-b" />

            {/* Center Round Main Character Photo Frame */}
            <div
              className={`relative z-10 w-[184px] h-[184px] sm:w-[214px] sm:h-[214px] rounded-full overflow-hidden border-[3px] shadow-[0_0_32px_rgba(0,240,255,0.35)] transition-all duration-300 ${
                passkeyStatus === "success"
                  ? "border-emerald-400 scale-105 shadow-[0_0_40px_rgba(16,185,129,0.55)]"
                  : scannerLockedFlash
                  ? "border-rose-500 shadow-[0_0_40px_rgba(244,63,94,0.55)]"
                  : "border-cyan-300/80"
              }`}
              style={{
                background: "radial-gradient(circle, rgba(0, 240, 255, 0.16) 0%, #050b18 85%)",
              }}
            >
              <img
                src="/assets/aistudio/Gemini_Generated_Image_55uicz55uicz55ui_f744178a.jpg"
                alt="Wasi's Jarvis Main Character Portrait"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-[50%_18%] scale-105"
              />
              {/* Subtle Glass Vignette + Scanning Sweep Beam */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-full"
                style={{
                  boxShadow: "inset 0 0 24px rgba(2, 6, 18, 0.65)",
                }}
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
                  boxShadow: "0 0 14px 3px rgba(0, 240, 255, 0.4)",
                }}
              />
            </div>
          </div>

          <div className="text-center space-y-1.5">
            <div className="font-orbitron font-bold text-sm sm:text-base tracking-[0.12em] text-slate-100 flex items-center justify-center gap-2">
              <Lock className="w-4 h-4 text-[#00f0ff]" />
              <span>QUANTUM ENCRYPTED VAULT</span>
            </div>
            <div className="font-mono text-xs text-slate-400">
              {passkeyStatus === "success"
                ? "Passkey Confirmed — Unlocking System"
                : scannerLockedFlash
                ? "Security Mismatch — Access Blocked"
                : "Passkey verification required to unlock Jarvis"}
            </div>
          </div>
        </div>
        </div>

        {/* RIGHT COLUMN: Illuminated Prismatic 6-Digit Security Passkey Keypad */}
        <div
          className="rounded-2xl p-[1.5px] shadow-[0_0_55px_rgba(139,92,246,0.22)]"
          style={{
            background: "linear-gradient(135deg, rgba(139,92,246,0.6), rgba(0,240,255,0.55), rgba(236,72,153,0.45))",
          }}
        >
        <div className="rounded-[15px] bg-[#060c1b]/94 p-6 sm:p-8 flex flex-col gap-5 relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-16 -right-12 w-60 h-44 rounded-full bg-violet-500/20 blur-3xl"
          />
          <div>
            <h1 className="font-orbitron font-extrabold text-xl sm:text-2xl tracking-[0.08em] bg-gradient-to-r from-cyan-300 via-white to-violet-300 bg-clip-text text-transparent">
              Quantum Authentication
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-300 leading-relaxed">
              Enter your hidden 6-digit passkey to unlock Q-NEXUS Jarvis OS.
            </p>
          </div>

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
              {/* 6 Masked Passkey Slots — Luminous Glass Neon */}
              <div
                className={`grid grid-cols-6 gap-2.5 tabular ${
                  passkeyStatus === "error" ? "q-keypad-shake" : ""
                }`}
              >
                {[0, 1, 2, 3, 4, 5].map((slotIdx) => {
                  const isFilled = slotIdx < enteredDigits.length;
                  return (
                    <div
                      key={slotIdx}
                      className={`h-13 rounded-xl border flex items-center justify-center font-mono text-2xl font-bold transition ${
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

              <div className="grid grid-cols-3 gap-2.5">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d, idx) => {
                  const keyGlow =
                    idx % 3 === 0
                      ? "hover:border-cyan-400 hover:shadow-[0_0_18px_rgba(0,240,255,0.35)] hover:text-cyan-200"
                      : idx % 3 === 1
                      ? "hover:border-violet-400 hover:shadow-[0_0_18px_rgba(167,139,250,0.35)] hover:text-violet-200"
                      : "hover:border-amber-400 hover:shadow-[0_0_18px_rgba(251,191,36,0.32)] hover:text-amber-200";
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => pushDigit(d)}
                      className={`h-[50px] rounded-xl border border-cyan-500/25 bg-gradient-to-b from-slate-800/80 to-slate-950/90 text-slate-100 font-mono text-lg font-bold cursor-pointer transition active:scale-95 tabular shadow-inner ${keyGlow}`}
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
                  className="h-[50px] rounded-xl border border-rose-500/30 bg-gradient-to-b from-rose-950/55 to-slate-950/90 hover:border-rose-400 hover:shadow-[0_0_16px_rgba(244,63,94,0.3)] text-rose-300 font-sans text-sm font-semibold cursor-pointer transition"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => pushDigit("0")}
                  className="h-[50px] rounded-xl border border-cyan-500/25 bg-gradient-to-b from-slate-800/80 to-slate-950/90 hover:border-cyan-400 hover:shadow-[0_0_18px_rgba(0,240,255,0.35)] hover:text-cyan-200 text-slate-100 font-mono text-lg font-bold cursor-pointer transition active:scale-95 tabular"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEffects.playKeyClick(700);
                    setEnteredDigits((prev) => prev.slice(0, -1));
                  }}
                  className="h-[50px] rounded-xl border border-amber-500/30 bg-gradient-to-b from-amber-950/45 to-slate-950/90 hover:border-amber-400 hover:shadow-[0_0_16px_rgba(251,191,36,0.3)] text-amber-200 font-sans text-sm font-semibold cursor-pointer transition"
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
                      : "text-slate-400"
                  }
                >
                  {lockFeedback}
                </span>
                <span>Vault Protected</span>
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
                <span>UNLOCK JARVIS</span>
              </button>
            </form>
          )}
        </div>
        </div>
      </div>
    </div>
  );
};
