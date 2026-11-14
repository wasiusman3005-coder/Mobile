import React, { useState } from "react";
import { DollarSign, TrendingUp, AlertTriangle, ShieldCheck, Plus, Sparkles, PieChart, ArrowUpRight, CheckCircle } from "lucide-react";
import { soundEffects } from "../services/soundEffects";
import { speechService } from "../services/speechService";
import { storageService } from "../services/storage";
import { ExpenseItem, LanguageCode, VoiceGender } from "../types";

interface FinanceInvestManagerProps {
  language: LanguageCode;
  voiceGender: VoiceGender;
}

export const FinanceInvestManager: React.FC<FinanceInvestManagerProps> = ({
  language,
  voiceGender,
}) => {
  const [expenses, setExpenses] = useState<ExpenseItem[]>(() => storageService.getExpenses());
  const [monthlyBudget, setMonthlyBudget] = useState<number>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("q_nexus_finance_settings") || "{}");
      return Number(saved.monthlyBudget) || 0;
    } catch {
      return 0;
    }
  });
  const [emergencyFund, setEmergencyFund] = useState<number>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("q_nexus_finance_settings") || "{}");
      return Number(saved.emergencyFund) || 0;
    } catch {
      return 0;
    }
  });
  const [emergencyTarget, setEmergencyTarget] = useState<number>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("q_nexus_finance_settings") || "{}");
      return Number(saved.emergencyTarget) || 0;
    } catch {
      return 0;
    }
  });
  const [investedAmount, setInvestedAmount] = useState<number>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("q_nexus_finance_settings") || "{}");
      return Number(saved.investedAmount) || 0;
    } catch {
      return 0;
    }
  });

  const saveFinanceConfig = (next: {
    monthlyBudget?: number;
    emergencyFund?: number;
    emergencyTarget?: number;
    investedAmount?: number;
  }) => {
    const merged = {
      monthlyBudget: next.monthlyBudget ?? monthlyBudget,
      emergencyFund: next.emergencyFund ?? emergencyFund,
      emergencyTarget: next.emergencyTarget ?? emergencyTarget,
      investedAmount: next.investedAmount ?? investedAmount,
    };
    setMonthlyBudget(merged.monthlyBudget);
    setEmergencyFund(merged.emergencyFund);
    setEmergencyTarget(merged.emergencyTarget);
    setInvestedAmount(merged.investedAmount);
    try {
      localStorage.setItem("q_nexus_finance_settings", JSON.stringify(merged));
    } catch {}
  };

  // Fazool Kharchi Advisor Tool
  const [itemQuery, setItemQuery] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [analysisResult, setAnalysisResult] = useState<{
    verdict: "APPROVED_INVESTMENT" | "FAZOOL_KHARCHI" | "CONSIDER_WAITING";
    reason: string;
    advice: string;
    score: number;
  } | null>(null);

  // New Expense Modal / Form
  const [showAddForm, setShowAddForm] = useState(false);
  const [expTitle, setExpTitle] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expCategory, setExpCategory] = useState<ExpenseItem["category"]>("hardware");
  const [isWasteful, setIsWasteful] = useState(false);

  // Analyze Item for Fazool Kharchi
  const handleAnalyzeItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemQuery.trim()) return;

    soundEffects.playBeepConfirm();
    const q = itemQuery.toLowerCase();
    const price = Number(itemPrice) || 0;

    let verdict: "APPROVED_INVESTMENT" | "FAZOOL_KHARCHI" | "CONSIDER_WAITING" = "CONSIDER_WAITING";
    let reason = "";
    let advice = "";
    let score = 50;

    if (q.includes("ssd") || q.includes("ram") || q.includes("monitor") || q.includes("course") || q.includes("gpu")) {
      verdict = "APPROVED_INVESTMENT";
      reason = "High Return on Investment (ROI): Directly accelerates video editing & coding speed.";
      advice =
        language === "pa"
          ? "Wasi paji, eh tuhade kaam di chiz ae! Eh kharcha nahi balkay productive investment ae."
          : "Wasi Sahab, yeh aapke professional work aur video rendering ko fast karega. Approved investment!";
      score = 92;
    } else if (q.includes("iphone") || q.includes("watch") || q.includes("shoes") || q.includes("perfume") || q.includes("fast food")) {
      verdict = "FAZOOL_KHARCHI";
      reason = "Impulse Luxury / Lifestyle Inflation: High cost with zero financial return.";
      advice =
        language === "pa"
          ? "Ruk jao Wasi paji! Eh fazool kharchi ae. Apne paise bacha ke Quantum Investment Fund ch lao!"
          : "Wasi Sahab, yeh fazool kharchi hai! Abhi iski zaroorat nahi hai. Yeh raqam bacha kar investment mein dalein.";
      score = 22;
    } else {
      verdict = "CONSIDER_WAITING";
      reason = "Medium Priority: Apply the 72-Hour Rule before spending.";
      advice =
        language === "pa"
          ? "3 din ruko Wasi paji, agar pher vi bohot zaroori lageya taan sochaange."
          : "Wasi Sahab, 72 ghante wait karein. Agar phir bhi zaroorat hui tab purchase karein.";
      score = 55;
    }

    setAnalysisResult({ verdict, reason, advice, score });
  };

  // Add Expense
  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expTitle.trim() || !expAmount) return;

    soundEffects.playClick();
    const newExp: ExpenseItem = {
      id: Date.now().toString(),
      title: expTitle.trim(),
      amount: Number(expAmount),
      category: expCategory,
      isFazoolKharchi: isWasteful,
      date: "Just now",
    };

    const updated = [newExp, ...expenses];
    setExpenses(updated);
    storageService.saveExpenses(updated);

    setExpTitle("");
    setExpAmount("");
    setShowAddForm(false);
  };

  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
  const fazoolSpent = expenses.filter((e) => e.isFazoolKharchi).reduce((sum, e) => sum + e.amount, 0);
  const remainingBudget = Math.max(0, monthlyBudget - totalSpent);

  return (
    <div className="space-y-6 font-rajdhani">
      {/* Top Financial Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Monthly Budget */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-cyan-500/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-cyan-400" />
              MONTHLY BUDGET
            </span>
            <input
              type="number"
              value={monthlyBudget || ""}
              placeholder="Set PKR"
              onChange={(e) => saveFinanceConfig({ monthlyBudget: Math.max(0, Number(e.target.value) || 0) })}
              className="w-24 px-2 py-0.5 bg-slate-950 border border-slate-700 rounded text-right text-xs font-mono text-cyan-300"
            />
          </div>
          <div className="text-2xl font-orbitron font-bold text-slate-100">
            {remainingBudget.toLocaleString()} <span className="text-xs font-mono text-slate-400 font-normal">PKR Left</span>
          </div>
          <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800 mt-3">
            <div
              className={`h-full transition-all duration-500 ${
                monthlyBudget > 0 && remainingBudget < monthlyBudget * 0.2 ? "bg-red-500" : "bg-cyan-400"
              }`}
              style={{ width: `${monthlyBudget > 0 ? Math.min(100, (totalSpent / monthlyBudget) * 100) : 0}%` }}
            ></div>
          </div>
          <div className="text-[10px] font-mono text-slate-500 mt-1.5 flex justify-between">
            <span>Spent: {totalSpent.toLocaleString()} PKR</span>
            <span>{monthlyBudget > 0 ? `${Math.round((totalSpent / monthlyBudget) * 100)}% used` : "No budget set"}</span>
          </div>
        </div>

        {/* Fazool Kharchi Shield */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-red-500/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              FAZOOL KHARCHI SHIELD
            </span>
            <span className="text-xs font-mono text-red-400 font-bold">ACTIVE DEFENSE</span>
          </div>
          <div className="text-2xl font-orbitron font-bold text-red-300">
            {fazoolSpent.toLocaleString()} <span className="text-xs font-mono text-slate-400 font-normal">PKR Flagged</span>
          </div>
          <div className="text-xs font-mono text-emerald-400 mt-2 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{expenses.filter((e) => e.isFazoolKharchi).length} WASTEFUL ITEMS LOGGED</span>
          </div>
          <div className="text-[10px] font-mono text-slate-500 mt-1">
            Based strictly on expenses you log below
          </div>
        </div>

        {/* Emergency Fund */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-emerald-500/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              SAVINGS / EMERGENCY
            </span>
            <span className="text-xs font-mono text-emerald-400 font-bold">
              {emergencyTarget > 0 ? `${Math.round((emergencyFund / emergencyTarget) * 100)}%` : "0%"}
            </span>
          </div>
          <div className="text-2xl font-orbitron font-bold text-slate-100">
            {emergencyFund.toLocaleString()} <span className="text-xs font-mono text-slate-400 font-normal">PKR Saved</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 mt-2">
            <input
              type="number"
              value={emergencyFund || ""}
              placeholder="Saved PKR"
              onChange={(e) => saveFinanceConfig({ emergencyFund: Math.max(0, Number(e.target.value) || 0) })}
              className="px-2 py-1 bg-slate-950 border border-slate-800 rounded text-[11px] font-mono text-emerald-300"
            />
            <input
              type="number"
              value={emergencyTarget || ""}
              placeholder="Target PKR"
              onChange={(e) => saveFinanceConfig({ emergencyTarget: Math.max(0, Number(e.target.value) || 0) })}
              className="px-2 py-1 bg-slate-950 border border-slate-800 rounded text-[11px] font-mono text-slate-300"
            />
          </div>
        </div>

        {/* Personal Investments */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-purple-500/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-purple-400" />
              MY INVESTMENTS
            </span>
            <span className="text-xs font-mono text-purple-400 font-bold">MANUAL TRACKER</span>
          </div>
          <div className="text-2xl font-orbitron font-bold text-slate-100">
            {investedAmount.toLocaleString()} <span className="text-xs font-mono text-slate-400 font-normal">PKR</span>
          </div>
          <input
            type="number"
            value={investedAmount || ""}
            placeholder="Enter invested PKR"
            onChange={(e) => saveFinanceConfig({ investedAmount: Math.max(0, Number(e.target.value) || 0) })}
            className="w-full mt-2 px-2.5 py-1 bg-slate-950 border border-slate-800 rounded text-[11px] font-mono text-purple-300"
          />
        </div>
      </div>

      {/* Two Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fazool Kharchi AI Analyzer ("Need vs Want") */}
        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="w-5 h-5 text-cyan-400" />
              <h3 className="font-orbitron font-bold text-base text-cyan-400 uppercase">
                FAZOOL KHARCHI AI ANALYZER
              </h3>
            </div>
            <p className="text-xs font-mono text-slate-400 mb-4">
              Enter any item you are tempted to buy. Jarvis will test if it's an essential productive investment or wasteful spending.
            </p>

            <form onSubmit={handleAnalyzeItem} className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={itemQuery}
                  onChange={(e) => setItemQuery(e.target.value)}
                  placeholder="Item name (e.g. Mechanical Keyboard, New Jacket)"
                  className="col-span-2 px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 text-xs font-mono focus:border-cyan-400 focus:outline-none"
                  required
                />
                <input
                  type="number"
                  value={itemPrice}
                  onChange={(e) => setItemPrice(e.target.value)}
                  placeholder="Price (PKR)"
                  className="px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 text-xs font-mono focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold font-mono text-xs transition cursor-pointer shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-4 h-4" />
                TEST NEED VS WANT
              </button>
            </form>
          </div>

          {/* Analysis Result Box */}
          {analysisResult && (
            <div
              className={`mt-4 p-4 rounded-xl border animate-fadeIn ${
                analysisResult.verdict === "APPROVED_INVESTMENT"
                  ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-200"
                  : analysisResult.verdict === "FAZOOL_KHARCHI"
                  ? "bg-red-950/30 border-red-500/40 text-red-200"
                  : "bg-amber-950/30 border-amber-500/40 text-amber-200"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-orbitron font-bold text-xs uppercase tracking-wider">
                  VERDICT: {analysisResult.verdict.replace("_", " ")}
                </span>
                <span className="text-xs font-mono font-bold">
                  Score: {analysisResult.score}/100
                </span>
              </div>
              <p className="text-xs font-mono mb-2">{analysisResult.reason}</p>
              <div className="pt-2 border-t border-slate-700/60 text-xs font-mono">
                <strong>Jarvis Vocal Advice:</strong> "{analysisResult.advice}"
              </div>
            </div>
          )}
        </div>

        {/* Expenses Tracker & Add Expense */}
        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <PieChart className="w-5 h-5 text-purple-400" />
              <h3 className="font-orbitron font-bold text-base text-purple-400 uppercase">
                RECENT EXPENSES & LOG
              </h3>
            </div>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold font-mono text-xs transition flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showAddForm ? "CANCEL" : "LOG EXPENSE"}</span>
            </button>
          </div>

          {/* Add Form */}
          {showAddForm && (
            <form onSubmit={handleAddExpense} className="mb-4 p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={expTitle}
                  onChange={(e) => setExpTitle(e.target.value)}
                  placeholder="Expense description"
                  required
                  className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs font-mono"
                />
                <input
                  type="number"
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  placeholder="Amount (PKR)"
                  required
                  className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs font-mono"
                />
              </div>

              <div className="flex items-center justify-between text-xs font-mono">
                <select
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value as any)}
                  className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200"
                >
                  <option value="hardware">Hardware / Gear</option>
                  <option value="food">Healthy Food</option>
                  <option value="subscriptions">Subscriptions</option>
                  <option value="investment">Investment</option>
                  <option value="bills">Bills</option>
                  <option value="personal">Personal</option>
                </select>

                <label className="flex items-center gap-1.5 cursor-pointer text-red-300">
                  <input
                    type="checkbox"
                    checked={isWasteful}
                    onChange={(e) => setIsWasteful(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-red-500"
                  />
                  <span>Flag as Fazool Kharchi</span>
                </label>

                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold"
                >
                  SAVE
                </button>
              </div>
            </form>
          )}

          {/* List */}
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {expenses.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-950/60 border border-dashed border-slate-800 text-center text-xs font-mono text-slate-400">
                Abhi koi expense log nahi hua. &quot;LOG EXPENSE&quot; par tap karke apna kharcha add karein.
              </div>
            ) : (
              expenses.map((exp) => (
                <div
                  key={exp.id}
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs font-mono ${
                    exp.isFazoolKharchi
                      ? "bg-red-950/20 border-red-500/30 text-red-200"
                      : "bg-slate-950/80 border-slate-800 text-slate-200"
                  }`}
                >
                  <div>
                    <div className="font-semibold text-slate-100">{exp.title}</div>
                    <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                      <span className="uppercase text-cyan-400">{exp.category}</span>
                      <span>•</span>
                      <span>{exp.date}</span>
                      {exp.isFazoolKharchi && (
                        <span className="text-red-400 font-bold">[FAZOOL KHARCHI]</span>
                      )}
                    </div>
                  </div>

                  <div className="font-orbitron font-bold text-slate-100 text-sm">
                    {exp.amount.toLocaleString()} PKR
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
