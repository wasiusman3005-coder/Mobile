import React, { useState, useEffect } from "react";
import { Download, Smartphone, Share, PlusSquare, WifiOff, X, ExternalLink } from "lucide-react";
import { usePWAInstall, useOnlineStatus } from "../hooks/usePWAInstall";
import { soundEffects } from "../services/soundEffects";

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [inIframe, setInIframe] = useState(false);
  const [standaloneUrl, setStandaloneUrl] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setInIframe(window.self !== window.top);
    } catch {
      setInIframe(true);
    }
    const origin = window.location.origin || "";
    setStandaloneUrl(origin.replace("https://ais-dev-", "https://ais-pre-"));
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

  // Chromium / Android / Desktop native install prompt (when already on standalone Q-NEXUS URL)
  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => {
          soundEffects.playBeepConfirm();
          install();
        }}
        className={`flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-orbitron font-extrabold shadow-lg shadow-emerald-500/30 transition cursor-pointer ${
          compact ? "px-2.5 py-1.5 text-[11px]" : "px-3 py-1.5 text-xs"
        }`}
        title="Install Q-NEXUS Jarvis directly onto your Phone or Desktop Home Screen"
      >
        <Download className="w-3.5 h-3.5" />
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
          className="flex items-center gap-1.5 rounded-xl bg-cyan-950/90 hover:bg-cyan-900 border border-cyan-400/60 text-cyan-200 px-3 py-1.5 text-xs font-mono font-bold transition cursor-pointer"
        >
          <Smartphone className="w-3.5 h-3.5 text-cyan-300" />
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

  return null;
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
