import React, { useState } from "react";
import {
  Briefcase,
  Lightbulb,
  AlertCircle,
  TrendingUp,
  Plus,
  Trash2,
  Sparkles,
  CheckCircle2,
  Circle,
  Volume2,
} from "lucide-react";
import { soundEffects } from "../services/soundEffects";
import { speechService } from "../services/speechService";
import { resolveApiUrl } from "../services/systemTelemetry";
import { LanguageCode, VoiceGender } from "../types";

export interface BusinessVenture {
  id: string;
  name: string;
  category: string;
  monthlyRevenue: number;
  monthlyCost: number;
  status: "growing" | "needs_attention" | "planning";
  currentIssue?: string;
}

export interface BusinessActionTask {
  id: string;
  title: string;
  priority: "High" | "Medium";
  completed: boolean;
}

interface BusinessAdvisorHubProps {
  language: LanguageCode;
  voiceGender: VoiceGender;
}

export const BusinessAdvisorHub: React.FC<BusinessAdvisorHubProps> = ({
  language,
  voiceGender,
}) => {
  const [ventures, setVentures] = useState<BusinessVenture[]>(() => {
    try {
      const raw = localStorage.getItem("q_nexus_business_ventures");
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [actionChecklist, setActionChecklist] = useState<BusinessActionTask[]>(() => {
    try {
      const raw = localStorage.getItem("q_nexus_business_tasks");
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [showAddVenture, setShowAddVenture] = useState(false);
  const [vName, setVName] = useState("");
  const [vCategory, setVCategory] = useState("Digital Services / Agency");
  const [vRev, setVRev] = useState("");
  const [vCost, setVCost] = useState("");
  const [vIssue, setVIssue] = useState("");

  const [advisorMode, setAdvisorMode] = useState<"problem" | "idea">("problem");
  const [advisorQuery, setAdvisorQuery] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [advisorReply, setAdvisorReply] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");

  const saveVentures = (next: BusinessVenture[]) => {
    setVentures(next);
    try {
      localStorage.setItem("q_nexus_business_ventures", JSON.stringify(next));
    } catch {}
  };

  const saveTasks = (next: BusinessActionTask[]) => {
    setActionChecklist(next);
    try {
      localStorage.setItem("q_nexus_business_tasks", JSON.stringify(next));
    } catch {}
  };

  const handleAddVenture = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vName.trim()) return;
    soundEffects.playBeepConfirm();
    const item: BusinessVenture = {
      id: Date.now().toString(),
      name: vName.trim(),
      category: vCategory.trim(),
      monthlyRevenue: Math.max(0, Number(vRev) || 0),
      monthlyCost: Math.max(0, Number(vCost) || 0),
      status: vIssue.trim() ? "needs_attention" : "growing",
      currentIssue: vIssue.trim() || undefined,
    };
    saveVentures([item, ...ventures]);
    setVName("");
    setVRev("");
    setVCost("");
    setVIssue("");
    setShowAddVenture(false);
  };

  const handleAskAdvisor = async (e?: React.FormEvent, forcedQuery?: string, forcedMode?: "problem" | "idea") => {
    if (e) e.preventDefault();
    const q = (forcedQuery ?? advisorQuery).trim();
    const m = forcedMode ?? advisorMode;
    if (!q) return;

    soundEffects.playScan();
    setIsAnalyzing(true);
    try {
      const res = await fetch(resolveApiUrl("/api/jarvis/business-advise"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q,
          ventures,
          mode: m,
          language,
          characterGender: voiceGender === "male" ? "male" : "female",
        }),
      });
      const data = await res.json();
      const advice = data.advice || "Business action plan ready.";
      setAdvisorReply(advice);
      soundEffects.playBeepConfirm();
      speechService.speak(advice, {
        lang: language,
        gender: voiceGender,
        urduSpeechText: data.urduSpeechText,
      });
    } catch {
      setAdvisorReply("Business issue analysis tayar hai: pehle cashflow bottleneck fix karein aur client follow-up tez karein.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const totalRev = ventures.reduce((s, v) => s + v.monthlyRevenue, 0);
  const totalCost = ventures.reduce((s, v) => s + v.monthlyCost, 0);
  const netProfit = totalRev - totalCost;

  return (
    <div className="space-y-5 font-rajdhani">
      {/* Header Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-amber-500/35 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-400 flex items-center justify-center text-amber-300">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-orbitron font-bold text-base sm:text-lg text-slate-100 uppercase">
              BUSINESS COMMAND &amp; GROWTH ADVISOR
            </h2>
            <p className="text-xs font-mono text-slate-400">
              Manage ventures, diagnose problems, get tailored ideas &amp; control cashflow
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            soundEffects.playClick();
            setShowAddVenture((p) => !p);
          }}
          className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold font-mono text-xs flex items-center gap-1.5 cursor-pointer transition"
        >
          <Plus className="w-4 h-4" />
          <span>{showAddVenture ? "CANCEL" : "ADD BUSINESS / PROJECT"}</span>
        </button>
      </div>

      {/* Add Venture Form */}
      {showAddVenture && (
        <form onSubmit={handleAddVenture} className="p-4 rounded-2xl bg-slate-900/90 border border-amber-400/40 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <input
              type="text"
              value={vName}
              onChange={(e) => setVName(e.target.value)}
              placeholder="Business / Venture Name"
              required
              className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-100"
            />
            <input
              type="text"
              value={vCategory}
              onChange={(e) => setVCategory(e.target.value)}
              placeholder="Category (e.g. Editing Agency, E-Com)"
              className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-100"
            />
            <input
              type="number"
              value={vRev}
              onChange={(e) => setVRev(e.target.value)}
              placeholder="Monthly Revenue (PKR)"
              className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-emerald-300"
            />
            <input
              type="number"
              value={vCost}
              onChange={(e) => setVCost(e.target.value)}
              placeholder="Monthly Cost (PKR)"
              className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-rose-300"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={vIssue}
              onChange={(e) => setVIssue(e.target.value)}
              placeholder="Current Bottleneck / Problem (Optional)"
              className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-100"
            />
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold font-mono text-xs cursor-pointer"
            >
              SAVE VENTURE
            </button>
          </div>
        </form>
      )}

      {/* KPI Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/75 border border-emerald-500/30">
          <div className="text-[11px] font-mono text-slate-400">MONTHLY REVENUE</div>
          <div className="text-2xl font-orbitron font-bold text-emerald-300 mt-1">
            {totalRev.toLocaleString()} PKR
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900/75 border border-rose-500/30">
          <div className="text-[11px] font-mono text-slate-400">MONTHLY OPERATING COST</div>
          <div className="text-2xl font-orbitron font-bold text-rose-300 mt-1">
            {totalCost.toLocaleString()} PKR
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900/75 border border-cyan-500/30">
          <div className="text-[11px] font-mono text-slate-400">NET PROFIT MARGIN</div>
          <div className={`text-2xl font-orbitron font-bold mt-1 ${netProfit >= 0 ? "text-cyan-300" : "text-rose-400"}`}>
            {netProfit.toLocaleString()} PKR
          </div>
        </div>
      </div>

      {/* Main 2-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: Ventures + Execution Checklist */}
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
            <h3 className="font-orbitron font-bold text-sm text-amber-300 uppercase flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> MY BUSINESS VENTURES ({ventures.length})
            </h3>
            {ventures.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-950/70 border border-dashed border-slate-800 text-center text-xs font-mono text-slate-400">
                Abhi koi business project add nahi hua. Upar &quot;ADD BUSINESS&quot; par click karein taake profit, issues aur optimization track ho sakein.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {ventures.map((v) => {
                  const profit = v.monthlyRevenue - v.monthlyCost;
                  return (
                    <div key={v.id} className="p-3 rounded-xl bg-slate-950/85 border border-slate-800 space-y-1.5 text-xs font-mono">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <span className="font-bold text-slate-100">{v.name}</span>
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-amber-300 border border-amber-500/30">
                            {v.category}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => saveVentures(ventures.filter((x) => x.id !== v.id))}
                          className="text-slate-600 hover:text-rose-400 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>Rev: {v.monthlyRevenue.toLocaleString()} PKR</span>
                        <span>Cost: {v.monthlyCost.toLocaleString()} PKR</span>
                        <span className={profit >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                          Net: {profit.toLocaleString()} PKR
                        </span>
                      </div>
                      {v.currentIssue && (
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                          <span className="text-[11px] text-rose-300 flex items-center gap-1 truncate">
                            <AlertCircle className="w-3 h-3 shrink-0" /> {v.currentIssue}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setAdvisorMode("problem");
                              setAdvisorQuery(`Analyze & solve issue in ${v.name}: ${v.currentIssue}`);
                              handleAskAdvisor(undefined, `Analyze & solve issue in ${v.name}: ${v.currentIssue}`, "problem");
                            }}
                            className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 text-amber-200 text-[10px] shrink-0 cursor-pointer"
                          >
                            Fix with AI
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Action Checklist */}
          <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
            <h3 className="font-orbitron font-bold text-sm text-cyan-300 uppercase">OPERATIONS CHECKLIST</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newTaskTitle.trim()) return;
                saveTasks([
                  { id: Date.now().toString(), title: newTaskTitle.trim(), priority: "High", completed: false },
                  ...actionChecklist,
                ]);
                setNewTaskTitle("");
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Add business action item..."
                className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-100"
              />
              <button
                type="submit"
                className="px-3 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs cursor-pointer"
              >
                ADD
              </button>
            </form>
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {actionChecklist.map((t) => (
                <div
                  key={t.id}
                  className="p-2 rounded-lg bg-slate-950/70 border border-slate-800 flex items-center justify-between text-xs font-mono"
                >
                  <button
                    type="button"
                    onClick={() =>
                      saveTasks(
                        actionChecklist.map((x) => (x.id === t.id ? { ...x, completed: !x.completed } : x))
                      )
                    }
                    className="flex items-center gap-2 text-left cursor-pointer"
                  >
                    {t.completed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-cyan-400 shrink-0" />
                    )}
                    <span className={t.completed ? "line-through text-slate-500" : "text-slate-200"}>
                      {t.title}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => saveTasks(actionChecklist.filter((x) => x.id !== t.id))}
                    className="text-slate-600 hover:text-rose-400 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: AI Problem Solver & Business Ideas Advisor */}
        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between space-y-3">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-orbitron font-bold text-sm text-purple-300 uppercase flex items-center gap-2">
                <Lightbulb className="w-4 h-4" /> AI STRATEGIST &amp; IDEA ENGINE
              </h3>
              <div className="flex gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px] font-mono">
                <button
                  type="button"
                  onClick={() => setAdvisorMode("problem")}
                  className={`px-2.5 py-1 rounded cursor-pointer ${
                    advisorMode === "problem" ? "bg-amber-500 text-slate-950 font-bold" : "text-slate-400"
                  }`}
                >
                  Fix Problem
                </button>
                <button
                  type="button"
                  onClick={() => setAdvisorMode("idea")}
                  className={`px-2.5 py-1 rounded cursor-pointer ${
                    advisorMode === "idea" ? "bg-purple-500 text-slate-950 font-bold" : "text-slate-400"
                  }`}
                >
                  New Ideas
                </button>
              </div>
            </div>

            <form onSubmit={(e) => handleAskAdvisor(e)} className="space-y-2.5">
              <textarea
                rows={3}
                value={advisorQuery}
                onChange={(e) => setAdvisorQuery(e.target.value)}
                placeholder={
                  advisorMode === "idea"
                    ? "Apna budget aur skills likhein (e.g. Low investment tech or editing business ideas)..."
                    : "Kisi bhi business masle, sales drop ya management issue ke baare mein poochein..."
                }
                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl text-xs font-mono text-slate-100 outline-none"
                required
              />
              <button
                type="submit"
                disabled={isAnalyzing || !advisorQuery.trim()}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-purple-600 hover:from-amber-400 hover:to-purple-500 text-slate-950 font-bold font-mono text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isAnalyzing ? "ANALYZING STRATEGY..." : advisorMode === "idea" ? "GENERATE BUSINESS IDEAS" : "DIAGNOSE & SOLVE ISSUE"}</span>
              </button>
            </form>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 max-h-60 overflow-y-auto whitespace-pre-wrap leading-relaxed">
              {advisorReply || (
                <span className="text-slate-500 italic">
                  Apne business ka masla ya naya idea poochein — Wasu aur Wasi ki Jan aapko complete step-by-step hal aur growth guide dein ge.
                </span>
              )}
            </div>
          </div>

          {advisorReply && (
            <button
              type="button"
              onClick={() => speechService.speak(advisorReply, { lang: language, gender: voiceGender })}
              className="self-end px-3 py-1.5 rounded-lg bg-cyan-950 border border-cyan-500/40 text-cyan-200 text-xs font-mono flex items-center gap-1.5 cursor-pointer"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Listen Again</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
