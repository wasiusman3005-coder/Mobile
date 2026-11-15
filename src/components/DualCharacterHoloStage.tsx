import React, { useEffect, useRef, useState } from "react";
import { Trash2, Send, Bell } from "lucide-react";
import { soundEffects } from "../services/soundEffects";
import { LanguageCode, VoiceGender } from "../types";
import { CockpitCorePhase } from "./CentralQuantumCoreHologram";

export const HUB_LIVE_VIDEOS = [
  "/assets/aistudio/gemini_generated_video_77029aae_66787b62.mp4",
  "/assets/aistudio/1_73e6d4cd.mp4",
  "/assets/aistudio/2_f462292e.mp4",
  "/assets/aistudio/3_7bd03cf9.mp4",
] as const;

export interface HubPanelNotification {
  id: string;
  title: string;
  text: string;
  source: string;
  presenterGender: "male" | "female";
  timeStr: string;
}

interface DualCharacterHoloStageProps {
  coherence: number;
  language: LanguageCode;
  voiceGender: VoiceGender;
  cockpitPhase?: CockpitCorePhase;
  assistantName?: string;
  maleName?: string;
  femaleName?: string;
  onRenameAssistant?: (newName: string) => void;
  onSwitchGender?: (nextGender: "male" | "female") => void;
  audioLevel?: number;
  liveTranscript?: string;
  liveReplyText?: string;
  recordingSeconds?: number;
  waWaveBars?: number[];
  onCancelRecording?: () => void;
  onSendRecording?: () => void;
  onStartManualRecording?: () => void;
  onSpeakBriefing?: () => void;
  onShowIdentityVideo?: () => void;
  wakeReady?: boolean;
  onPrimeWakeMic?: () => void;
  spectrumIndex?: number;
  energySurge?: boolean;
  pausedByFullscreen?: boolean;
  activeHubNotification?: HubPanelNotification | null;
  activeProjectedTitle?: string | null;
}

export const DualCharacterHoloStage: React.FC<DualCharacterHoloStageProps> = ({
  voiceGender,
  cockpitPhase = "galaxy",
  audioLevel = 0,
  liveTranscript = "",
  liveReplyText = "",
  recordingSeconds = 0,
  waWaveBars = [],
  onCancelRecording,
  onSendRecording,
  onStartManualRecording,
  wakeReady = true,
  onPrimeWakeMic,
  energySurge = false,
  pausedByFullscreen = false,
  activeHubNotification = null,
}) => {
  const slotRefs = useRef<[HTMLVideoElement | null, HTMLVideoElement | null]>([null, null]);
  const [activeSlot, setActiveSlot] = useState<0 | 1>(0);
  const [activeVideoIdx, setActiveVideoIdx] = useState(0);
  const activeSlotRef = useRef<0 | 1>(0);
  const activeVideoIdxRef = useRef(0);
  const [slotSrcs, setSlotSrcs] = useState<[string, string]>([
    HUB_LIVE_VIDEOS[0],
    HUB_LIVE_VIDEOS[1],
  ]);
  const preloadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [waveTick, setWaveTick] = useState(0);

  // Smooth wave & speech cadence tick ONLY during active processing/speaking
  useEffect(() => {
    if (cockpitPhase !== "processing" && cockpitPhase !== "speaking") return;
    const id = setInterval(() => {
      setWaveTick((t) => (t + 1) % 10000);
    }, 65);
    return () => clearInterval(id);
  }, [cockpitPhase]);

  // Clean unmount cleanup for preload timer
  useEffect(() => {
    return () => {
      if (preloadTimeoutRef.current) clearTimeout(preloadTimeoutRef.current);
    };
  }, []);

  // Only toggle playback when fullscreen modal / projected panel pauses background video
  useEffect(() => {
    const activeVid = slotRefs.current[activeSlotRef.current];
    const standbySlot: 0 | 1 = activeSlotRef.current === 0 ? 1 : 0;
    const standbyVid = slotRefs.current[standbySlot];

    if (standbyVid && !standbyVid.paused) {
      try {
        standbyVid.pause();
      } catch {}
    }
    if (!activeVid) return;

    activeVid.muted = true;
    if (pausedByFullscreen) {
      try {
        if (!activeVid.paused) activeVid.pause();
      } catch {}
    } else {
      try {
        if (activeVid.paused) activeVid.play().catch(() => {});
      } catch {}
    }
  }, [pausedByFullscreen]);

  // Ensure initial slot starts immediately on mount and recovers silently if browser pauses unexpectedly
  useEffect(() => {
    if (pausedByFullscreen) return;
    const activeVid = slotRefs.current[activeSlot];
    if (activeVid) {
      activeVid.muted = true;
      if (activeVid.paused) {
        activeVid.play().catch(() => {});
      }
    }
    const watchdog = setInterval(() => {
      const vid = slotRefs.current[activeSlotRef.current];
      if (!vid) return;
      if (vid.paused && !vid.ended && !vid.seeking && vid.readyState >= 2) {
        vid.play().catch(() => {});
      }
    }, 1800);
    return () => clearInterval(watchdog);
  }, [activeSlot, pausedByFullscreen]);

  const handleSlotEnded = (slotIdx: 0 | 1) => {
    if (slotIdx !== activeSlotRef.current) return;

    const nextVideoIdx = (activeVideoIdxRef.current + 1) % HUB_LIVE_VIDEOS.length;
    const nextSlot: 0 | 1 = slotIdx === 0 ? 1 : 0;
    const afterNextIdx = (nextVideoIdx + 1) % HUB_LIVE_VIDEOS.length;

    const nextVid = slotRefs.current[nextSlot];
    if (nextVid) {
      try {
        nextVid.muted = true;
        if (nextVid.readyState >= 1) nextVid.currentTime = 0;
        nextVid.play().catch(() => {});
      } catch {}
    }

    activeSlotRef.current = nextSlot;
    activeVideoIdxRef.current = nextVideoIdx;
    setActiveSlot(nextSlot);
    setActiveVideoIdx(nextVideoIdx);

    if (preloadTimeoutRef.current) clearTimeout(preloadTimeoutRef.current);
    preloadTimeoutRef.current = setTimeout(() => {
      setSlotSrcs((prev) => {
        if (prev[slotIdx] === HUB_LIVE_VIDEOS[afterNextIdx]) return prev;
        const next: [string, string] = [prev[0], prev[1]];
        next[slotIdx] = HUB_LIVE_VIDEOS[afterNextIdx];
        return next;
      });
    }, 260);
  };

  const isMaleActive =
    activeHubNotification && cockpitPhase === "galaxy"
      ? activeHubNotification.presenterGender === "male"
      : voiceGender === "male";

  const formatWaTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${mins}:${rem < 10 ? "0" : ""}${rem}`;
  };

  const barCount = 34;
  const signalBars: number[] = (() => {
    if (cockpitPhase === "recording") {
      return waWaveBars.length > 0 ? waWaveBars : Array(barCount).fill(22);
    }
    if (cockpitPhase === "processing") {
      return Array.from({ length: barCount }, (_, i) => {
        const s = Math.sin(waveTick * 0.42 + i * 0.45) * 0.5 + 0.5;
        const s2 = Math.cos(waveTick * 0.25 - i * 0.3) * 0.5 + 0.5;
        return Math.round(18 + (s * 0.65 + s2 * 0.35) * 80);
      });
    }
    if (cockpitPhase === "speaking") {
      return Array.from({ length: barCount }, (_, i) => {
        const centerFactor = 1 - Math.abs(i - barCount / 2) / (barCount / 2);
        const harmonic =
          Math.abs(Math.sin(waveTick * 0.55 + i * 0.52)) * 0.65 +
          Math.abs(Math.cos(waveTick * 0.31 - i * 0.28)) * 0.35;
        return Math.round(16 + (harmonic * 0.72 + centerFactor * 0.28 + audioLevel * 0.25) * 82);
      });
    }
    return [];
  })();

  return (
    <div
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        if (cockpitPhase === "galaxy") {
          soundEffects.playBeepConfirm();
          if (!wakeReady && onPrimeWakeMic) {
            onPrimeWakeMic();
          } else {
            onStartManualRecording?.();
          }
        }
      }}
      className="fixed inset-0 w-full h-screen overflow-hidden select-none cursor-pointer bg-[#020612]"
    >
      {/* ================================================================= */}
      {/* 2-SLOT DOUBLE-BUFFERED FULL-SCREEN LIVE VIDEO STREAM (MUTED)      */}
      {/* Zero 4-decoder GPU contention & instant seamless preloaded swaps! */}
      {/* ================================================================= */}
      <div className="absolute inset-0 w-full h-full">
        {([0, 1] as const).map((slotIdx) => {
          const isCurrent = slotIdx === activeSlot;
          const src = slotSrcs[slotIdx];
          return (
            <video
              key={slotIdx}
              ref={(el) => {
                slotRefs.current[slotIdx] = el;
              }}
              src={src}
              autoPlay={isCurrent}
              muted
              playsInline
              preload="auto"
              disablePictureInPicture
              onCanPlay={(e) => {
                if (!isCurrent && !e.currentTarget.paused) {
                  e.currentTarget.pause();
                } else if (isCurrent && !pausedByFullscreen && e.currentTarget.paused) {
                  e.currentTarget.play().catch(() => {});
                }
              }}
              onEnded={() => handleSlotEnded(slotIdx)}
              style={{
                transform: "translateZ(0)",
                backfaceVisibility: "hidden",
                willChange: "opacity, transform",
              }}
              className={`absolute inset-0 w-full h-full object-cover object-[50%_22%] transition-opacity duration-200 ease-out ${
                isCurrent ? "opacity-100 z-[2]" : "opacity-0 z-[1] pointer-events-none"
              }`}
            />
          );
        })}
      </div>

      {/* Subtle Bottom Edge Scrim only for active voice / incoming alert contrast */}
      <div
        className="pointer-events-none absolute inset-0 z-[3]"
        style={{
          background:
            "linear-gradient(to bottom, rgba(2,6,18,0.28) 0%, transparent 18%, transparent 74%, rgba(2,6,18,0.68) 100%)",
        }}
      />

      {/* ================================================================= */}
      {/* CLEAN CONDITIONAL OVERLAYS ONLY WHEN NOTIFICATION OR VOICE ACTIVE  */}
      {/* Zero persistent front panel blocking the main video stage!         */}
      {/* ================================================================= */}
      {(activeHubNotification || cockpitPhase !== "galaxy") && (
        <div className="q-hud-chrome fixed z-20 bottom-16 md:bottom-5 left-1/2 -translate-x-1/2 w-[min(460px,calc(100vw-24px))] flex flex-col items-center gap-2">
          {activeHubNotification && cockpitPhase === "galaxy" && (
            <div className="w-full px-3.5 py-2.5 rounded-2xl bg-[#050d1e]/92 border border-amber-400/50 shadow-2xl backdrop-blur-md flex items-start gap-2.5 animate-fadeIn">
              <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300 shrink-0 mt-0.5">
                <Bell className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1 text-left">
                <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-amber-300">
                  <span className="truncate font-bold uppercase">{activeHubNotification.source} ALERT</span>
                  <span className="text-slate-400 shrink-0">{activeHubNotification.timeStr}</span>
                </div>
                <div className="text-xs font-semibold text-slate-100 truncate">{activeHubNotification.title}</div>
                <div className="text-[11px] font-mono text-slate-300 line-clamp-2">{activeHubNotification.text}</div>
              </div>
            </div>
          )}

          {cockpitPhase !== "galaxy" && (
            <div className="w-full flex flex-col items-center gap-2 animate-fadeIn">
              <div
                className={`w-full flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-[#060f1f]/90 border shadow-2xl backdrop-blur-md ${
                  cockpitPhase === "recording"
                    ? "border-emerald-500/55 shadow-[0_0_28px_rgba(16,185,129,0.28)]"
                    : cockpitPhase === "processing"
                    ? "border-purple-500/55 shadow-[0_0_28px_rgba(168,85,247,0.28)]"
                    : "border-cyan-400/55 shadow-[0_0_28px_rgba(0,240,255,0.28)]"
                }`}
              >
                <div className="flex-1 flex items-center justify-center gap-[3px] h-7 overflow-hidden">
                  {signalBars.map((heightPct, idx) => (
                    <div
                      key={idx}
                      className="w-[3px] rounded-full transition-all duration-75 shrink-0"
                      style={{
                        height: `${Math.max(4, Math.round((heightPct / 100) * 24))}px`,
                        backgroundColor:
                          cockpitPhase === "recording"
                            ? heightPct > 36
                              ? "#25d366"
                              : "#64748b"
                            : cockpitPhase === "processing"
                            ? idx % 2 === 0
                              ? "#c084fc"
                              : "#f59e0b"
                            : isMaleActive
                            ? idx % 2 === 0
                              ? "#f59e0b"
                              : "#fbbf24"
                            : idx % 2 === 0
                            ? "#00f0ff"
                            : "#10b981",
                      }}
                    />
                  ))}
                </div>

                {cockpitPhase === "recording" && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-mono text-[11px] text-emerald-300 tabular-nums mr-1">
                      {formatWaTimer(recordingSeconds)}
                    </span>
                    <button
                      type="button"
                      onClick={onCancelRecording}
                      className="p-2 rounded-full bg-rose-950/90 hover:bg-rose-900 border border-rose-500/40 text-rose-300 transition cursor-pointer"
                      title="Cancel"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={onSendRecording}
                      className="p-2 rounded-full bg-[#00a884] hover:bg-[#06cf9c] text-slate-950 transition cursor-pointer"
                      title="Send"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {cockpitPhase === "recording" && liveTranscript && (
                <div className="text-[11px] font-mono text-emerald-200/95 bg-black/70 px-3 py-1 rounded-lg backdrop-blur-sm text-center max-w-sm">
                  &quot;{liveTranscript}&quot;
                </div>
              )}
              {cockpitPhase === "speaking" && liveReplyText && (
                <div className="px-3.5 py-2 rounded-xl bg-black/80 border border-white/15 backdrop-blur-md text-xs font-mono text-slate-100 text-center max-w-md leading-snug">
                  {liveReplyText}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
