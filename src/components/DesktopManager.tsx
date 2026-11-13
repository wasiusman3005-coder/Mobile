import React, { useState, useEffect, useRef } from "react";
import {
  Smartphone,
  Cpu,
  HardDrive,
  BatteryCharging,
  Wifi,
  Flashlight,
  Vibrate,
  Sun,
  Share2,
  MapPin,
  BellRing,
  Play,
  Check,
  FolderPlus,
  Trash2,
  FileText,
  Film,
  Image as ImageIcon,
  Music,
  Code2,
  Archive,
  Sparkles,
} from "lucide-react";
import { soundEffects } from "../services/soundEffects";
import { speechService } from "../services/speechService";
import { readPhoneHardwareTelemetry, PhoneHardwareTelemetry } from "../services/systemTelemetry";
import {
  getPhoneStorageStats,
  getCurrentPhoneLocation,
  ingestPickedMobileFiles,
  loadMobileVaultFiles,
  saveMobileVaultFiles,
  shareViaPhone,
  togglePhoneFlashlight,
  toggleScreenWakeLock,
  triggerHaptic,
  PhoneStorageStats,
  MobileVaultFile,
} from "../services/mobileDeviceActions";
import { LanguageCode, VoiceGender } from "../types";

interface DesktopManagerProps {
  language: LanguageCode;
  voiceGender: VoiceGender;
}

interface MobileRoutineMacro {
  id: string;
  tag: string;
  title: string;
  voicePromptUrdu: string;
  voicePromptPunjabi: string;
  voicePromptEnglish: string;
}

const MOBILE_MACROS: MobileRoutineMacro[] = [
  {
    id: "mob-1",
    tag: "FOCUS SHIELD",
    title: "Night Focus & Keep Screen Awake",
    voicePromptUrdu: "Zoya, phone par Study Focus Mode aur screen awake on kar do.",
    voicePromptPunjabi: "Zoya, phone te study mode te screen awake chalu kar de.",
    voicePromptEnglish: "Zoya, activate Phone Focus Mode and keep screen awake.",
  },
  {
    id: "mob-2",
    tag: "SECURITY",
    title: "Quick Biometric Vault Audit",
    voicePromptUrdu: "Zoya, phone ki security aur biometric status check karo.",
    voicePromptPunjabi: "Zoya, mobile di fingerprint te face security check kar.",
    voicePromptEnglish: "Zoya, run quick mobile biometric security check.",
  },
  {
    id: "mob-3",
    tag: "SOS / ALERT",
    title: "Flashlight + Find Phone Siren + Vibrate",
    voicePromptUrdu: "Zoya, phone ki torch aur buzzer on karo.",
    voicePromptPunjabi: "Zoya, phone di light te alarm waja de.",
    voicePromptEnglish: "Zoya, turn on phone flashlight and alert siren.",
  },
  {
    id: "mob-4",
    tag: "GPS TRACK",
    title: "Lock Current Mobile GPS Coordinates",
    voicePromptUrdu: "Zoya, meri current phone location save karo.",
    voicePromptPunjabi: "Zoya, meri hun wali location save kar le.",
    voicePromptEnglish: "Zoya, lock my current phone GPS coordinates.",
  },
];

export const DesktopManager: React.FC<DesktopManagerProps> = ({
  language,
  voiceGender,
}) => {
  const [phone, setPhone] = useState<PhoneHardwareTelemetry | null>(null);
  const [storage, setStorage] = useState<PhoneStorageStats | null>(null);
  const [vaultFiles, setVaultFiles] = useState<MobileVaultFile[]>(() => loadMobileVaultFiles());
  const [filterType, setFilterType] = useState<string>("all");

  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [torchActive, setTorchActive] = useState(false);
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [activeMacroId, setActiveMacroId] = useState<string | null>(null);
  const [statusAlert, setStatusAlert] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      const [p, s] = await Promise.all([
        readPhoneHardwareTelemetry(),
        getPhoneStorageStats(),
      ]);
      if (!cancelled) {
        setPhone(p);
        setStorage(s);
      }
    };
    poll();
    const timer = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const handleWakeLockToggle = async () => {
    soundEffects.playClick();
    triggerHaptic(20);
    const active = await toggleScreenWakeLock(!wakeLockActive);
    setWakeLockActive(active);
    setStatusAlert(
      active
        ? "Screen Wake Lock ACTIVE — Phone display sone se ruk gayi hai."
        : "Screen Wake Lock OFF — Normal phone display sleep restored."
    );
  };

  const handleTorchToggle = async () => {
    soundEffects.playClick();
    triggerHaptic(25);
    const res = await togglePhoneFlashlight(!torchActive);
    setTorchActive(res.active);
    setStatusAlert(res.message);
    speechService.speak(res.message, { lang: language, gender: voiceGender });
  };

  const handleVibrateTest = () => {
    soundEffects.playBeepConfirm();
    const ok = triggerHaptic([80, 50, 120, 50, 80]);
    setStatusAlert(
      ok
        ? "Haptic Motor Pulse sent to Phone!"
        : "Browser vibration API is desktop/silent mode par hai — Android Chrome par feel hoga."
    );
  };

  const handleGpsLocate = async () => {
    soundEffects.playScan();
    setStatusAlert("Acquiring live GPS satellite lock from your phone...");
    const loc = await getCurrentPhoneLocation();
    if (loc) {
      setGpsLocation(loc);
      soundEffects.playBeepConfirm();
      setStatusAlert(`GPS LOCKED: Lat ${loc.lat.toFixed(5)}, Lng ${loc.lng.toFixed(5)}`);
      speechService.speak("Phone GPS location mil gayi hai.", { lang: language, gender: voiceGender });
    } else {
      setStatusAlert("Location permission denied ya phone GPS off hai.");
    }
  };

  const handleShareApp = async () => {
    soundEffects.playClick();
    triggerHaptic(20);
    const shared = await shareViaPhone(
      "Q-NEXUS: Mobile Jarvis OS",
      "Check out Q-NEXUS Mobile AI Assistant with Zoya 3D Hologram & Urdu Voice!",
      window.location.href
    );
    if (!shared && navigator.clipboard) {
      await navigator.clipboard.writeText(window.location.href);
      setStatusAlert("Share sheet not available — App link clipboard mein copy ho gaya!");
    } else if (shared) {
      setStatusAlert("Native Phone Share Sheet opened!");
    }
  };

  const handleRingSiren = () => {
    soundEffects.playAlert();
    triggerHaptic([150, 80, 150, 80, 200]);
    setStatusAlert("PHONE LOCATOR SIREN ACTIVE — Zoya alert played!");
    speechService.speak(
      language === "pa"
        ? "Wasi jaan, main tuhada phone ring kar rahi aan!"
        : "Wasi jaan, aapka phone yahan hai! Q-NEXUS alert active.",
      { lang: language, gender: voiceGender }
    );
  };

  const runMobileMacro = async (macro: MobileRoutineMacro) => {
    soundEffects.playBeepConfirm();
    triggerHaptic(30);
    setActiveMacroId(macro.id);

    if (macro.id === "mob-1" && !wakeLockActive) {
      const active = await toggleScreenWakeLock(true);
      setWakeLockActive(active);
    } else if (macro.id === "mob-3") {
      await togglePhoneFlashlight(true).then((r) => setTorchActive(r.active));
      triggerHaptic([120, 60, 120]);
    } else if (macro.id === "mob-4") {
      const loc = await getCurrentPhoneLocation();
      if (loc) setGpsLocation(loc);
    }

    const voicePrompt =
      language === "pa"
        ? macro.voicePromptPunjabi
        : language === "en"
        ? macro.voicePromptEnglish
        : macro.voicePromptUrdu;

    setStatusAlert(`EXECUTED MOBILE ROUTINE: ${macro.title}`);
    speechService.speak(voicePrompt, { lang: language, gender: voiceGender });
    setTimeout(() => setActiveMacroId(null), 1800);
  };

  const handlePickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    soundEffects.playBeepConfirm();
    triggerHaptic(20);
    const updated = ingestPickedMobileFiles(fileList);
    setVaultFiles(updated);
    setStatusAlert(`${fileList.length} mobile file(s) automatically sorted & indexed in Phone Vault!`);
    speechService.speak(
      `Aapki ${fileList.length} files mobile vault mein categorize ho gayi hain.`,
      { lang: language, gender: voiceGender }
    );
    e.target.value = "";
  };

  const handleRemoveFile = (id: string) => {
    soundEffects.playClick();
    const updated = vaultFiles.filter((f) => f.id !== id);
    setVaultFiles(updated);
    saveMobileVaultFiles(updated);
  };

  const filteredFiles =
    filterType === "all" ? vaultFiles : vaultFiles.filter((f) => f.type === filterType);

  return (
    <div className="space-y-5 font-rajdhani">
      {statusAlert && (
        <div className="p-3 rounded-xl bg-cyan-950/75 border border-cyan-400/50 text-cyan-200 text-xs font-mono flex items-center justify-between gap-2 animate-fadeIn">
          <span>⚡ {statusAlert}</span>
          <button onClick={() => setStatusAlert(null)} className="text-slate-400 hover:text-white cursor-pointer">
            ×
          </button>
        </div>
      )}

      {/* Live Mobile Phone Hardware Telemetry Grid (Zero PC Options) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-cyan-500/40 transition">
          <div className="flex items-center justify-between mb-2 gap-1">
            <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5 truncate">
              <Cpu className="w-4 h-4 text-cyan-400 shrink-0" />
              <span className="truncate">PHONE CHIP &amp; OS</span>
            </span>
            <span className="text-[10px] font-mono text-cyan-400 font-bold shrink-0">
              {phone ? `${phone.cpuThreads}T` : "--"}
            </span>
          </div>
          <div className="text-lg md:text-xl font-orbitron font-bold text-slate-100 mb-1 truncate">
            {phone?.deviceName || "This Smartphone"}
          </div>
          <div className="text-[11px] font-mono text-slate-400 truncate">
            {phone ? `${phone.osLabel} • ${phone.screenResolution}` : "Reading sensors..."}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/40 transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
              <BatteryCharging className="w-4 h-4 text-emerald-400" />
              PHONE BATTERY
            </span>
            <span className="text-[10px] font-mono text-emerald-400 font-bold">
              {phone?.isCharging ? "CHARGING ⚡" : "ON BATTERY"}
            </span>
          </div>
          <div className="text-xl md:text-2xl font-orbitron font-bold text-slate-100 mb-2">
            {phone?.batteryPercent !== null && phone?.batteryPercent !== undefined
              ? `${phone.batteryPercent}%`
              : "Optimal"}
          </div>
          <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
            <div
              className="bg-emerald-400 h-full transition-all duration-500"
              style={{ width: `${phone?.batteryPercent ?? 85}%` }}
            ></div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-purple-500/40 transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-purple-400" />
              RAM &amp; STORAGE
            </span>
            <span className="text-[10px] font-mono text-purple-400 font-bold">
              {phone?.ramApproxGb ? `~${phone.ramApproxGb} GB` : "PWA"}
            </span>
          </div>
          <div className="text-xl md:text-2xl font-orbitron font-bold text-slate-100 mb-1">
            {storage ? `${storage.usedMb} MB` : "--"}
          </div>
          <div className="text-[11px] font-mono text-slate-400">
            Quota: {storage ? `${storage.quotaGb} GB available` : "Calculating..."}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-blue-500/40 transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
              <Wifi className="w-4 h-4 text-blue-400" />
              NETWORK &amp; GPS
            </span>
            <span className="text-[10px] font-mono text-blue-400 font-bold">
              {phone?.online ? "ONLINE" : "OFFLINE"}
            </span>
          </div>
          <div className="text-lg font-orbitron font-bold text-slate-100 mb-1">
            {phone?.networkType || "Wi-Fi / 4G"}
          </div>
          <div className="text-[11px] font-mono text-slate-400 truncate">
            {gpsLocation
              ? `GPS: ${gpsLocation.lat.toFixed(3)}, ${gpsLocation.lng.toFixed(3)}`
              : phone?.downlinkMbps
              ? `Speed: ~${phone.downlinkMbps} Mbps`
              : "Tap GPS Locate below"}
          </div>
        </div>
      </div>

      {/* Main Two-Column Mobile Hub */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left Column: Native Phone Hardware Controls + Mobile Macros */}
        <div className="space-y-5">
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/75 border border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-cyan-400" />
                <h3 className="font-orbitron font-bold text-sm sm:text-base text-cyan-400 uppercase">
                  MOBILE HARDWARE QUICK CONTROLS
                </h3>
              </div>
              <span className="text-[10px] font-mono text-emerald-400">DIRECT PHONE APIs</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs font-mono">
              <button
                type="button"
                onClick={handleWakeLockToggle}
                className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-2 ${
                  wakeLockActive
                    ? "bg-amber-950/60 border-amber-400 text-amber-200"
                    : "bg-slate-950/70 border-slate-800 hover:border-cyan-500/50 text-slate-300"
                }`}
              >
                <Sun className={`w-5 h-5 ${wakeLockActive ? "text-amber-300" : "text-cyan-400"}`} />
                <div>
                  <div className="font-bold">Screen Awake</div>
                  <div className="text-[10px] text-slate-400">{wakeLockActive ? "ON (Unlocked)" : "Tap to Keep On"}</div>
                </div>
              </button>

              <button
                type="button"
                onClick={handleTorchToggle}
                className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-2 ${
                  torchActive
                    ? "bg-cyan-500 text-slate-950 border-cyan-300 font-bold"
                    : "bg-slate-950/70 border-slate-800 hover:border-cyan-500/50 text-slate-300"
                }`}
              >
                <Flashlight className={`w-5 h-5 ${torchActive ? "text-slate-950" : "text-cyan-400"}`} />
                <div>
                  <div className="font-bold">Flashlight</div>
                  <div className={`text-[10px] ${torchActive ? "text-slate-900" : "text-slate-400"}`}>
                    {torchActive ? "TORCH ON" : "Camera Flash"}
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={handleVibrateTest}
                className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-purple-400/60 text-slate-300 text-left transition cursor-pointer flex flex-col justify-between gap-2"
              >
                <Vibrate className="w-5 h-5 text-purple-400" />
                <div>
                  <div className="font-bold">Haptic Vibrate</div>
                  <div className="text-[10px] text-slate-400">Pulse Motor</div>
                </div>
              </button>

              <button
                type="button"
                onClick={handleGpsLocate}
                className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-blue-400/60 text-slate-300 text-left transition cursor-pointer flex flex-col justify-between gap-2"
              >
                <MapPin className="w-5 h-5 text-blue-400" />
                <div>
                  <div className="font-bold">GPS Fix</div>
                  <div className="text-[10px] text-slate-400">
                    {gpsLocation ? `${gpsLocation.lat.toFixed(2)}, ${gpsLocation.lng.toFixed(2)}` : "Get Coords"}
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={handleShareApp}
                className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-emerald-400/60 text-slate-300 text-left transition cursor-pointer flex flex-col justify-between gap-2"
              >
                <Share2 className="w-5 h-5 text-emerald-400" />
                <div>
                  <div className="font-bold">Share App</div>
                  <div className="text-[10px] text-slate-400">WhatsApp / Share</div>
                </div>
              </button>

              <button
                type="button"
                onClick={handleRingSiren}
                className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-rose-400/60 text-slate-300 text-left transition cursor-pointer flex flex-col justify-between gap-2"
              >
                <BellRing className="w-5 h-5 text-rose-400" />
                <div>
                  <div className="font-bold">Locator Siren</div>
                  <div className="text-[10px] text-slate-400">Zoya Ping</div>
                </div>
              </button>
            </div>
          </div>

          {/* Mobile Voice Routines */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/75 border border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <h3 className="font-orbitron font-bold text-sm sm:text-base text-purple-400 uppercase">
                  MOBILE VOICE ROUTINES
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400">1-TAP RUN</span>
            </div>

            <div className="space-y-2.5">
              {MOBILE_MACROS.map((m) => {
                const isRunning = activeMacroId === m.id;
                return (
                  <div
                    key={m.id}
                    className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-purple-500/40 transition flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded bg-purple-950/80 border border-purple-500/30 text-[10px] font-mono text-purple-300">
                          {m.tag}
                        </span>
                        <h4 className="font-semibold text-xs text-slate-100 truncate">{m.title}</h4>
                      </div>
                      <div className="text-[11px] font-mono text-cyan-300 mt-1 truncate">
                        "{language === "pa" ? m.voicePromptPunjabi : language === "en" ? m.voicePromptEnglish : m.voicePromptUrdu}"
                      </div>
                    </div>

                    <button
                      onClick={() => runMobileMacro(m)}
                      disabled={isRunning}
                      className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        isRunning
                          ? "bg-emerald-500 text-slate-950 animate-pulse"
                          : "bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-900/50"
                      }`}
                    >
                      {isRunning ? <Check className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      <span>{isRunning ? "DONE" : "RUN"}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Mobile Gallery & File Vault Organizer */}
        <div className="space-y-5">
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/75 border border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-emerald-400" />
                <h3 className="font-orbitron font-bold text-sm sm:text-base text-emerald-400 uppercase">
                  MOBILE FILE &amp; GALLERY VAULT
                </h3>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs font-mono transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-950/50"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>PICK PHONE FILES</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handlePickFiles}
                className="hidden"
              />
            </div>

            <p className="text-xs font-mono text-slate-400 mb-3">
              Apne phone ki Photos, Videos, Audio notes ya PDF/Documents select karein — Q-NEXUS unhe khud category folders mein index kar lega.
            </p>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-1.5 mb-3 text-[10px] font-mono">
              {["all", "image", "video", "audio", "document", "archive"].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFilterType(cat)}
                  className={`px-2.5 py-1 rounded-lg border uppercase cursor-pointer ${
                    filterType === cat
                      ? "bg-emerald-500 text-slate-950 border-emerald-400 font-bold"
                      : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {filteredFiles.length === 0 ? (
                <div className="p-6 text-center text-xs font-mono text-slate-400 rounded-xl bg-slate-950/60 border border-dashed border-slate-800">
                  Abhi koi mobile file add nahi hui. Upar <strong className="text-emerald-300">PICK PHONE FILES</strong> daba kar phone se photos, docs ya videos add karein!
                </div>
              ) : (
                filteredFiles.map((file) => {
                  const Icon =
                    file.type === "video"
                      ? Film
                      : file.type === "image"
                      ? ImageIcon
                      : file.type === "audio"
                      ? Music
                      : file.type === "code"
                      ? Code2
                      : file.type === "archive"
                      ? Archive
                      : FileText;

                  return (
                    <div
                      key={file.id}
                      className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between text-xs font-mono hover:border-slate-700 transition gap-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-1.5 rounded-lg bg-slate-900 text-cyan-400 shrink-0">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-slate-200 truncate">{file.name}</div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-2">
                            <span>{file.size}</span>
                            <span>•</span>
                            <span className="text-emerald-400 truncate">{file.folder}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveFile(file.id)}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-red-950 text-slate-400 hover:text-red-300 transition shrink-0 cursor-pointer"
                        title="Remove from Phone Vault"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/60 border border-cyan-500/20 text-xs font-mono text-slate-400 space-y-1.5">
            <div className="text-cyan-400 font-bold">💡 MOBILE VOICE COMMANDS FOR WASI:</div>
            <div>• "Zoya, phone ki torch on karo aur GPS check karo."</div>
            <div>• "Zoya, Fingerprint lock guard settings kholo."</div>
            <div>• "Zoya, mera 3D Face Hologram phone screen par lao."</div>
          </div>
        </div>
      </div>
    </div>
  );
};
