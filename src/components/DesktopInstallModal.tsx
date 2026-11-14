import React, { useState, useEffect } from "react";
import { Smartphone, Copy, Check, X, Globe, Fingerprint, Cpu, Download } from "lucide-react";
import { soundEffects } from "../services/soundEffects";
import { PWAInstallButton } from "./PWAInstallButton";
import { LanguageCode } from "../types";

interface DesktopInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: LanguageCode;
  initialTab?: "android" | "ios" | "apk" | "phone";
}

export const DesktopInstallModal: React.FC<DesktopInstallModalProps> = ({
  isOpen,
  onClose,
  initialTab = "android",
}) => {
  const normalizedTab: "android" | "ios" | "apk" =
    initialTab === "ios" ? "ios" : initialTab === "apk" ? "apk" : "android";

  const [activeTab, setActiveTab] = useState<"android" | "ios" | "apk">(normalizedTab);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialTab === "ios" ? "ios" : initialTab === "apk" ? "apk" : "android");
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const copyText = (text: string, idx: number) => {
    soundEffects.playClick();
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const currentOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const mobileAppLink =
    currentOrigin && !currentOrigin.includes("localhost") && !currentOrigin.includes("127.0.0.1")
      ? currentOrigin.replace("https://ais-dev-", "https://ais-pre-")
      : "https://ais-pre-3b363hdraqq5cmkne56v2i-987831856092.asia-southeast1.run.app";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/85 backdrop-blur-md animate-fadeIn font-rajdhani">
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-slate-950 border border-cyan-500/40 rounded-2xl shadow-2xl shadow-cyan-950/80 flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 border-b border-cyan-500/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-300">
              <Smartphone className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="font-orbitron font-bold text-base md:text-lg text-cyan-300 glow-text-cyan uppercase">
                PHONE APP INSTALLATION GUIDE
              </h2>
              <p className="text-xs font-mono text-slate-400">
                Android Chrome 1-Tap Install, iPhone Safari Add to Home Screen &amp; Android APK Build
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
        <div className="flex border-b border-slate-800 bg-slate-900/60 px-5 pt-3 gap-2 overflow-x-auto text-xs font-mono">
          <button
            onClick={() => {
              soundEffects.playClick();
              setActiveTab("android");
            }}
            className={`px-4 py-2 rounded-t-lg transition cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === "android"
                ? "bg-slate-950 text-emerald-300 font-bold border-t-2 border-emerald-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Android Phone (Fastest)</span>
          </button>

          <button
            onClick={() => {
              soundEffects.playClick();
              setActiveTab("ios");
            }}
            className={`px-4 py-2 rounded-t-lg transition cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === "ios"
                ? "bg-slate-950 text-cyan-300 font-bold border-t-2 border-cyan-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>iPhone / iPad (Safari)</span>
          </button>

          <button
            onClick={() => {
              soundEffects.playClick();
              setActiveTab("apk");
            }}
            className={`px-4 py-2 rounded-t-lg transition cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === "apk"
                ? "bg-slate-950 text-purple-300 font-bold border-t-2 border-purple-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Android .APK Build (Capacitor)</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs font-mono">
          {activeTab === "android" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-950/60 to-cyan-950/40 border border-emerald-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <strong className="text-emerald-300 font-bold text-sm block mb-1">
                    📱 1-Tap Phone App Install (3D Hologram + Pakistani Urdu + Fingerprint)
                  </strong>
                  <p className="text-slate-300 leading-relaxed">
                    Google Chrome mein yeh button dabate hi Q-NEXUS bilkul real Android app ban kar Home Screen par aa jayega — full screen, offline support, aur bina browser bar ke!
                  </p>
                </div>
                <div className="shrink-0">
                  <PWAInstallButton />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-cyan-500/30 space-y-2.5">
                <div className="flex items-center gap-2 text-cyan-300 font-bold">
                  <Globe className="w-4 h-4" />
                  <span>Step 1: Phone ke Google Chrome mein Shared App Link kholein</span>
                </div>
                <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-emerald-300 truncate">{mobileAppLink}</span>
                  <button
                    onClick={() => copyText(mobileAppLink, 1)}
                    className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    {copiedIndex === 1 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedIndex === 1 ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-500/40 text-amber-200 leading-relaxed text-[11px]">
                  <strong className="text-amber-300 block mb-0.5">⚠️ Zaroori: AI Studio Install &amp; 403 Error Se Kaise Bachein?</strong>
                  Phone ke Google Chrome mein wohi Google account sign-in rakhein jis se app banaya hai (ya AI Studio mein Share/Publish permissions allow karein). Direct <code className="text-cyan-300">ais-pre-...run.app</code> link ko <strong>Chrome Tab</strong> mein khol kar Install dabayein — tab sirf <strong>Q-NEXUS</strong> install hoga!
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5">
                <strong className="text-emerald-400 block">Step-by-Step Android Install:</strong>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-300 leading-relaxed">
                  <li>Apne Android phone mein <strong className="text-white">Google Chrome</strong> open karein aur ooper wala direct link kholein (wahi Gmail account login rakhein).</li>
                  <li>Login screen par Username <strong className="text-cyan-300">wasu3005</strong> aur password daal kar unlock karein.</li>
                  <li>Ooper HUD mein green <strong className="text-emerald-300">INSTALL Q-NEXUS</strong> button dabayein — ya Chrome ke right corner mein <strong className="text-white">3 Dots (⋮) ➔ Install app</strong> par tap karein.</li>
                  <li>3 second mein Home Screen par <strong className="text-cyan-300">Q-NEXUS</strong> ka asli icon ban jayega (AI Studio nahi)!</li>
                  <li>App kholne ke baad <strong className="text-white">⚙ Settings ➔ Fingerprint &amp; Face Unlock</strong> tab mein jakar apna Fingerprint aur Face ID register karein.</li>
                </ol>
              </div>

              <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-500/30 flex items-start gap-2.5 text-purple-200">
                <Fingerprint className="w-5 h-5 text-purple-300 shrink-0 mt-0.5" />
                <div>
                  <strong className="block text-purple-300">Permissions Tip (Mic, Camera &amp; Fingerprint):</strong>
                  Pehli dafa Zoya Voice mic ya Face Unlock chalane par Chrome &quot;Allow Microphone&quot; aur &quot;Allow Camera&quot; poochega — hamesha <strong>Allow</strong> dabayein.
                </div>
              </div>
            </div>
          )}

          {activeTab === "ios" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-cyan-950/40 border border-cyan-500/40 text-cyan-100 leading-relaxed">
                <strong className="text-cyan-300 font-bold text-sm block mb-1">
                  🍎 iPhone aur iPad par Real App Ki Tarah Install Karein:
                </strong>
                Apple devices par Chrome ke bajaye <strong className="text-white">Safari Browser</strong> use karein taake full-screen App aur Face ID sahi kaam kare.
              </div>

              <div className="space-y-3">
                <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center shrink-0">1</span>
                  <div>
                    <strong className="text-slate-200 block">Safari Browser mein App Kholien:</strong>
                    Current URL ko <strong className="text-cyan-300">Safari</strong> mein open karein.
                  </div>
                </div>

                <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center shrink-0">2</span>
                  <div>
                    <strong className="text-slate-200 block">Share Icon (⎙) par Tap Karein:</strong>
                    Safari ke neeche beech mein box-and-arrow <strong className="text-cyan-300">Share (⎙)</strong> icon dabayein.
                  </div>
                </div>

                <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center shrink-0">3</span>
                  <div>
                    <strong className="text-slate-200 block">Add to Home Screen Select Karein:</strong>
                    Scroll kar ke <strong className="text-emerald-300">&quot;Add to Home Screen&quot;</strong> par tap karein aur top right se <strong className="text-white">Add</strong> dabayein.
                  </div>
                </div>

                <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0">4</span>
                  <div>
                    <strong className="text-slate-200 block">Face ID / Touch ID Enable Karein:</strong>
                    Home screen icon se Q-NEXUS kholein, <strong className="text-white">⚙ Settings ➔ Fingerprint &amp; Face Unlock</strong> mein jakar Face Unlock on kar dein!
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "apk" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-purple-950/40 border border-purple-500/40 text-purple-100 leading-relaxed">
                <strong className="text-purple-300 font-bold text-sm block mb-1">
                  📦 Native Android .APK with Full Phone Control (Notifications, Calls, SMS, Biometric &amp; Background Wake):
                </strong>
                Is project mein real Android Native Kotlin plugins (<code className="text-cyan-300">QNexusPlugin.kt</code>, <code className="text-cyan-300">QNexusNotificationService.kt</code>, <code className="text-cyan-300">JarvisWakeForegroundService.kt</code>) shamil hain. Windows PC par automated script chala kar 5 minute mein asli <strong className="text-white">.apk</strong> banayein:
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-slate-200 font-bold">Step 1: Project Download kar ke Windows par double-click karein</span>
                    <button
                      onClick={() => copyText("build_android_apk.bat", 10)}
                      className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedIndex === 10 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedIndex === 10 ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                  <pre className="p-2 bg-slate-950 rounded text-cyan-300 text-[11px] overflow-x-auto">build_android_apk.bat</pre>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Yeh khud npm install, production build, Capacitor Android project, saare permissions, BiometricPrompt aur Notification/Wake services inject kar ke Android Studio open kar dega!
                  </p>
                </div>

                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-slate-200 font-bold">Step 2 (Terminal Option): Manual CLI Command</span>
                    <button
                      onClick={() => copyText("npm install && node scripts/configure_android_native.mjs && npx cap open android", 11)}
                      className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedIndex === 11 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedIndex === 11 ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                  <pre className="p-2 bg-slate-950 rounded text-emerald-300 text-[11px] overflow-x-auto">npm install &amp;&amp; node scripts/configure_android_native.mjs &amp;&amp; npx cap open android</pre>
                </div>

                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-slate-200 font-bold">Step 3: Android Studio mein APK Export karein aur Phone par Permissions Allow karein</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Android Studio mein <strong className="text-fuchsia-300">Build ➔ Build App(s) / APK(s) ➔ Build APK(s)</strong> dabayein. Phir APK phone mein install kar ke <strong>Phone Alerts</strong> hub se Notification Access + Mic + Calls allow karein!
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
          <div className="text-[11px] font-mono text-slate-400">
            Mobile ID: <span className="text-cyan-400">wasu3005</span> • Fingerprint &amp; Face Ready
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs cursor-pointer"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
