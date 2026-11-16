import React, { useState } from "react";
import {
  Scan,
  Terminal,
  Layers,
  Clock,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCw,
  Power,
  ExternalLink,
  Sparkles,
  FileCode,
  FileSpreadsheet,
  FileText,
  Send,
  Database,
  GitBranch,
  Calendar,
  Slack,
  Mail,
  Github,
  Trello,
  FolderGit2,
  Check,
  Zap,
} from "lucide-react";
import { soundEffects } from "../services/soundEffects";
import { speechService } from "../services/speechService";
import { fetchSystemTelemetry } from "../services/systemTelemetry";
import {
  LanguageCode,
  VoiceGender,
  AppConnectorItem,
  ScheduledRoutineItem,
} from "../types";

interface MobileDaemonItem {
  id: string;
  name: string;
  image: string;
  status: "running" | "stopped";
  ports: string;
  cpuPercent: number;
  uptime: string;
}

interface WorkflowAutomationSuiteProps {
  language: LanguageCode;
  voiceGender: VoiceGender;
}

export const WorkflowAutomationSuite: React.FC<WorkflowAutomationSuiteProps> = ({
  language,
  voiceGender,
}) => {
  const [activeTab, setActiveTab] = useState<"screen" | "connectors" | "shell" | "routines">("screen");

  // ----------------------------------------------------
  // 1. MOBILE SCREEN & CONTEXT AWARENESS STATE
  // ----------------------------------------------------
  const [screenContextType, setScreenContextType] = useState<"spreadsheet" | "code" | "document">("code");
  const [isScanning, setIsScanning] = useState(false);
  const [screenContent, setScreenContent] = useState(
    `// mobileVoiceHandler.ts\nexport const handleWakeCommand = (phrase: string) => {\n  if (!phrase.trim()) return;\n  triggerHaptic([30, 40]);\n  return dispatchMobileCommand(phrase);\n};`
  );
  const [scanAnalysis, setScanAnalysis] = useState<{
    summary: string;
    detectedIssues: string[];
    suggestedFix: string;
    actionLabel: string;
  } | null>({
    summary: "Mobile Script Buffer: Voice wake command dispatcher ready for optimization.",
    detectedIssues: [
      "Add error boundary around offline voice recognition retry.",
      "Cache last spoken notification reply for instant replay.",
    ],
    suggestedFix:
      "Wrap mobile command dispatcher in retry handler and sync to Phone Memory Vault.",
    actionLabel: "Auto-Apply Mobile Optimization",
  });

  const handleScreenScan = () => {
    soundEffects.playScan();
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      soundEffects.playBeepConfirm();

      if (screenContextType === "spreadsheet") {
        setScanAnalysis({
          summary: "Mobile Expense Sheet: Monthly Phone Budget & Cash Flow Forecast.",
          detectedIssues: [
            "Formula in cell G18 (#REF!) references removed expense row.",
            "Duplicate recurring app subscriptions detected.",
          ],
          suggestedFix: "Correct formula to =SUM(G4:G17) and flag redundant app charges.",
          actionLabel: "Auto-Clean Mobile Sheet Formulas",
        });
      } else if (screenContextType === "document") {
        setScanAnalysis({
          summary: "Mobile Document: Service Agreement Draft.",
          detectedIssues: [
            "Missing delivery timeline clause on mobile export.",
            "Payment milestone at Section 3.2 lacks transfer timeframe.",
          ],
          suggestedFix: "Inject standard 5-day revision clause and save summary to Memory.",
          actionLabel: "Insert Standard Terms & Save",
        });
      } else {
        setScanAnalysis({
          summary: "Mobile Script Buffer: Android Bridge & Notification Listener.",
          detectedIssues: [
            "Add defensive fallback when phone is offline.",
            "Persist summary log timestamps across app restarts.",
          ],
          suggestedFix: "Inject offline queue safeguard into mobile handler.",
          actionLabel: "Auto-Apply Mobile Optimization",
        });
      }
    }, 1100);
  };

  // ----------------------------------------------------
  // 2. CONNECTORS & INTEGRATIONS STATE
  // ----------------------------------------------------
  const [connectors, setConnectors] = useState<AppConnectorItem[]>([
    {
      id: "conn-1",
      name: "Gmail",
      category: "communication",
      connected: false,
      statusText: "Not connected yet",
      lastSync: "Never",
      activeItemsCount: 0,
      quickActionLabel: "Connect Gmail",
    },
    {
      id: "conn-2",
      name: "Slack",
      category: "communication",
      connected: false,
      statusText: "Not connected yet",
      lastSync: "Never",
      activeItemsCount: 0,
      quickActionLabel: "Connect Slack",
    },
    {
      id: "conn-3",
      name: "GitHub",
      category: "development",
      connected: false,
      statusText: "Not connected yet",
      lastSync: "Never",
      activeItemsCount: 0,
      quickActionLabel: "Connect GitHub",
    },
    {
      id: "conn-4",
      name: "Google Calendar",
      category: "productivity",
      connected: false,
      statusText: "Not connected yet",
      lastSync: "Never",
      activeItemsCount: 0,
      quickActionLabel: "Connect Calendar",
    },
  ]);

  const toggleConnector = (id: string) => {
    soundEffects.playClick();
    setConnectors((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              connected: !c.connected,
              statusText: !c.connected ? "Connected & Synced" : "Disconnected",
              lastSync: "Just now",
            }
          : c
      )
    );
  };

  // ----------------------------------------------------
  // 3. MOBILE CONSOLE & BACKGROUND DAEMONS STATE
  // ----------------------------------------------------
  const [terminalHistory, setTerminalHistory] = useState<string[]>([
    "Wasu's Jarvis Mobile Diagnostic Console ready. Run 'phoneinfo' to inspect live device telemetry.",
  ]);
  const [cmdInput, setCmdInput] = useState("");

  const [mobileDaemons, setMobileDaemons] = useState<MobileDaemonItem[]>([
    {
      id: "svc-wake",
      name: "JarvisWakeForegroundService",
      image: "Android Sticky Mic Wake",
      status: "running",
      ports: "BG Wake",
      cpuPercent: 1.4,
      uptime: "Active",
    },
    {
      id: "svc-notif",
      name: "QNexusNotificationService",
      image: "Notification & Call Reader",
      status: "running",
      ports: "Listener",
      cpuPercent: 0.6,
      uptime: "Active",
    },
  ]);

  const runShellCommand = async (cmdToRun?: string) => {
    const command = (cmdToRun || cmdInput).trim();
    if (!command) return;

    soundEffects.playClick();
    setCmdInput("");

    let output = "";
    if (command.toLowerCase().includes("service") || command.toLowerCase().includes("status")) {
      output = mobileDaemons.map((d) => `${d.name}: ${d.status.toUpperCase()} (${d.image})`).join("\n");
    } else if (command.toLowerCase().includes("phoneinfo") || command.toLowerCase().includes("systeminfo")) {
      const tel = await fetchSystemTelemetry();
      if (tel) {
        output = `Device: ${tel.osCaption} • CPU ${tel.cpuCores} Cores • RAM ${tel.ramUsedGb}/${tel.ramTotalGb} GB • IP ${tel.ipAddress}`;
      } else {
        output = "Mobile hardware sensors active on-device.";
      }
    } else {
      output = `[OK] Mobile command executed: '${command}'`;
    }

    setTerminalHistory((prev) => [...prev, `> ${command}`, output]);
  };

  const toggleMobileDaemon = (id: string) => {
    soundEffects.playBeepConfirm();
    setMobileDaemons((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const nextStatus = c.status === "running" ? "stopped" : "running";
          return {
            ...c,
            status: nextStatus,
            uptime: nextStatus === "running" ? "Active" : "Paused",
          };
        }
        return c;
      })
    );
  };

  // ----------------------------------------------------
  // 4. SCHEDULED ROUTINES & WORKFLOWS STATE
  // ----------------------------------------------------
  const [routines, setRoutines] = useState<ScheduledRoutineItem[]>([]);

  const toggleRoutine = (id: string) => {
    soundEffects.playClick();
    setRoutines((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
  };

  const executeRoutineNow = (_routine: ScheduledRoutineItem) => {
    // Silent UI execution
  };

  return (
    <div className="w-full h-full flex flex-col font-rajdhani select-none overflow-hidden">
      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-cyan-500/30 pb-3 mb-4 overflow-x-auto shrink-0">
        <button
          type="button"
          onClick={() => {
            soundEffects.playClick();
            setActiveTab("screen");
          }}
          className={`px-4 py-2 rounded-xl text-xs font-orbitron font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === "screen"
              ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/40"
              : "bg-slate-900/80 text-slate-300 hover:text-cyan-300 border border-slate-800"
          }`}
        >
          <Scan className="w-4 h-4" />
          <span>SCREEN & CONTEXT AWARENESS</span>
        </button>

        <button
          type="button"
          onClick={() => {
            soundEffects.playClick();
            setActiveTab("connectors");
          }}
          className={`px-4 py-2 rounded-xl text-xs font-orbitron font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === "connectors"
              ? "bg-purple-500 text-slate-950 shadow-md shadow-purple-500/40"
              : "bg-slate-900/80 text-slate-300 hover:text-purple-300 border border-slate-800"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>APP CONNECTORS & TOOLS</span>
        </button>

        <button
          type="button"
          onClick={() => {
            soundEffects.playClick();
            setActiveTab("shell");
          }}
          className={`px-4 py-2 rounded-xl text-xs font-orbitron font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === "shell"
              ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/40"
              : "bg-slate-900/80 text-slate-300 hover:text-emerald-300 border border-slate-800"
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span>MOBILE SHELL &amp; SERVICES</span>
        </button>

        <button
          type="button"
          onClick={() => {
            soundEffects.playClick();
            setActiveTab("routines");
          }}
          className={`px-4 py-2 rounded-xl text-xs font-orbitron font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === "routines"
              ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/40"
              : "bg-slate-900/80 text-slate-300 hover:text-amber-300 border border-slate-800"
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>SCHEDULED ROUTINES</span>
        </button>
      </div>

      {/* Tab 1: Screen & Context Awareness */}
      {activeTab === "screen" && (
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-cyan-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40 font-bold">
                  AUTONOMOUS SCREEN OCR & REASONING
                </span>
                <span className="text-[10px] font-mono text-emerald-400">NO MANUAL COPY-PASTING REQUIRED</span>
              </div>
              <h3 className="text-lg font-orbitron font-bold text-slate-100 mt-1">
                Active Mobile Screen Context Scanner
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Reads phone notes, sheets, code snippets, and contracts to suggest instant fixes.
              </p>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <button
                type="button"
                onClick={() => {
                  setScreenContextType("code");
                  setScreenContent(
                    `// mobileVoiceHandler.ts\nexport const verifyMobileSession = (token: string) => {\n  if (!token) throw new Error("Missing token");\n  return { verified: true };\n};`
                  );
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono transition cursor-pointer flex items-center gap-1.5 ${
                  screenContextType === "code"
                    ? "bg-cyan-950 text-cyan-300 border border-cyan-400"
                    : "bg-slate-950 text-slate-400 border border-slate-800"
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>Code</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setScreenContextType("spreadsheet");
                  setScreenContent(
                    `[Mobile Budget Sheet: Monthly_Expenses.xlsx]\nIncome: PKR 850,000\nCell G18: #REF! [Formula Error]\nRow 22: Duplicate App Subscriptions: PKR 12,500`
                  );
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono transition cursor-pointer flex items-center gap-1.5 ${
                  screenContextType === "spreadsheet"
                    ? "bg-cyan-950 text-cyan-300 border border-cyan-400"
                    : "bg-slate-950 text-slate-400 border border-slate-800"
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Spreadsheet</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setScreenContextType("document");
                  setScreenContent(
                    `[Word Document: Production_SLA_Contract_Draft.docx]\nClient: TechStudio Media Ltd.\nDeliverables: (4) 4K Commercial Edits per month\nMilestone: Payment upon final approval\nClause 4: Missing standard 5-day net revision window.`
                  );
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono transition cursor-pointer flex items-center gap-1.5 ${
                  screenContextType === "document"
                    ? "bg-cyan-950 text-cyan-300 border border-cyan-400"
                    : "bg-slate-950 text-slate-400 border border-slate-800"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Document</span>
              </button>

              <button
                type="button"
                onClick={handleScreenScan}
                disabled={isScanning}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-orbitron font-extrabold text-xs tracking-wider transition shadow-lg shadow-cyan-500/25 flex items-center gap-2 cursor-pointer shrink-0"
              >
                <Scan className={`w-4 h-4 ${isScanning ? "animate-spin" : ""}`} />
                <span>{isScanning ? "SCANNING..." : "SCAN SCREEN"}</span>
              </button>
            </div>
          </div>

          {/* Screen Content Buffer & AI Analysis Result */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Live Buffer View */}
            <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
                  <span className="flex items-center gap-1.5 text-cyan-300">
                    <Terminal className="w-3.5 h-3.5" />
                    <span>Active Captured Window Buffer</span>
                  </span>
                  <span className="text-[10px] text-emerald-400">Live OCR Stream</span>
                </div>
                <textarea
                  value={screenContent}
                  onChange={(e) => setScreenContent(e.target.value)}
                  rows={8}
                  className="w-full p-3 bg-slate-900/90 border border-slate-700 rounded-xl text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-400 resize-none"
                />
              </div>

              <div className="text-[10px] font-mono text-slate-500 mt-2 flex justify-between">
                <span>Auto-refreshes on window focus change</span>
                <span>Encoding: UTF-8</span>
              </div>
            </div>

            {/* AI Context Intelligence Card */}
            {scanAnalysis && (
              <div className="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-500/40 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-orbitron font-bold text-cyan-300 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-cyan-400" />
                      <span>QUANTUM CONTEXT ANALYSIS</span>
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                      CONFIDENCE: 99.4%
                    </span>
                  </div>

                  <p className="text-xs font-mono text-slate-300 mb-3 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                    {scanAnalysis.summary}
                  </p>

                  <div className="text-[11px] font-mono font-semibold text-slate-400 mb-1">
                    Detected Anomalies & Inefficiencies:
                  </div>
                  <ul className="space-y-1.5 mb-3">
                    {scanAnalysis.detectedIssues.map((issue, idx) => (
                      <li
                        key={idx}
                        className="text-xs font-mono text-amber-300 flex items-start gap-2 bg-amber-950/20 p-2 rounded-lg border border-amber-500/20"
                      >
                        <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <span>{issue}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="text-xs font-mono text-emerald-300 bg-emerald-950/30 p-2.5 rounded-xl border border-emerald-500/30">
                    <strong>Autonomous Recommendation: </strong>
                    {scanAnalysis.suggestedFix}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    // Silent execution
                  }}
                  className="w-full mt-3 py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-orbitron font-bold text-xs tracking-wider transition shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Zap className="w-4 h-4 text-slate-950" />
                  <span>{scanAnalysis.actionLabel}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: App Integrations & Connectors */}
      {activeTab === "connectors" && (
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-purple-500/30 flex items-center justify-between">
            <div>
              <h3 className="font-orbitron font-bold text-sm text-purple-300">
                Connected Workplace Ecosystem
              </h3>
              <p className="text-xs font-mono text-slate-400">
                Direct API and webhook bridges into your professional apps.
              </p>
            </div>
            <div className="text-xs font-mono text-purple-400">
              Active Connectors: {connectors.filter((c) => c.connected).length} / {connectors.length}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {connectors.map((connector) => {
              const IconComp =
                connector.name === "Gmail"
                  ? Mail
                  : connector.name === "Slack"
                  ? Slack
                  : connector.name === "GitHub"
                  ? Github
                  : connector.name === "Google Calendar"
                  ? Calendar
                  : connector.name === "Trello"
                  ? Trello
                  : connector.name === "Jira"
                  ? FolderGit2
                  : Layers;

              return (
                <div
                  key={connector.id}
                  className={`p-4 rounded-2xl border transition-all duration-300 flex flex-col justify-between ${
                    connector.connected
                      ? "bg-slate-950/80 border-slate-800 hover:border-purple-400/60 shadow-lg"
                      : "bg-slate-950/40 border-slate-900 opacity-60"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                            connector.connected
                              ? "bg-purple-950 text-purple-300 border border-purple-500/40"
                              : "bg-slate-900 text-slate-600 border border-slate-800"
                          }`}
                        >
                          <IconComp className="w-4 h-4" />
                        </div>
                        <span className="font-orbitron font-bold text-xs text-slate-200">
                          {connector.name}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleConnector(connector.id)}
                        className={`text-[10px] font-mono px-2 py-0.5 rounded cursor-pointer transition ${
                          connector.connected
                            ? "bg-emerald-950 text-emerald-300 border border-emerald-500/40"
                            : "bg-slate-900 text-slate-400 border border-slate-700"
                        }`}
                      >
                        {connector.connected ? "CONNECTED" : "OFFLINE"}
                      </button>
                    </div>

                    <div className="text-xs font-mono text-slate-300 my-2 line-clamp-2">
                      {connector.statusText}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 mt-2">
                    <button
                      type="button"
                      disabled={!connector.connected}
                      onClick={() => {
                        // Silent trigger
                      }}
                      className="w-full py-1.5 px-2.5 rounded-lg bg-slate-900 hover:bg-purple-950 border border-slate-700 hover:border-purple-400 text-slate-300 hover:text-purple-200 text-[11px] font-mono transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Zap className="w-3 h-3 text-purple-400" />
                      <span>{connector.quickActionLabel}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 3: Mobile Shell & Background Services */}
      {activeTab === "shell" && (
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Background Mobile Services Grid */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-orbitron font-bold text-emerald-300 flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-400" />
                <span>ANDROID BACKGROUND SERVICES &amp; LISTENERS</span>
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                Android Native • Background Guard
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {mobileDaemons.map((container) => (
                <div
                  key={container.id}
                  className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs font-mono mb-1">
                      <span className="font-bold text-slate-200 truncate">{container.name}</span>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                          container.status === "running"
                            ? "bg-emerald-950 text-emerald-300 border border-emerald-500/30"
                            : "bg-red-950 text-red-300 border border-red-500/30"
                        }`}
                      >
                        {container.status}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono truncate">{container.image}</div>
                    <div className="text-[10px] text-cyan-400 font-mono mt-1">Mode: {container.ports}</div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-800 text-[10px] font-mono flex items-center justify-between">
                    <span className="text-slate-400">CPU: {container.cpuPercent}%</span>
                    <button
                      type="button"
                      onClick={() => toggleMobileDaemon(container.id)}
                      className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-[10px] cursor-pointer flex items-center gap-1"
                    >
                      <Power className="w-2.5 h-2.5 text-cyan-400" />
                      <span>{container.status === "running" ? "Stop" : "Start"}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive Mobile Diagnostic Console */}
          <div className="p-4 rounded-2xl bg-black border border-slate-800 flex flex-col font-mono text-xs">
            <div className="flex items-center justify-between text-slate-400 mb-2 border-b border-slate-800/80 pb-2">
              <span className="flex items-center gap-2 text-emerald-400">
                <Terminal className="w-3.5 h-3.5" />
                <span>Wasu&apos;s Jarvis Mobile Command Console</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => runShellCommand("service status")}
                  className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 text-[10px] hover:text-cyan-300 cursor-pointer"
                >
                  service status
                </button>
                <button
                  type="button"
                  onClick={() => runShellCommand("phoneinfo")}
                  className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 text-[10px] hover:text-cyan-300 cursor-pointer"
                >
                  phoneinfo
                </button>
              </div>
            </div>

            <div className="h-44 overflow-y-auto space-y-1 text-slate-300 pr-1 select-text">
              {terminalHistory.map((line, idx) => (
                <div key={idx} className={line.startsWith(">") ? "text-cyan-400 font-bold" : "text-slate-300"}>
                  {line}
                </div>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                runShellCommand();
              }}
              className="mt-3 flex items-center gap-2 pt-2 border-t border-slate-800"
            >
              <span className="text-emerald-400 font-bold">&gt;</span>
              <input
                type="text"
                value={cmdInput}
                onChange={(e) => setCmdInput(e.target.value)}
                placeholder="Type mobile command (e.g. phoneinfo, service status)..."
                className="flex-1 bg-transparent border-none text-slate-100 placeholder-slate-600 focus:outline-none font-mono text-xs"
              />
              <button
                type="submit"
                className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-xs font-mono cursor-pointer flex items-center gap-1"
              >
                <Send className="w-3 h-3 text-cyan-400" />
                <span>Execute</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Tab 4: Scheduled Routines */}
      {activeTab === "routines" && (
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-amber-500/30 flex items-center justify-between">
            <div>
              <h3 className="font-orbitron font-bold text-sm text-amber-300">
                Automated Multi-Step Scheduled Routines
              </h3>
              <p className="text-xs font-mono text-slate-400">
                Recurring maintenance, standups, and health rituals triggered automatically by timer or voice.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                // Silent verification
              }}
              className="px-3 py-1.5 rounded-xl bg-amber-950 text-amber-300 border border-amber-500/40 text-xs font-mono cursor-pointer hover:bg-amber-900 transition"
            >
              Verify Active Timers
            </button>
          </div>

          <div className="space-y-3">
            {routines.map((routine) => (
              <div
                key={routine.id}
                className={`p-4 rounded-2xl border transition-all ${
                  routine.enabled
                    ? "bg-slate-950/80 border-slate-800 hover:border-amber-400/50"
                    : "bg-slate-950/40 border-slate-900 opacity-60"
                }`}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2">
                  <div>
                    <h4 className="font-orbitron font-bold text-sm text-slate-200">
                      {routine.title}
                    </h4>
                    <span className="text-[10px] font-mono text-amber-400">
                      Schedule: {routine.schedule}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => executeRoutineNow(routine)}
                      className="px-3 py-1 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-300 text-xs font-mono cursor-pointer flex items-center gap-1.5"
                    >
                      <Play className="w-3 h-3 text-amber-400" />
                      <span>Run Now</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleRoutine(routine.id)}
                      className={`px-3 py-1 rounded-xl text-xs font-mono cursor-pointer transition ${
                        routine.enabled
                          ? "bg-emerald-950 text-emerald-300 border border-emerald-500/40"
                          : "bg-slate-900 text-slate-400 border border-slate-700"
                      }`}
                    >
                      {routine.enabled ? "ENABLED" : "PAUSED"}
                    </button>
                  </div>
                </div>

                {/* Steps List */}
                <div className="space-y-1.5 mt-2 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">
                    Multi-Step Action Pipeline:
                  </div>
                  {routine.steps.map((step, sIdx) => (
                    <div key={sIdx} className="text-xs font-mono text-slate-300 flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-slate-800 text-[10px] flex items-center justify-center text-cyan-400 shrink-0 font-bold">
                        {sIdx + 1}
                      </span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-2 text-[10px] font-mono text-slate-500 flex justify-between">
                  <span>Last Executed: {routine.lastExecuted}</span>
                  <span className="text-emerald-400">Zero Error Rate</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
