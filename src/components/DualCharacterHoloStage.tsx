import React, { useEffect, useRef, useState } from "react";
import { Trash2, Bell } from "lucide-react";
import { LanguageCode, VoiceGender, WaveVisualizerStyleId } from "../types";
import { CockpitCorePhase } from "./CentralQuantumCoreHologram";
import { ColorfulWaveVisualizer } from "./ColorfulWaveVisualizer";
import {
  HUB_LIVE_VIDEOS,
  MOBILE_PORTRAIT_VIDEO,
  getCachedVideoSrc,
  getHubPlaylist,
  isPortraitViewport,
  startSequentialHubWarmup,
} from "../services/videoCache";

export { HUB_LIVE_VIDEOS };

const TRANSPARENT_VIDEO_POSTER =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

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
  waveVisualizerStyle?: WaveVisualizerStyleId;
  waveColorTheme?: string;
  onCancelRecording?: () => void;
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
  waveVisualizerStyle = "rainbow_prism",
  waveColorTheme = "aurora_cyan",
  onCancelRecording,
  onStartManualRecording,
  pausedByFullscreen = false,
  activeHubNotification = null,
}) => {
  const [isPortrait, setIsPortrait] = useState<boolean>(() => isPortraitViewport());
  const playlist = getHubPlaylist(isPortrait);

  const slotRefs = useRef<[HTMLVideoElement | null, HTMLVideoElement | null]>([null, null]);
  const [activeSlot, setActiveSlot] = useState<0 | 1>(0);
  const [, setActiveVideoIdx] = useState(0);
  const activeSlotRef = useRef<0 | 1>(0);
  const activeVideoIdxRef = useRef(0);
  const [slotRawUrls, setSlotRawUrls] = useState<[string, string]>(() => [
    playlist[0],
    playlist[1 % playlist.length],
  ]);
  const [slotSrcs, setSlotSrcs] = useState<[string, string]>(() => [
    getCachedVideoSrc(playlist[0]),
    getCachedVideoSrc(playlist[1 % playlist.length]),
  ]);
  const preloadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [waveTick, setWaveTick] = useState(0);
  const [slotFrameReady, setSlotFrameReady] = useState<[boolean, boolean]>([false, false]);
  const [standbyAutoPreload, setStandbyAutoPreload] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setStandbyAutoPreload(true), 1200);
    return () => clearTimeout(t);
  }, []);

  // Track viewport orientation/resize so mobile portrait uses full-screen 9:16 playlist & framing
  useEffect(() => {
    const syncOrientation = () => {
      const nextPortrait = isPortraitViewport();
      setIsPortrait((prev) => (prev === nextPortrait ? prev : nextPortrait));
    };
    window.addEventListener("resize", syncOrientation);
    window.addEventListener("orientationchange", syncOrientation);
    return () => {
      window.removeEventListener("resize", syncOrientation);
      window.removeEventListener("orientationchange", syncOrientation);
    };
  }, []);

  // Re-sync playlist cleanly when switching between mobile portrait and desktop landscape
  const prevPortraitRef = useRef(isPortrait);
  useEffect(() => {
    if (prevPortraitRef.current === isPortrait) return;
    prevPortraitRef.current = isPortrait;
    const nextList = getHubPlaylist(isPortrait);
    const firstRaw = nextList[0];
    const secondRaw = nextList[1 % nextList.length];
    activeSlotRef.current = 0;
    activeVideoIdxRef.current = 0;
    setActiveSlot(0);
    setActiveVideoIdx(0);
    setSlotRawUrls([firstRaw, secondRaw]);
    setSlotSrcs([getCachedVideoSrc(firstRaw), getCachedVideoSrc(secondRaw)]);
  }, [isPortrait]);

  // Smooth wave & speech cadence tick ONLY during active processing/speaking
  useEffect(() => {
    if (cockpitPhase !== "processing" && cockpitPhase !== "speaking") return;
    const id = setInterval(() => {
      setWaveTick((t) => (t + 1) % 10000);
    }, 65);
    return () => clearInterval(id);
  }, [cockpitPhase]);

  // Staggered sequential RAM Blob warmup for remaining clips (starts cleanly after 1.6s entry stagger)
  useEffect(() => {
    const cancelWarmup = startSequentialHubWarmup(1600);
    return () => {
      cancelWarmup();
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

    const currentList = getHubPlaylist(isPortrait);
    const nextVideoIdx = (activeVideoIdxRef.current + 1) % currentList.length;
    const nextSlot: 0 | 1 = slotIdx === 0 ? 1 : 0;
    const afterNextIdx = (nextVideoIdx + 1) % currentList.length;

    const nextVid = slotRefs.current[nextSlot];
    const switchToNext = () => {
      activeSlotRef.current = nextSlot;
      activeVideoIdxRef.current = nextVideoIdx;
      setActiveSlot(nextSlot);
      setActiveVideoIdx(nextVideoIdx);

      if (preloadTimeoutRef.current) clearTimeout(preloadTimeoutRef.current);
      preloadTimeoutRef.current = setTimeout(() => {
        const nextPreloadRaw = currentList[afterNextIdx];
        const nextPreloadUrl = getCachedVideoSrc(nextPreloadRaw);
        setSlotFrameReady((prev) => {
          const next: [boolean, boolean] = [prev[0], prev[1]];
          next[slotIdx] = false;
          return next;
        });
        setSlotRawUrls((prev) => {
          if (prev[slotIdx] === nextPreloadRaw) return prev;
          const next: [string, string] = [prev[0], prev[1]];
          next[slotIdx] = nextPreloadRaw;
          return next;
        });
        setSlotSrcs((prev) => {
          if (prev[slotIdx] === nextPreloadUrl) return prev;
          const next: [string, string] = [prev[0], prev[1]];
          next[slotIdx] = nextPreloadUrl;
          return next;
        });
      }, 320);
    };

    if (nextVid) {
      try {
        nextVid.muted = true;
        if (nextVid.readyState >= 1) nextVid.currentTime = 0;
        const p = nextVid.play();
        if (nextVid.readyState >= 2) {
          switchToNext();
        } else {
          if (p && typeof p.then === "function") {
            p.then(switchToNext).catch(switchToNext);
          } else {
            switchToNext();
          }
        }
        return;
      } catch {}
    }
    switchToNext();
  };

  const isMaleActive =
    activeHubNotification && cockpitPhase === "galaxy"
      ? activeHubNotification.presenterGender === "male"
      : voiceGender === "male";

  return (
    <div
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        if (cockpitPhase === "galaxy") {
          onStartManualRecording?.();
        }
      }}
      className="fixed inset-0 w-screen h-[100dvh] min-h-[100dvh] overflow-hidden select-none cursor-pointer bg-[#020612]"
    >
      {/* ================================================================= */}
      {/* 2-SLOT DOUBLE-BUFFERED FULL-SCREEN LIVE VIDEO STREAM (MUTED)      */}
      {/* Full edge-to-edge 100dvh mobile portrait + widescreen desktop     */}
      {/* ================================================================= */}
      <div className="absolute inset-0 w-full h-full">
        {([0, 1] as const).map((slotIdx) => {
          const isCurrent = slotIdx === activeSlot;
          const src = slotSrcs[slotIdx];
          const rawUrl = slotRawUrls[slotIdx];
          const shouldPanLandscapeOnMobile = isPortrait && rawUrl !== MOBILE_PORTRAIT_VIDEO;
          return (
            <video
              key={slotIdx}
              ref={(el) => {
                slotRefs.current[slotIdx] = el;
              }}
              src={src}
              poster={TRANSPARENT_VIDEO_POSTER}
              autoPlay={isCurrent}
              muted
              playsInline
              preload={isCurrent || standbyAutoPreload ? "auto" : "metadata"}
              disablePictureInPicture
              onLoadedData={() => {
                setSlotFrameReady((prev) => {
                  if (prev[slotIdx]) return prev;
                  const next: [boolean, boolean] = [prev[0], prev[1]];
                  next[slotIdx] = true;
                  return next;
                });
              }}
              onPlaying={() => {
                setSlotFrameReady((prev) => {
                  if (prev[slotIdx]) return prev;
                  const next: [boolean, boolean] = [prev[0], prev[1]];
                  next[slotIdx] = true;
                  return next;
                });
              }}
              onCanPlay={(e) => {
                setSlotFrameReady((prev) => {
                  if (prev[slotIdx]) return prev;
                  const next: [boolean, boolean] = [prev[0], prev[1]];
                  next[slotIdx] = true;
                  return next;
                });
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
              }}
              className={`absolute inset-0 w-full h-full min-w-full min-h-full max-w-none object-cover bg-[#020612] ${
                shouldPanLandscapeOnMobile ? "q-mobile-video-pan" : "object-[50%_20%]"
              } transition-opacity duration-200 ease-out ${
                isCurrent && slotFrameReady[slotIdx]
                  ? "opacity-100 z-[2]"
                  : isCurrent
                  ? "opacity-0 z-[2]"
                  : "opacity-0 z-[1] pointer-events-none"
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
        <div className="q-hud-chrome fixed z-20 bottom-[4.5rem] md:bottom-5 left-1/2 -translate-x-1/2 w-[min(460px,calc(100vw-24px))] flex flex-col items-center gap-2">
          {activeHubNotification && cockpitPhase === "galaxy" && (
            <div className="w-full px-3.5 py-2.5 rounded-2xl bg-[#050d1e]/95 border border-amber-400/50 shadow-2xl flex items-start gap-2.5 animate-fadeIn">
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
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-[#060f1f]/95 border shadow-2xl ${
                  cockpitPhase === "recording"
                    ? "border-emerald-500/55 shadow-[0_0_24px_rgba(16,185,129,0.25)]"
                    : cockpitPhase === "processing"
                    ? "border-purple-500/55 shadow-[0_0_24px_rgba(168,85,247,0.25)]"
                    : "border-cyan-400/55 shadow-[0_0_24px_rgba(0,240,255,0.25)]"
                }`}
              >
                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <div className="text-[11px] font-mono font-semibold text-cyan-200 truncate">
                    {cockpitPhase === "recording"
                      ? isMaleActive
                        ? "Sun raha hoon, bolein aap"
                        : "Sun rahi hoon, bolein aap"
                      : cockpitPhase === "processing"
                      ? "Samajh rahi hoon, foran execute ho raha hai..."
                      : isMaleActive
                      ? "Jawab de raha hoon..."
                      : "Jawab de rahi hoon..."}
                  </div>
                  <ColorfulWaveVisualizer
                    styleId={waveVisualizerStyle}
                    colorThemeId={waveColorTheme}
                    audioLevel={audioLevel}
                    phase={
                      cockpitPhase === "recording"
                        ? "listening"
                        : cockpitPhase === "processing"
                        ? "processing"
                        : "speaking"
                    }
                    height={32}
                  />
                </div>

                {cockpitPhase === "recording" && (
                  <button
                    type="button"
                    onClick={onCancelRecording}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-rose-950/90 hover:bg-rose-900 border border-rose-500/40 text-rose-300 transition cursor-pointer shrink-0"
                    title="Cancel Voice"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {cockpitPhase === "recording" && liveTranscript && (
                <div className="text-[11px] font-mono text-emerald-200/95 bg-black/85 px-3 py-1 rounded-lg text-center max-w-sm">
                  &quot;{liveTranscript}&quot;
                </div>
              )}
              {cockpitPhase === "speaking" && liveReplyText && (
                <div className="px-3.5 py-2 rounded-xl bg-black/90 border border-white/15 text-xs font-mono text-slate-100 text-center max-w-md leading-snug">
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
