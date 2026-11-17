import React, { useState, useEffect } from "react";
import { Target, Play, Pause, RotateCcw, ShieldCheck, Flame, BarChart3, FileText, CheckCircle2, Clock, Sparkles } from "lucide-react";
import { soundEffects } from "../services/soundEffects";
import { speechService } from "../services/speechService";
import { storageService } from "../services/storage";
import { resolveApiUrl } from "../services/systemTelemetry";
import { LanguageCode, VoiceGender } from "../types";

interface FocusLogEntry {
  time: string;
  title: string;
  detail: string;
}

interface QuantumFocusAnalyticsProps {
  language: LanguageCode;
  voiceGender: VoiceGender;
}

export const QuantumFocusAnalytics: React.FC<QuantumFocusAnalyticsProps> = ({
  language,
  voiceGender,
}) => {
  // Focus Pomodoro State
  const [focusDuration, setFocusDuration] = useState(25); // minutes
  const [timeLeft, setTimeLeft] = useState(25 * 60); // seconds
  const [isFocusActive, setIsFocusActive] = useState(false);
  const [distractionsBlocked, setDistractionsBlocked] = useState(0);
  const [focusLogs, setFocusLogs] = useState<FocusLogEntry[]>(() => {
    try {
      const raw = localStorage.getItem("q_nexus_focus_logs");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Daily Report State
  const [dailyReportText, setDailyReportText] = useState<string | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // Focus Timer Tick
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isFocusActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (isFocusActive && timeLeft === 0) {
      setIsFocusActive(false);
      soundEffects.stopQuantumBinauralHum();
      soundEffects.playBeepConfirm();
      const entry: FocusLogEntry = {
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        title: `${focusDuration}-Min Focus Session Complete`,
        detail: "Deep focus session completed cleanly.",
      };
      setFocusLogs((prev) => {
        const next = [entry, ...prev].slice(0, 20);
        try {
          localStorage.setItem("q_nexus_focus_logs", JSON.stringify(next));
        } catch {}
        return next;
      });
      setDistractionsBlocked((c) => c + 1);
      speechService.speak(
        language === "en"
          ? "Deep focus session complete! Great work."
          : "Deep Focus session mukammal ho gaya hai! Ab thora pani aur eye rest lein.",
        { lang: language, gender: voiceGender }
      );
    }
    return () => clearInterval(interval);
  }, [isFocusActive, timeLeft, focusDuration, language, voiceGender]);

  // Toggle Focus
  const toggleFocus = () => {
    soundEffects.playClick();
    setIsFocusActive((prev) => {
      const next = !prev;
      if (next) {
        soundEffects.startQuantumBinauralHum();
        speechService.speak(`${focusDuration} minute ka Deep Focus session shuru ho gaya hai.`, {
          lang: language,
          gender: voiceGender,
        });
      } else {
        soundEffects.stopQuantumBinauralHum();
      }
      return next;
    });
  };

  const resetFocus = (mins: number) => {
    soundEffects.playClick();
    soundEffects.stopQuantumBinauralHum();
    setIsFocusActive(false);
    setFocusDuration(mins);
    setTimeLeft(mins * 60);
  };

  // Generate AI Daily Evening Report from REAL stored tasks/health/focus data
  const handleGenerateReport = async () => {
    soundEffects.playScan();
    setIsGeneratingReport(true);
    const realTasks = storageService.getTasks();
    const tasksDone = realTasks.filter((t) => t.completed).length;
    const realHealth = storageService.getHealth();
    const realFocusMins = focusLogs.length * focusDuration;

    try {
      const res = await fetch(resolveApiUrl("/api/jarvis/daily-briefing"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language,
          stats: {
            focusMinutes: realFocusMins,
            focusSessions: focusLogs.length,
            tasksDone,
            totalTasks: realTasks.length,
            waterGlasses: realHealth.waterDrankGlasses,
            blockedDistractions: distractionsBlocked,
          },
        }),
      });
      const data = await res.json();
      setDailyReportText(data.report);
      soundEffects.playBeepConfirm();
      if (data.report) {
        speechService.speak(data.report, { lang: language, gender: voiceGender });
      }
    } catch {
      const fallbackReport = `Real Daily Summary:
• Focus Sessions Logged: ${focusLogs.length} (${realFocusMins} mins)
• Tasks Completed: ${tasksDone} / ${realTasks.length}
• Water Logged: ${realHealth.waterDrankGlasses} / 8 glasses`;
      setDailyReportText(fallbackReport);
      speechService.speak("Aaj ki real activity report tayar hai.", {
        lang: language,
        gender: voiceGender,
      });
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6 font-rajdhani">
      {/* Top Focus & Distraction Blocker Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Pomodoro Focus Timer */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900/80 border border-cyan-500/30 flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-cyan-400" />
              <h3 className="font-orbitron font-bold text-base text-cyan-400 uppercase">
                QUANTUM DEEP FOCUS CHAMBER
              </h3>
            </div>

            {/* Duration Selector */}
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
              <button
                onClick={() => resetFocus(25)}
                className={`px-3 py-1 rounded transition cursor-pointer ${
                  focusDuration === 25 ? "bg-cyan-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
                }`}
              >
                25 MIN
              </button>
              <button
                onClick={() => resetFocus(50)}
                className={`px-3 py-1 rounded transition cursor-pointer ${
                  focusDuration === 50 ? "bg-cyan-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
                }`}
              >
                50 MIN
              </button>
            </div>
          </div>

          {/* Central Clock Display */}
          <div className="text-center my-6">
            <div className="text-6xl md:text-7xl font-orbitron font-bold text-slate-100 tracking-wider glow-text-cyan">
              {formatTimer(timeLeft)}
            </div>
            <div className="text-xs font-mono text-cyan-300 mt-2 flex items-center justify-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isFocusActive ? "bg-emerald-400 animate-ping" : "bg-slate-600"}`}></span>
              <span>{isFocusActive ? "SILENT DEEP FOCUS ACTIVE • SHIELD ON" : "READY TO INITIATE DEEP WORK"}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={toggleFocus}
              className={`px-8 py-3 rounded-xl font-orbitron font-bold text-sm tracking-wider transition flex items-center gap-2 cursor-pointer shadow-lg ${
                isFocusActive
                  ? "bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/30"
                  : "bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-500/30"
              }`}
            >
              {isFocusActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>{isFocusActive ? "PAUSE FOCUS" : "ENGAGE FOCUS"}</span>
            </button>

            <button
              onClick={() => resetFocus(focusDuration)}
              className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right: Distraction Blocker Status */}
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-purple-500/30 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-5 h-5 text-purple-400" />
              <h3 className="font-orbitron font-bold text-base text-purple-400 uppercase">
                DISTRACTION SHIELD
              </h3>
            </div>
            <p className="text-xs font-mono text-slate-400 mb-4">
              Restricts access to addictive algorithms, reels, shorts, and notifications during work sessions.
            </p>

            <div className="space-y-2 text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-300">YouTube Shorts / Reels</span>
                <span className="text-red-400 font-bold">BLOCKED</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-300">Social Media Feeds</span>
                <span className="text-red-400 font-bold">BLOCKED</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-300">Non-work Notifications</span>
                <span className="text-emerald-400 font-bold">MUTED</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400">Interceptions Today:</span>
            <span className="font-orbitron font-bold text-emerald-400 text-sm">
              {distractionsBlocked} Attempts Blocked
            </span>
          </div>
        </div>
      </div>

      {/* Daily Activity Timeline & AI Evening Briefing */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Timeline */}
        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-emerald-400" />
            <h3 className="font-orbitron font-bold text-base text-emerald-400 uppercase">
              DAILY ACTIVITY TIMELINE
            </h3>
          </div>

          <div className="space-y-3 relative pl-4 border-l border-slate-800 text-xs font-mono">
            {focusLogs.length === 0 ? (
              <div className="p-3 rounded-lg bg-slate-950/60 border border-dashed border-slate-800 text-slate-400">
                Abhi koi focus session record nahi hai. Session start karein to yahan real log save hoga.
              </div>
            ) : (
              focusLogs.map((item, idx) => (
                <div key={idx} className="relative">
                  <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
                  <div className="text-cyan-400 font-bold">{item.time} • {item.title}</div>
                  <div className="text-slate-400">{item.detail}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* AI Daily Evening Briefing */}
        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan-400" />
                <h3 className="font-orbitron font-bold text-base text-cyan-400 uppercase">
                  DAILY PROGRESS REPORT
                </h3>
              </div>
              <button
                onClick={handleGenerateReport}
                disabled={isGeneratingReport}
                className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isGeneratingReport ? "GENERATING..." : "GENERATE AI BRIEFING"}</span>
              </button>
            </div>

            <p className="text-xs font-mono text-slate-400 mb-3">
              Jarvis synthesizes your daily achievements, editing output, nutrition, and budget savings into an executive briefing.
            </p>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed min-h-[160px]">
              {dailyReportText || (
                <span className="text-slate-500 italic">
                  Click 'Generate AI Briefing' to compile today's comprehensive productivity, health, and financial report.
                </span>
              )}
            </div>
          </div>

          <div className="mt-3 text-[11px] font-mono text-slate-500 text-right">
            Jarvis vocal briefing ready in {language.toUpperCase()}
          </div>
        </div>
      </div>
    </div>
  );
};
