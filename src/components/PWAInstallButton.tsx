import React, { useState, useEffect } from "react";
import {
  Download,
  Smartphone,
  Share,
  PlusSquare,
  WifiOff,
  X,
  ExternalLink,
  Copy,
  Check,
  MoreVertical,
} from "lucide-react";
import { usePWAInstall, useOnlineStatus } from "../hooks/usePWAInstall";
import { soundEffects } from "../services/soundEffects";

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, isInAppBrowser, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [showAndroidGuide, setShowAndroidGuide] = useState(false);
  const [inIframe, setInIframe] = useState(false);
  const [standaloneUrl, setStandaloneUrl] = useState(
    "https://ais-pre-3b363hdraqq5cmkne56v2i-987831856092.asia-southeast1.run.app"
  );
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setInIframe(window.self !== window.top);
    } catch {
      setInIframe(true);
    }
    const origin = window.location.origin || "";
    if (origin && !origin.includes("localhost") && !origin.includes("127.0.0.1")) {
      setStandaloneUrl(origin.replace("https://ais-dev-", "https://ais-pre-"));
    }
  }, []);

  // Suppress button when already running in standalone installed PWA mode
  if (isInstalled) {
    return null;
  }

  // If opened inside AI Studio iframe, NEVER let user confuse Chrome into installing AI Studio!
  if (inIframe && standaloneUrl) {
    return (
      <a
        href={standaloneUrl}
        target="_top"
        rel="noopener noreferrer"
        onClick={() => soundEffects.playBeepConfirm()}
        className={`flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-cyan-400 hover:from-amber-300 hover:to-cyan-300 text-slate-950 font-orbitron font-extrabold shadow-lg shadow-amber-500/30 transition cursor-pointer ${
          compact ? "px-2.5 py-1.5 text-[10px]" : "px-3 py-1.5 text-xs"
        }`}
        title="Open Q-NEXUS directly outside AI Studio so Chrome installs Q-NEXUS instead of AI Studio"
      >
        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
        <span>OPEN DIRECT APP</span>
      </a>
    );
  }

  // Chromium / Android / Desktop native 1-tap install prompt
  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={async () => {
          soundEffects.playBeepConfirm();
          const accepted = await install();
          if (!accepted) {
            setShowAndroidGuide(true);
          }
        }}
        className={`flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-orbitron font-extrabold shadow-lg shadow-emerald-500/30 transition cursor-pointer ${
          compact ? "px-2.5 py-1.5 text-[11px]" : "px-3 py-1.5 text-xs"
        }`}
        title="Install Q-NEXUS Jarvis directly onto your Phone or Desktop Home Screen"
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span>INSTALL Q-NEXUS</span>
      </button>
    );
  }

  // iOS Safari Add to Home Screen flow
  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => {
            soundEffects.playClick();
            setShowIOSGuide(true);
          }}
          className={`flex items-center gap-1.5 rounded-xl bg-cyan-950/90 hover:bg-cyan-900 border border-cyan-400/60 text-cyan-200 font-mono font-bold transition cursor-pointer ${
            compact ? "px-2.5 py-1.5 text-[10px]" : "px-3 py-1.5 text-xs"
          }`}
        >
          <Smartphone className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
          <span>INSTALL ON iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 font-rajdhani">
            <div className="w-full max-w-sm rounded-2xl bg-slate-950 border border-cyan-400/50 p-5 shadow-2xl text-slate-100">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                <h3 className="font-orbitron font-bold text-sm text-cyan-300">
                  INSTALL ON iPHONE / iPAD
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-lg bg-slate-900 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3 text-xs font-mono text-slate-300">
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-2.5">
                  <Share className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>
                    1. Safari toolbar mein neeche <strong className="text-cyan-300">Share</strong> button tap karein.
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-2.5">
                  <PlusSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    2. Neeche scroll kar ke <strong className="text-emerald-300">Add to Home Screen</strong> par tap karein.
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full rounded-xl bg-cyan-500 hover:bg-cyan-400 py-2 text-xs font-orbitron font-bold text-slate-950 cursor-pointer"
              >
                GOT IT
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Universal Android / Mobile Chrome Manual Install Trigger (never silently disappears!)
  return (
    <>
      <button
        type="button"
        onClick={() => {
          soundEffects.playClick();
          setShowAndroidGuide(true);
        }}
        className={`flex items-center gap-1.5 rounded-xl bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-400/60 text-emerald-200 font-mono font-bold shadow-lg shadow-emerald-950/50 transition cursor-pointer ${
          compact ? "px-2.5 py-1.5 text-[10px]" : "px-3 py-1.5 text-xs"
        }`}
        title="How to install Q-NEXUS on Mobile Home Screen"
      >
        <Download className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
        <span>INSTALL APP</span>
      </button>

      {showAndroidGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 font-rajdhani"
          onClick={() => setShowAndroidGuide(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-slate-950 border border-emerald-400/50 p-5 shadow-2xl text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <h3 className="font-orbitron font-bold text-sm text-emerald-300">
                MOBILE APP INSTALL (2 STEPS)
              </h3>
              <button
                type="button"
                onClick={() => setShowAndroidGuide(false)}
                className="p-1 rounded-lg bg-slate-900 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isInAppBrowser && (
              <div className="mb-3 p-2.5 rounded-xl bg-amber-950/60 border border-amber-400/50 text-[11px] font-mono text-amber-200">
                Aap WhatsApp / In-App Browser mein hain — Install ke liye ooper 3 dots se{" "}
                <strong className="text-white">Open in Chrome</strong> karein!
              </div>
            )}

            <div className="space-y-2.5 text-xs font-mono text-slate-300">
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-start gap-2.5">
                <MoreVertical className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  1. Google Chrome ke top-right corner mein <strong className="text-white">3 Dots (⋮)</strong> par tap karein.
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-start gap-2.5">
                <Download className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  2. Menu mein <strong className="text-emerald-300">Add to Home screen</strong> ya{" "}
                  <strong className="text-emerald-300">Install app</strong> dabakar{" "}
                  <strong className="text-white">Install</strong> select karein.
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1.5">
                <div className="text-[10px] text-slate-400">Agar link copy karke Chrome mein kholna ho:</div>
                <div className="flex items-center justify-between gap-2 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-cyan-300 truncate">{standaloneUrl}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(standaloneUrl);
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2000);
                    }}
                    className="flex items-center gap-1 text-[10px] text-emerald-300 font-bold shrink-0 cursor-pointer"
                  >
                    {copiedLink ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedLink ? "Copied" : "Copy"}</span>
                  </button>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowAndroidGuide(false)}
              className="mt-4 w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 py-2 text-xs font-orbitron font-bold text-slate-950 cursor-pointer"
            >
              OKAY, GOT IT
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-mono font-bold text-slate-950 shadow-lg">
      <WifiOff className="w-3.5 h-3.5" />
      <span>Offline Mode — Cached Wasu &amp; Wasi ki Jan OS Active</span>
    </div>
  );
};
