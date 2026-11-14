import React, { useEffect, useState, useRef } from "react";
import { soundEffects } from "../services/soundEffects";

interface QuantumLoadingScreenProps {
  isOpen: boolean;
  onComplete: () => void;
  commanderName?: string;
}

const CORE_SUBSYSTEMS = [
  {
    name: "01. Hamiltonian Eigen-Solver",
    detail: "Operator Hermiticity & energy spectrum bounds",
    phaseLabel: "Calibrating Hamiltonian",
  },
  {
    name: "02. Relativistic Dirac Spinor Bus",
    detail: "Clifford gamma matrix synchronization",
    phaseLabel: "Aligning Dirac Spinors",
  },
  {
    name: "03. Cryogenic Qubit Coherence Grid",
    detail: "Decoherence suppression & entanglement lock",
    phaseLabel: "Cooling Qubit Lattice",
  },
  {
    name: "04. Wormhole Singularity Lens",
    detail: "4D stereographic projection matrix",
    phaseLabel: "Focusing Singularity",
  },
  {
    name: "05. WebGL2 Spatial Shader Pipeline",
    detail: "PBR environment & equation sprite depth buffer",
    phaseLabel: "Compiling Spatial Shaders",
  },
  {
    name: "06. Jarvis Pakistani Urdu Neural Vault",
    detail: "Hi-Jarvis Wake Engine, Pakistani Urdu Neural Voice & Acoustic Lock",
    phaseLabel: "Quantum Core Ready",
  },
];

export const QuantumLoadingScreen: React.FC<QuantumLoadingScreenProps> = ({
  isOpen,
  onComplete,
  commanderName = "Wasi",
}) => {
  const [progress, setProgress] = useState(0);
  const [viewportStr, setViewportStr] = useState("1920×1080");
  const lastVerifiedRef = useRef(-1);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      completedRef.current = false;
      setIsCompleted(false);
      return;
    }

    setProgress(0);
    setIsCompleted(false);
    lastVerifiedRef.current = -1;
    completedRef.current = false;
    setViewportStr(`${window.innerWidth}×${window.innerHeight}`);
    soundEffects.playQuantumStartup();

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) return 100;
        return Math.min(100, prev + 2.4);
      });
    }, 45);

    return () => clearInterval(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    CORE_SUBSYSTEMS.forEach((_, idx) => {
      const threshold = ((idx + 1) / CORE_SUBSYSTEMS.length) * 95;
      if (progress >= threshold && idx > lastVerifiedRef.current) {
        lastVerifiedRef.current = idx;
        soundEffects.playDiagnosticTick(idx);
      }
    });

    if (progress >= 100 && !isCompleted) {
      setIsCompleted(true);
    }
  }, [isOpen, progress, isCompleted]);

  useEffect(() => {
    if (!isOpen || !isCompleted) return;
    if (completedRef.current) return;
    completedRef.current = true;
    soundEffects.playSuccessChime();
    const t = setTimeout(() => {
      onCompleteRef.current();
    }, 320);
    return () => clearTimeout(t);
  }, [isOpen, isCompleted]);

  if (!isOpen) return null;

  const roundedPct = Math.round(progress);
  const activeStep = Math.min(CORE_SUBSYSTEMS.length - 1, Math.floor((progress / 100) * CORE_SUBSYSTEMS.length));
  const strokeDashoffset = (628.32 * (1 - progress / 100)).toFixed(2);

  const theta = (progress / 100) * Math.PI * 0.5;
  const alpha = Math.cos(theta * 0.5).toFixed(4);
  const beta = Math.sin(theta * 0.5).toFixed(4);
  const phi = ((progress * 0.0628) % (Math.PI * 2)).toFixed(3);
  const fidelity = (0.991 + (progress / 100) * 0.0088).toFixed(4);
  const cpuCores = typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 8 : 8;

  return (
    <div
      id="diagnostics"
      className="fixed inset-0 z-[100] bg-[#04070f]/95 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-8 overflow-y-auto select-none font-rajdhani"
    >
      <div className="fixed inset-0 quantum-grid opacity-30 pointer-events-none" />

      {/* Stage 2 Top Bar */}
      <header className="relative z-10 w-full max-w-[1220px] flex flex-wrap items-center justify-between gap-4 pb-4 mb-6 border-b border-slate-400/20">
        <div className="flex items-center gap-3">
          <div className="font-orbitron font-extrabold text-lg sm:text-xl tracking-[0.22em] text-slate-100 whitespace-nowrap">
            Q-<span className="text-[#00f0ff]">DYNAMICS</span>
          </div>
          <span className="text-xs font-mono text-slate-400 tabular">
            · Stage 2 / 3 · System Diagnostics &amp; Boot Check · {commanderName}
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            if (completedRef.current) return;
            completedRef.current = true;
            soundEffects.playKeyClick(920);
            onComplete();
          }}
          className="px-4 py-2 rounded-lg bg-slate-900/80 border border-slate-400/25 hover:border-[#00f0ff] text-xs font-semibold text-slate-100 cursor-pointer transition"
        >
          Enter Core
        </button>
      </header>

      {/* 2-Column Stage 2 Diagnostics Layout */}
      <div className="relative z-10 w-full max-w-[1220px] grid grid-cols-1 lg:grid-cols-[0.92fr_1.08fr] gap-6 lg:gap-10 items-center">
        {/* Left Card: Circular SVG Progress Ring + Live |Ψ⟩ State Vector */}
        <div className="rounded-2xl bg-[#080e1c]/90 border border-slate-400/20 p-6 sm:p-8 flex flex-col items-center gap-6 shadow-2xl">
          <div className="relative w-[220px] h-[220px] sm:w-[270px] sm:h-[270px] flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 220 220" aria-hidden="true">
              <defs>
                <linearGradient id="qDiagGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00f0ff" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
              <circle cx="110" cy="110" r="100" fill="none" stroke="rgba(148,163,184,0.14)" strokeWidth="8" />
              <circle
                cx="110"
                cy="110"
                r="82"
                fill="none"
                stroke="rgba(139,92,246,0.35)"
                strokeWidth="2"
                strokeDasharray="6 8"
              />
              <circle
                cx="110"
                cy="110"
                r="100"
                fill="none"
                stroke="url(#qDiagGrad)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray="628.32"
                strokeDashoffset={strokeDashoffset}
                style={{
                  transition: "stroke-dashoffset 0.1s linear",
                  filter: "drop-shadow(0 0 12px rgba(0, 240, 255, 0.35))",
                }}
              />
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <div className="font-orbitron font-extrabold text-4xl sm:text-5xl text-slate-100 tabular leading-none">
                {roundedPct}%
              </div>
              <div className="mt-2 font-mono text-[11px] tracking-[0.14em] uppercase text-[#00f0ff]">
                {CORE_SUBSYSTEMS[activeStep]?.phaseLabel || "Initializing Manifold"}
              </div>
            </div>
          </div>

          <div className="w-full border-t border-slate-400/15 pt-4 flex flex-col gap-2">
            <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-slate-500">
              Live Quantum State Vector |Ψ⟩
            </div>
            <div className="font-mono text-xs sm:text-sm text-[#00f0ff] tabular break-words">
              |Ψ⟩ = ({alpha})|0⟩ + ({beta}e^&#123;i{phi}&#125;)|1⟩
            </div>
            <div className="grid grid-cols-3 gap-3 pt-2 tabular">
              <div className="flex flex-col gap-0.5">
                <span className="font-mono text-[10px] text-slate-500">CPU Cores</span>
                <span className="font-mono text-xs sm:text-sm font-semibold text-slate-100">{cpuCores} Threads</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-mono text-[10px] text-slate-500">Viewport</span>
                <span className="font-mono text-xs sm:text-sm font-semibold text-slate-100">{viewportStr}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-mono text-[10px] text-slate-500">Fidelity</span>
                <span className="font-mono text-xs sm:text-sm font-semibold text-slate-100">{fidelity}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Card: 6 Core Subsystems Sequential Checks */}
        <div className="rounded-2xl bg-[#080e1c]/90 border border-slate-400/20 p-6 sm:p-8 flex flex-col gap-4 shadow-2xl">
          <h2 className="font-orbitron font-bold text-lg tracking-[0.08em] text-slate-100">
            Core Subsystem Calibration
          </h2>

          <div className="flex flex-col divide-y divide-slate-400/10">
            {CORE_SUBSYSTEMS.map((sub, idx) => {
              const threshold = ((idx + 1) / CORE_SUBSYSTEMS.length) * 95;
              const isVerified = progress >= threshold;
              const isChecking = !isVerified && idx === activeStep;
              return (
                <div
                  key={sub.name}
                  className={`py-3.5 px-1 flex items-center justify-between gap-4 transition-opacity duration-200 ${
                    isVerified || isChecking ? "opacity-100" : "opacity-40"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-100 truncate">{sub.name}</div>
                    <div className="font-mono text-xs text-slate-400 mt-0.5 truncate">{sub.detail}</div>
                  </div>
                  <div
                    className={`font-mono text-xs font-bold whitespace-nowrap shrink-0 tabular ${
                      isVerified
                        ? "text-emerald-400"
                        : isChecking
                        ? "text-[#00f0ff]"
                        : "text-slate-500"
                    }`}
                  >
                    {isVerified ? "[VERIFIED // OK]" : isChecking ? "CALIBRATING..." : "PENDING"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
