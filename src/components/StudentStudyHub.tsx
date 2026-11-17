import React, { useEffect, useRef, useState } from "react";
import {
  GraduationCap,
  BookOpen,
  Sparkles,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  FileText,
  FlaskConical,
  Play,
  Pause,
  RotateCcw,
  Sliders,
  FolderOpen,
  Download,
} from "lucide-react";
import { soundEffects } from "../services/soundEffects";
import { speechService } from "../services/speechService";
import { resolveApiUrl } from "../services/systemTelemetry";
import { LanguageCode, VoiceGender } from "../types";

export interface StudyTask {
  id: string;
  subject: string;
  title: string;
  description?: string;
  dueDate: string;
  completed: boolean;
  autoPilotSolved?: boolean;
  solutionText?: string;
}

export type StudyDocType = "word" | "pptx" | "excel" | "pdf" | "book";

export interface StudyDocumentItem {
  id: string;
  docType: StudyDocType;
  title: string;
  subject: string;
  fileName: string;
  notes?: string;
  addedAt: string;
}

export interface StudyLabItem {
  id: string;
  labName: string;
  subject: string;
  apparatusOrStack: string;
  status: "Pending" | "In Progress" | "Completed";
  observations?: string;
}

interface SimulationSpec {
  title: string;
  preset: "wave" | "projectile" | "orbital" | "algorithm" | "growth";
  formula: string;
  paramALabel: string;
  paramBLabel: string;
  explanation: string;
}

interface StudentStudyHubProps {
  language: LanguageCode;
  voiceGender: VoiceGender;
}

export const StudentStudyHub: React.FC<StudentStudyHubProps> = ({
  language,
  voiceGender,
}) => {
  const [activeTab, setActiveTab] = useState<"vault" | "tasks_labs" | "research" | "simulation" | "settings">("vault");

  // Custom Study Preferences
  const [studyPrefs, setStudyPrefs] = useState<{ field: string; semester: string; style: string }>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("q_nexus_study_prefs") || "{}");
      return {
        field: saved.field || "Computer Science & AI",
        semester: saved.semester || "Current Term",
        style: saved.style || "Step-by-step practical + exam points",
      };
    } catch {
      return { field: "Computer Science & AI", semester: "Current Term", style: "Step-by-step practical + exam points" };
    }
  });

  const savePrefs = (next: typeof studyPrefs) => {
    setStudyPrefs(next);
    try {
      localStorage.setItem("q_nexus_study_prefs", JSON.stringify(next));
    } catch {}
  };

  // Tasks state
  const [tasks, setTasks] = useState<StudyTask[]>(() => {
    try {
      const stored = localStorage.getItem("q_nexus_study_tasks");
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  // Separate Word / PPTX / Excel / PDF / Books Vault
  const [docs, setDocs] = useState<StudyDocumentItem[]>(() => {
    try {
      const stored = localStorage.getItem("q_nexus_study_docs");
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [docFilter, setDocFilter] = useState<StudyDocType>("word");
  const [newDocTitle, setNewDocTitle] = useState("");
  const [newDocSubject, setNewDocSubject] = useState(studyPrefs.field);
  const [newDocNotes, setNewDocNotes] = useState("");

  // Labs Manager
  const [labs, setLabs] = useState<StudyLabItem[]>(() => {
    try {
      const stored = localStorage.getItem("q_nexus_study_labs");
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [labName, setLabName] = useState("");
  const [labSubject, setLabSubject] = useState(studyPrefs.field);
  const [labStack, setLabStack] = useState("");

  // AI Research & Solver State
  const [subjectInput, setSubjectInput] = useState(studyPrefs.field);
  const [questionInput, setQuestionInput] = useState("");
  const [isSolving, setIsSolving] = useState(false);
  const [solvedOutput, setSolvedOutput] = useState<string | null>(null);

  // Add Task Form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSubject, setNewSubject] = useState(studyPrefs.field);
  const [newDueDate, setNewDueDate] = useState("This Week");
  const [newDesc, setNewDesc] = useState("");

  // Interactive Simulation Builder State
  const [simTopic, setSimTopic] = useState("");
  const [simLoading, setSimLoading] = useState(false);
  const [simSpec, setSimSpec] = useState<SimulationSpec>({
    title: "Quantum Harmonic & Mechanical Wave Lab",
    preset: "wave",
    formula: "Ψ(x,t) = A·sin(k·x − ω·t)",
    paramALabel: "Frequency / Speed",
    paramBLabel: "Amplitude / Scale",
    explanation: "Enter any Physics, Math, Coding or Finance topic above to build an interactive simulation.",
  });
  const [simRunning, setSimRunning] = useState(true);
  const [paramA, setParamA] = useState(55);
  const [paramB, setParamB] = useState(60);
  const simCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const saveTasks = (next: StudyTask[]) => {
    setTasks(next);
    try {
      localStorage.setItem("q_nexus_study_tasks", JSON.stringify(next));
    } catch {}
  };

  const saveDocs = (next: StudyDocumentItem[]) => {
    setDocs(next);
    try {
      localStorage.setItem("q_nexus_study_docs", JSON.stringify(next));
    } catch {}
  };

  const saveLabs = (next: StudyLabItem[]) => {
    setLabs(next);
    try {
      localStorage.setItem("q_nexus_study_labs", JSON.stringify(next));
    } catch {}
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    let inferred: StudyDocType = docFilter;
    if (ext.includes("doc")) inferred = "word";
    else if (ext.includes("ppt")) inferred = "pptx";
    else if (ext.includes("xls") || ext.includes("csv")) inferred = "excel";
    else if (ext.includes("pdf")) inferred = "pdf";

    const item: StudyDocumentItem = {
      id: Date.now().toString(),
      docType: inferred,
      title: file.name.replace(/\.[^.]+$/, ""),
      subject: newDocSubject || studyPrefs.field,
      fileName: file.name,
      notes: `Uploaded ${(file.size / 1024).toFixed(1)} KB`,
      addedAt: new Date().toLocaleDateString(),
    };
    soundEffects.playBeepConfirm();
    saveDocs([item, ...docs]);
    setDocFilter(inferred);
    e.target.value = "";
  };

  const handleCreateStudyFile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocTitle.trim()) return;
    const extMap: Record<StudyDocType, string> = {
      word: "docx",
      pptx: "pptx",
      excel: "xlsx",
      pdf: "pdf",
      book: "pdf",
    };
    const item: StudyDocumentItem = {
      id: Date.now().toString(),
      docType: docFilter,
      title: newDocTitle.trim(),
      subject: newDocSubject.trim() || studyPrefs.field,
      fileName: `${newDocTitle.trim().replace(/\s+/g, "_")}.${extMap[docFilter]}`,
      notes: newDocNotes.trim() || `${docFilter.toUpperCase()} study record`,
      addedAt: new Date().toLocaleDateString(),
    };
    soundEffects.playBeepConfirm();
    saveDocs([item, ...docs]);
    setNewDocTitle("");
    setNewDocNotes("");
  };

  const handleDownloadStudyDraft = (doc: StudyDocumentItem) => {
    const content = `WASI'S JARVIS STUDY ARCHIVE\nTitle: ${doc.title}\nType: ${doc.docType.toUpperCase()}\nSubject: ${doc.subject}\nAdded: ${doc.addedAt}\n\nNotes:\n${doc.notes || ""}`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${doc.title.replace(/\s+/g, "_")}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    soundEffects.playBeepConfirm();
    const item: StudyTask = {
      id: Date.now().toString(),
      subject: newSubject,
      title: newTitle.trim(),
      description: newDesc.trim(),
      dueDate: newDueDate,
      completed: false,
    };
    saveTasks([item, ...tasks]);
    speechService.speak(`Naya study task save ho gaya hai: ${item.title}`, {
      lang: language,
      gender: voiceGender,
    });
    setNewTitle("");
    setNewDesc("");
    setShowAddForm(false);
  };

  const handleAddLab = (e: React.FormEvent) => {
    e.preventDefault();
    if (!labName.trim()) return;
    soundEffects.playBeepConfirm();
    saveLabs([
      {
        id: Date.now().toString(),
        labName: labName.trim(),
        subject: labSubject.trim() || studyPrefs.field,
        apparatusOrStack: labStack.trim() || "Standard Lab Setup",
        status: "Pending",
      },
      ...labs,
    ]);
    setLabName("");
    setLabStack("");
  };

  const handleSolveTask = async (taskToSolve?: StudyTask) => {
    const q = taskToSolve ? `${taskToSolve.title} ${taskToSolve.description || ""}` : questionInput.trim();
    const subj = taskToSolve ? taskToSolve.subject : subjectInput;
    if (!q) return;

    soundEffects.playScan();
    setIsSolving(true);
    setSolvedOutput(null);
    setActiveTab("research");

    try {
      const res = await fetch(resolveApiUrl("/api/jarvis/study-solve"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: `${subj} (Field: ${studyPrefs.field}, Style: ${studyPrefs.style})`,
          question: q,
          language,
          isAutoPilot: true,
        }),
      });
      const data = await res.json();
      setSolvedOutput(data.solution);
      soundEffects.playBeepConfirm();
      speechService.speak(`${subj} ka research aur solution tayar ho gaya hai.`, {
        lang: language,
        gender: voiceGender,
      });

      if (taskToSolve) {
        saveTasks(
          tasks.map((t) =>
            t.id === taskToSolve.id ? { ...t, autoPilotSolved: true, solutionText: data.solution } : t
          )
        );
      }
    } catch {
      setSolvedOutput(`Subject: ${subj}\nTopic: ${q}\nCore Concept Breakdown & Step-by-Step Solution generated.`);
    } finally {
      setIsSolving(false);
    }
  };

  const handleBuildSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simTopic.trim()) return;
    soundEffects.playScan();
    setSimLoading(true);
    try {
      const res = await fetch(resolveApiUrl("/api/jarvis/study-simulation"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: simTopic.trim(),
          subject: studyPrefs.field,
          language,
        }),
      });
      const data = await res.json();
      setSimSpec({
        title: data.title || `${simTopic} Simulation`,
        preset: data.preset || "wave",
        formula: data.formula || "f(x,t)",
        paramALabel: data.paramALabel || "Speed / Rate",
        paramBLabel: data.paramBLabel || "Scale / Force",
        explanation: data.explanation || "Interactive simulation ready.",
      });
      setSimRunning(true);
      soundEffects.playBeepConfirm();
      speechService.speak(data.explanation || `${simTopic} ki simulation tayar hai.`, {
        lang: language,
        gender: voiceGender,
        urduSpeechText: data.urduSpeechText,
      });
    } finally {
      setSimLoading(false);
    }
  };

  // Interactive HTML5 Canvas Simulation Renderer
  useEffect(() => {
    if (activeTab !== "simulation") return;
    const canvas = simCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId = 0;
    let t = 0;
    let bars = [65, 28, 84, 42, 95, 18, 52, 74, 36, 88];
    let sortI = 0;
    let frameTick = 0;

    const renderSim = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#030816";
      ctx.fillRect(0, 0, w, h);

      // Grid
      ctx.strokeStyle = "rgba(0, 240, 255, 0.08)";
      ctx.lineWidth = 1;
      for (let gx = 0; gx < w; gx += 32) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, h);
        ctx.stroke();
      }
      for (let gy = 0; gy < h; gy += 32) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(w, gy);
        ctx.stroke();
      }

      const rate = 0.02 + (paramA / 100) * 0.08;
      const amp = 0.25 + (paramB / 100) * 0.75;
      if (simRunning) {
        t += rate;
        frameTick++;
      }

      if (simSpec.preset === "orbital") {
        const cx = w * 0.5;
        const cy = h * 0.5;
        const rOrbit = 45 + (paramA / 100) * (Math.min(w, h) * 0.34);
        ctx.fillStyle = "#f59e0b";
        ctx.beginPath();
        ctx.arc(cx, cy, 18, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "rgba(0, 240, 255, 0.3)";
        ctx.beginPath();
        ctx.ellipse(cx, cy, rOrbit, rOrbit * (0.55 + amp * 0.35), 0, 0, Math.PI * 2);
        ctx.stroke();

        const px = cx + Math.cos(t * 2.2) * rOrbit;
        const py = cy + Math.sin(t * 2.2) * rOrbit * (0.55 + amp * 0.35);
        ctx.fillStyle = "#00f0ff";
        ctx.beginPath();
        ctx.arc(px, py, 9, 0, Math.PI * 2);
        ctx.fill();
      } else if (simSpec.preset === "projectile") {
        const angleRad = ((15 + (paramA / 100) * 65) * Math.PI) / 180;
        const g = 0.3 + (paramB / 100) * 0.9;
        const v0 = 10.5;
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 2;
        ctx.beginPath();
        const originX = 36;
        const originY = h - 28;
        for (let step = 0; step <= 60; step++) {
          const ts = step * 0.45;
          const x = originX + v0 * Math.cos(angleRad) * ts * 1.4;
          const y = originY - (v0 * Math.sin(angleRad) * ts - 0.5 * g * ts * ts) * 1.4;
          if (y > originY) break;
          if (step === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        const cycle = (t * 8) % 24;
        const bx = originX + v0 * Math.cos(angleRad) * cycle * 1.4;
        const by = Math.min(originY, originY - (v0 * Math.sin(angleRad) * cycle - 0.5 * g * cycle * cycle) * 1.4);
        ctx.fillStyle = "#f59e0b";
        ctx.beginPath();
        ctx.arc(bx, by, 8, 0, Math.PI * 2);
        ctx.fill();
      } else if (simSpec.preset === "algorithm") {
        const count = Math.max(5, Math.min(12, Math.round(5 + (paramB / 100) * 7)));
        const activeBars = bars.slice(0, count);
        if (simRunning && frameTick % Math.max(6, Math.round(28 - (paramA / 100) * 22)) === 0) {
          if (sortI < count - 1) {
            if (activeBars[sortI] > activeBars[sortI + 1]) {
              const tmp = activeBars[sortI];
              activeBars[sortI] = activeBars[sortI + 1];
              activeBars[sortI + 1] = tmp;
              bars = [...activeBars, ...bars.slice(count)];
            }
            sortI++;
          } else {
            sortI = 0;
            const isSorted = activeBars.every((v, idx, arr) => idx === 0 || arr[idx - 1] <= v);
            if (isSorted) {
              bars = Array.from({ length: 12 }, () => 18 + Math.round(Math.random() * 78));
            }
          }
        }
        const bw = (w - 48) / count - 6;
        activeBars.forEach((val, idx) => {
          const bh = (val / 100) * (h - 56);
          const bx = 24 + idx * (bw + 6);
          const by = h - 22 - bh;
          ctx.fillStyle = idx === sortI || idx === sortI + 1 ? "#f59e0b" : "#00f0ff";
          ctx.fillRect(bx, by, bw, bh);
        });
      } else if (simSpec.preset === "growth") {
        ctx.strokeStyle = "#10b981";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let x = 20; x < w - 20; x += 4) {
          const nx = (x - 20) / (w - 40);
          const yVal = Math.pow(nx, 0.7 + amp) * (h - 60);
          const y = h - 24 - yVal * (0.75 + 0.25 * Math.sin(t * 2 + nx * 4));
          if (x === 20) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      } else {
        // Wave / Quantum harmonic default
        ctx.strokeStyle = "#00f0ff";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let x = 0; x < w; x += 3) {
          const nx = x / w;
          const y = h * 0.5 + Math.sin(nx * (6 + paramA * 0.12) - t * 3.5) * (h * 0.28 * amp);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        ctx.strokeStyle = "rgba(139, 92, 246, 0.65)";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        for (let x = 0; x < w; x += 3) {
          const nx = x / w;
          const y = h * 0.5 + Math.cos(nx * (8 + paramA * 0.08) + t * 2.8) * (h * 0.22 * amp);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      rafId = requestAnimationFrame(renderSim);
    };

    rafId = requestAnimationFrame(renderSim);
    return () => cancelAnimationFrame(rafId);
  }, [activeTab, simSpec, simRunning, paramA, paramB]);

  const filteredDocs = docs.filter((d) => d.docType === docFilter);

  return (
    <div className="space-y-5 font-rajdhani">
      {/* Header */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-cyan-500/30 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-cyan-300">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-orbitron font-bold text-base sm:text-lg text-slate-100 uppercase">
              STUDY HUB — FILES, LABS, RESEARCH &amp; SIMULATIONS
            </h2>
            <p className="text-xs font-mono text-slate-400">
              Field: <span className="text-cyan-300">{studyPrefs.field}</span> · Word / PPTX / Excel / PDF / Labs / AI Copilot
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-2 text-xs font-orbitron">
        {[
          { id: "vault", label: `FILES (WORD/PPTX/XLS/PDF)`, icon: FolderOpen },
          { id: "tasks_labs", label: `TASKS & LABS (${tasks.length + labs.length})`, icon: FlaskConical },
          { id: "research", label: `AI RESEARCH`, icon: Sparkles },
          { id: "simulation", label: `TOPIC SIMULATION`, icon: Play },
          { id: "settings", label: `CUSTOMIZE`, icon: Sliders },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                soundEffects.playClick();
                setActiveTab(tab.id as any);
              }}
              className={`px-3 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer transition ${
                active
                  ? "bg-cyan-500 text-slate-950 font-bold"
                  : "bg-slate-900 text-slate-300 border border-slate-800 hover:border-cyan-500/40"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: WORD / PPTX / EXCEL / PDF / BOOKS VAULT */}
      {activeTab === "vault" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5 text-xs font-mono">
              {(
                [
                  { id: "word", label: "Word (.docx)" },
                  { id: "pptx", label: "PowerPoint (.pptx)" },
                  { id: "excel", label: "Excel (.xlsx)" },
                  { id: "pdf", label: "PDF (.pdf)" },
                  { id: "book", label: "Books & Notes" },
                ] as { id: StudyDocType; label: string }[]
              ).map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setDocFilter(cat.id)}
                  className={`px-3 py-1.5 rounded-lg border cursor-pointer ${
                    docFilter === cat.id
                      ? "bg-purple-500/25 border-purple-400 text-purple-200 font-bold"
                      : "bg-slate-900 border-slate-800 text-slate-400"
                  }`}
                >
                  {cat.label} ({docs.filter((d) => d.docType === cat.id).length})
                </button>
              ))}
            </div>

            <label className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold font-mono text-xs cursor-pointer">
              + Upload Real File
              <input
                type="file"
                accept=".doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.pdf,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          <form onSubmit={handleCreateStudyFile} className="p-3.5 rounded-2xl bg-slate-900/75 border border-slate-800 grid grid-cols-1 sm:grid-cols-4 gap-2">
            <input
              type="text"
              value={newDocTitle}
              onChange={(e) => setNewDocTitle(e.target.value)}
              placeholder={`Add ${docFilter.toUpperCase()} document title...`}
              required
              className="sm:col-span-2 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-100"
            />
            <input
              type="text"
              value={newDocNotes}
              onChange={(e) => setNewDocNotes(e.target.value)}
              placeholder="Summary / Chapter notes..."
              className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-100"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-mono text-xs cursor-pointer"
            >
              SAVE {docFilter.toUpperCase()}
            </button>
          </form>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {filteredDocs.length === 0 ? (
              <div className="p-5 rounded-xl bg-slate-950/70 border border-dashed border-slate-800 text-center text-xs font-mono text-slate-400">
                Abhi is folder ({docFilter.toUpperCase()}) mein koi file nahi hai. Upar upload karein ya new entry add karein.
              </div>
            ) : (
              filteredDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="p-3 rounded-xl bg-slate-950/85 border border-slate-800 flex items-center justify-between gap-3 text-xs font-mono"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span className="font-bold text-slate-100 truncate">{doc.fileName}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                      {doc.subject} · {doc.notes}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleDownloadStudyDraft(doc)}
                      title="Export Notes"
                      className="p-1.5 rounded-lg bg-slate-900 text-cyan-300 hover:bg-cyan-500 hover:text-slate-950 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => saveDocs(docs.filter((d) => d.id !== doc.id))}
                      className="p-1.5 rounded-lg text-slate-600 hover:text-rose-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 2: TASKS & LABS MANAGER */}
      {activeTab === "tasks_labs" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Homework & Exams */}
          <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-orbitron font-bold text-sm text-cyan-300 uppercase flex items-center gap-2">
                <BookOpen className="w-4 h-4" /> ASSIGNMENTS &amp; EXAMS
              </h3>
              <button
                type="button"
                onClick={() => setShowAddForm(!showAddForm)}
                className="px-3 py-1 rounded-lg bg-cyan-500 text-slate-950 font-bold font-mono text-xs cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Task
              </button>
            </div>

            {showAddForm && (
              <form onSubmit={handleAddTask} className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Assignment / Chapter Topic"
                  required
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-slate-100"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    placeholder="Subject"
                    className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-slate-100"
                  />
                  <input
                    type="text"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    placeholder="Due Date"
                    className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-slate-100"
                  />
                </div>
                <button type="submit" className="px-4 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-bold text-xs cursor-pointer">
                  Save Task
                </button>
              </form>
            )}

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="p-3 rounded-xl bg-slate-950/85 border border-slate-800 flex items-center justify-between gap-2 text-xs font-mono"
                >
                  <button
                    type="button"
                    onClick={() =>
                      saveTasks(tasks.map((t) => (t.id === task.id ? { ...t, completed: !t.completed } : t)))
                    }
                    className="flex items-start gap-2 text-left cursor-pointer min-w-0"
                  >
                    {task.completed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <div className={task.completed ? "line-through text-slate-500" : "text-slate-100 font-semibold"}>
                        {task.title}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {task.subject} · Due {task.dueDate}
                      </div>
                    </div>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleSolveTask(task)}
                      title="Solve with AI Research Agent"
                      className="p-1.5 rounded-lg bg-purple-950 text-purple-300 hover:bg-purple-500 hover:text-slate-950 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => saveTasks(tasks.filter((t) => t.id !== task.id))}
                      className="p-1.5 text-slate-600 hover:text-rose-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Labs Manager */}
          <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
            <h3 className="font-orbitron font-bold text-sm text-emerald-300 uppercase flex items-center gap-2">
              <FlaskConical className="w-4 h-4" /> FIELD LABS MANAGER ({labs.length})
            </h3>
            <form onSubmit={handleAddLab} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                value={labName}
                onChange={(e) => setLabName(e.target.value)}
                placeholder="Lab # & Title"
                required
                className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-100"
              />
              <input
                type="text"
                value={labStack}
                onChange={(e) => setLabStack(e.target.value)}
                placeholder="Tools / Apparatus"
                className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-100"
              />
              <button type="submit" className="px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-bold text-xs cursor-pointer">
                ADD LAB
              </button>
            </form>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {labs.map((lab) => (
                <div
                  key={lab.id}
                  className="p-3 rounded-xl bg-slate-950/85 border border-slate-800 flex items-center justify-between gap-2 text-xs font-mono"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-slate-100 truncate">{lab.labName}</div>
                    <div className="text-[10px] text-slate-400">
                      {lab.subject} · {lab.apparatusOrStack}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const order: StudyLabItem["status"][] = ["Pending", "In Progress", "Completed"];
                        const nextStatus = order[(order.indexOf(lab.status) + 1) % order.length];
                        saveLabs(labs.map((l) => (l.id === lab.id ? { ...l, status: nextStatus } : l)));
                      }}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                        lab.status === "Completed"
                          ? "bg-emerald-950 text-emerald-300 border border-emerald-500/40"
                          : "bg-amber-950 text-amber-300 border border-amber-500/40"
                      }`}
                    >
                      {lab.status}
                    </button>
                    <button
                      type="button"
                      onClick={() => saveLabs(labs.filter((l) => l.id !== lab.id))}
                      className="p-1 text-slate-600 hover:text-rose-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: AI RESEARCH & AUTONOMOUS SOLVER */}
      {activeTab === "research" && (
        <div className="p-4 rounded-2xl bg-slate-900/75 border border-purple-500/30 space-y-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSolveTask();
            }}
            className="grid grid-cols-1 sm:grid-cols-4 gap-2.5"
          >
            <input
              type="text"
              value={subjectInput}
              onChange={(e) => setSubjectInput(e.target.value)}
              placeholder="Subject / Field"
              className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono text-slate-100"
            />
            <input
              type="text"
              value={questionInput}
              onChange={(e) => setQuestionInput(e.target.value)}
              placeholder="Ask AI Agent to research, write assignment or solve any topic..."
              required
              className="sm:col-span-2 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono text-slate-100"
            />
            <button
              type="submit"
              disabled={isSolving || !questionInput.trim()}
              className="py-2 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 text-white font-bold font-mono text-xs cursor-pointer disabled:opacity-50"
            >
              {isSolving ? "RESEARCHING..." : "AUTO-COMPLETE"}
            </button>
          </form>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 max-h-64 overflow-y-auto whitespace-pre-wrap leading-relaxed">
            {solvedOutput || (
              <span className="text-slate-500 italic">
                Apni assignment, research topic ya coding/math sawal likhein — AI Research Copilot poora kaam mukammal kar ke notes tayar karega.
              </span>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: INTERACTIVE TOPIC SIMULATION BUILDER */}
      {activeTab === "simulation" && (
        <div className="space-y-4">
          <form onSubmit={handleBuildSimulation} className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={simTopic}
              onChange={(e) => setSimTopic(e.target.value)}
              placeholder="Topic for live simulation (e.g. Projectile Motion, Orbital Gravity, Bubble Sort, Sine Wave)..."
              required
              className="flex-1 px-3 py-2.5 bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded-xl text-xs font-mono text-slate-100 outline-none"
            />
            <button
              type="submit"
              disabled={simLoading || !simTopic.trim()}
              className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-mono text-xs cursor-pointer disabled:opacity-50"
            >
              {simLoading ? "BUILDING..." : "GENERATE SIMULATION"}
            </button>
          </form>

          <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_0.65fr] gap-4">
            <div className="rounded-2xl bg-slate-950 border border-cyan-500/35 p-3 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="font-bold text-cyan-300 truncate">{simSpec.title}</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSimRunning((p) => !p)}
                    className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-cyan-300 cursor-pointer"
                  >
                    {simRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setParamA(55);
                      setParamB(60);
                    }}
                    className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <canvas
                ref={simCanvasRef}
                width={560}
                height={240}
                className="w-full h-56 rounded-xl border border-slate-800 bg-[#030816]"
              />
              <div className="text-[11px] font-mono text-amber-300 text-center">{simSpec.formula}</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/75 border border-slate-800 space-y-3 text-xs font-mono">
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>{simSpec.paramALabel}</span>
                  <span className="text-cyan-300">{paramA}%</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={100}
                  value={paramA}
                  onChange={(e) => setParamA(Number(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>{simSpec.paramBLabel}</span>
                  <span className="text-purple-300">{paramB}%</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={100}
                  value={paramB}
                  onChange={(e) => setParamB(Number(e.target.value))}
                  className="w-full accent-purple-400 cursor-pointer"
                />
              </div>
              <div className="pt-2 border-t border-slate-800 text-slate-300 leading-relaxed max-h-32 overflow-y-auto">
                {simSpec.explanation}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: CUSTOMIZE FIELD & STUDY PREFERENCES */}
      {activeTab === "settings" && (
        <div className="p-4 rounded-2xl bg-slate-900/75 border border-slate-800 space-y-3 text-xs font-mono max-w-xl">
          <div>
            <label className="block text-slate-400 mb-1">Your Study Field / Major</label>
            <input
              type="text"
              value={studyPrefs.field}
              onChange={(e) => savePrefs({ ...studyPrefs, field: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100"
            />
          </div>
          <div>
            <label className="block text-slate-400 mb-1">Current Semester / Grade</label>
            <input
              type="text"
              value={studyPrefs.semester}
              onChange={(e) => savePrefs({ ...studyPrefs, semester: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100"
            />
          </div>
          <div>
            <label className="block text-slate-400 mb-1">AI Tutor Note &amp; Research Style</label>
            <input
              type="text"
              value={studyPrefs.style}
              onChange={(e) => savePrefs({ ...studyPrefs, style: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100"
            />
          </div>
        </div>
      )}
    </div>
  );
};
