import React, { useState } from "react";
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  ShieldCheck,
  Plus,
  Sparkles,
  PieChart,
  Trash2,
  Volume2,
  Calendar,
} from "lucide-react";
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
  const [timeframe, setTimeframe] = useState<"daily" | "monthly" | "yearly">("monthly");
  const [dailyCap, setDailyCap] = useState<number>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("q_nexus_finance_settings") || "{}");
      return Number(saved.dailyCap) || 0;
    } catch {
      return 0;
    }
  });
  const [monthlyBudget, setMonthlyBudget] = useState<number>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("q_nexus_finance_settings") || "{}");
      return Number(saved.monthlyBudget) || 0;
    } catch {
      return 0;
    }
  });
  const [yearlyBudget, setYearlyBudget] = useState<number>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("q_nexus_finance_settings") || "{}");
      return Number(saved.yearlyBudget) || 0;
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
  const [investedAmount, setInvestedAmount] = useState<number>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("q_nexus_finance_settings") || "{}");
      return Number(saved.investedAmount) || 0;
    } catch {
      return 0;
    }
  });

  const saveFinanceConfig = (next: {
    dailyCap?: number;
    monthlyBudget?: number;
    yearlyBudget?: number;
    emergencyFund?: number;
    investedAmount?: number;
  }) => {
    const merged = {
      dailyCap: next.dailyCap ?? dailyCap,
      monthlyBudget: next.monthlyBudget ?? monthlyBudget,
      yearlyBudget: next.yearlyBudget ?? yearlyBudget,
      emergencyFund: next.emergencyFund ?? emergencyFund,
      investedAmount: next.investedAmount ?? investedAmount,
    };
    setDailyCap(merged.dailyCap);
    setMonthlyBudget(merged.monthlyBudget);
    setYearlyBudget(merged.yearlyBudget);
    setEmergencyFund(merged.emergencyFund);
    setInvestedAmount(merged.investedAmount);
    try {
      localStorage.setItem("q_nexus_finance_settings", JSON.stringify(merged));
    } catch {}
  };

  // Need vs Fazool Kharchi Analyzer
  const [itemQuery, setItemQuery] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [analysisResult, setAnalysisResult] = useState<{
    verdict: "APPROVED_NECESSITY" | "FAZOOL_KHARCHI" | "CONSIDER_WAITING";
    reason: string;
    advice: string;
    score: number;
  } | null>(null);

  // Add Expense Form
  const [showAddForm, setShowAddForm] = useState(false);
  const [expTitle, setExpTitle] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expCategory, setExpCategory] = useState<ExpenseItem["category"]>("hardware");
  const [isWasteful, setIsWasteful] = useState(false);

  const todayStr = new Date().toISOString().slice(0, 10);
  const monthPrefix = todayStr.slice(0, 7);
  const yearPrefix = todayStr.slice(0, 4);

  const periodExpenses = expenses.filter((e) => {
    if (timeframe === "daily") return e.date.startsWith(todayStr) || e.date === "Today";
    if (timeframe === "monthly") return e.date.startsWith(monthPrefix) || e.date === "Today";
    return e.date.startsWith(yearPrefix) || e.date === "Today";
  });

  const activePeriodTotal = periodExpenses.reduce((s, e) => s + e.amount, 0);
  const activePeriodFazool = periodExpenses.filter((e) => e.isFazoolKharchi).reduce((s, e) => s + e.amount, 0);
  const activeCap = timeframe === "daily" ? dailyCap : timeframe === "monthly" ? monthlyBudget : yearlyBudget;
  const remainingCap = Math.max(0, activeCap - activePeriodTotal);

  const handleAnalyzeItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemQuery.trim()) return;
    soundEffects.playBeepConfirm();
    const q = itemQuery.toLowerCase();
    const price = Number(itemPrice) || 0;

    let verdict: "APPROVED_NECESSITY" | "FAZOOL_KHARCHI" | "CONSIDER_WAITING" = "CONSIDER_WAITING";
    let reason = "";
    let advice = "";
    let score = 55;

    if (/medicine|dawai|book|course|study|grocery|roti|atta|bill|electricity|internet|ssd|ram|laptop|tool/.test(q)) {
      verdict = "APPROVED_NECESSITY";
      reason = "Essential need or productive growth tool directly supporting Wasi's health, study, or work.";
      advice =
        language === "pa"
          ? "Wasi paji, eh zaroori te kaam di chiz ae. Tussi bezhijhak le sakde ho."
          : "Wasi Sahab, yeh zaroorat aur kaam ki cheez hai. Isko purchase karne ki poori ijazat hai.";
      score = 94;
    } else if (/burger|pizza|fast food|watch|shoes|perfume|game skin|luxury|branded|soda|snacks|party/.test(q) || (dailyCap > 0 && price > dailyCap)) {
      verdict = "FAZOOL_KHARCHI";
      reason = "Non-essential impulse spending or exceeds daily cap. Focus only on necessities right now.";
      advice =
        language === "pa"
          ? "Ruk jao Wasi paji! Eh fazool kharchi ae. Sirf zaroorat diyaan chizan te dhayan do."
          : "Ruk jayein Wasi Sahab! Yeh fazool kharchi hai. Abhi iski zaroorat nahi hai, sirf zaroori cheezon par focus karein.";
      score = 18;
    } else {
      verdict = "CONSIDER_WAITING";
      reason = "Unclear necessity: Apply the 48-hour necessity filter before spending.";
      advice =
        language === "pa"
          ? "2 din wait karo Wasi paji, agar bilkul zaroori lagay tab hi kharch karna."
          : "Wasi Sahab, 48 ghante rukein. Agar waqai zaroorat ho tabhi kharch karein.";
      score = 52;
    }

    setAnalysisResult({ verdict, reason, advice, score });
    speechService.speak(advice, { lang: language, gender: voiceGender });
  };

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expTitle.trim() || !expAmount) return;

    const amt = Math.max(0, Number(expAmount) || 0);
    if (isWasteful) {
      soundEffects.playAlert();
      speechService.speak(
        `Khabardar Wasi Sahab! ${expTitle.trim()} fazool kharchi mein add hua hai. Baraye meherbani sirf zaroorat par kharch karein.`,
        { lang: language, gender: voiceGender }
      );
    } else {
      soundEffects.playClick();
    }

    const newExp: ExpenseItem = {
      id: Date.now().toString(),
      title: expTitle.trim(),
      amount: amt,
      category: expCategory,
      isFazoolKharchi: isWasteful,
      date: todayStr,
    };

    const updated = [newExp, ...expenses];
    setExpenses(updated);
    storageService.saveExpenses(updated);
    setExpTitle("");
    setExpAmount("");
    setShowAddForm(false);
  };

  const speakDetailedSummary = () => {
    soundEffects.playBeepConfirm();
    const essentialSpent = activePeriodTotal - activePeriodFazool;
    const summaryText =
      language === "en"
        ? `Your ${timeframe} financial report: Total spent ${activePeriodTotal.toLocaleString()} PKR. Essential needs ${essentialSpent.toLocaleString()} PKR, and flagged wasteful spending ${activePeriodFazool.toLocaleString()} PKR.`
        : `Wasi Sahab, aapka ${timeframe === "daily" ? "rozana" : timeframe === "monthly" ? "mahana" : "salana"} hisab hazir hai: Kul kharcha ${activePeriodTotal.toLocaleString()} rupay hai, jisme zaroorat ki cheezon par ${essentialSpent.toLocaleString()} aur fazool kharchi mein ${activePeriodFazool.toLocaleString()} rupay lagay hain.`;
    speechService.speak(summaryText, { lang: language, gender: voiceGender });
  };

  return (
    <div className="space-y-5 font-rajdhani">
      {/* Timeframe Switcher + Detailed Summary */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-cyan-500/30 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-orbitron">
          <Calendar className="w-4 h-4 text-cyan-400" />
          {(["daily", "monthly", "yearly"] as const).map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => {
                soundEffects.playClick();
                setTimeframe(tf);
              }}
              className={`px-3 py-1.5 rounded-lg uppercase cursor-pointer transition ${
                timeframe === tf
                  ? "bg-cyan-500 text-slate-950 font-bold"
                  : "bg-slate-950 text-slate-300 border border-slate-800"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={speakDetailedSummary}
          className="px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-emerald-200 font-mono text-xs flex items-center gap-1.5 cursor-pointer"
        >
          <Volume2 className="w-4 h-4" />
          <span>Detailed Vocal Summary</span>
        </button>
      </div>

      {/* Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-cyan-500/30">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-mono text-slate-400 uppercase flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-cyan-400" /> {timeframe} BUDGET CAP
            </span>
            <input
              type="number"
              value={activeCap || ""}
              placeholder="Set PKR"
              onChange={(e) => {
                const v = Math.max(0, Number(e.target.value) || 0);
                if (timeframe === "daily") saveFinanceConfig({ dailyCap: v });
                else if (timeframe === "monthly") saveFinanceConfig({ monthlyBudget: v });
                else saveFinanceConfig({ yearlyBudget: v });
              }}
              className="w-24 px-2 py-0.5 bg-slate-950 border border-slate-700 rounded text-right text-xs font-mono text-cyan-300"
            />
          </div>
          <div className="text-xl font-orbitron font-bold text-slate-100">
            {remainingCap.toLocaleString()} <span className="text-xs font-mono text-slate-400">PKR Left</span>
          </div>
          <div className="text-[10px] font-mono text-slate-400 mt-1">
            Spent ({timeframe}): {activePeriodTotal.toLocaleString()} PKR
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-red-500/30">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" /> FAZOOL KHARCHI GUARD
            </span>
          </div>
          <div className="text-xl font-orbitron font-bold text-red-300">
            {activePeriodFazool.toLocaleString()} <span className="text-xs font-mono text-slate-400">PKR</span>
          </div>
          <div className="text-[10px] font-mono text-emerald-400 mt-1 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> Focus: Zaroorat ki Cheezein Only
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-emerald-500/30">
          <div className="text-[11px] font-mono text-slate-400 mb-1.5 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> SAVINGS FUND
          </div>
          <div className="text-xl font-orbitron font-bold text-slate-100">
            {emergencyFund.toLocaleString()} PKR
          </div>
          <input
            type="number"
            value={emergencyFund || ""}
            placeholder="Update saved PKR"
            onChange={(e) => saveFinanceConfig({ emergencyFund: Math.max(0, Number(e.target.value) || 0) })}
            className="w-full mt-1.5 px-2 py-1 bg-slate-950 border border-slate-800 rounded text-[11px] font-mono text-emerald-300"
          />
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-purple-500/30">
          <div className="text-[11px] font-mono text-slate-400 mb-1.5 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" /> INVESTMENTS
          </div>
          <div className="text-xl font-orbitron font-bold text-slate-100">
            {investedAmount.toLocaleString()} PKR
          </div>
          <input
            type="number"
            value={investedAmount || ""}
            placeholder="Invested PKR"
            onChange={(e) => saveFinanceConfig({ investedAmount: Math.max(0, Number(e.target.value) || 0) })}
            className="w-full mt-1.5 px-2 py-1 bg-slate-950 border border-slate-800 rounded text-[11px] font-mono text-purple-300"
          />
        </div>
      </div>

      {/* Main 2-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Necessity vs Fazool Kharchi Filter */}
        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="w-5 h-5 text-cyan-400" />
              <h3 className="font-orbitron font-bold text-sm text-cyan-400 uppercase">
                ZAROORAT VS FAZOOL KHARCHI FILTER
              </h3>
            </div>
            <p className="text-xs font-mono text-slate-400 mb-3">
              Khareedari se pehle check karein — Jarvis aap ko fazool kharchi se rok kar sirf zaroori cheezon par focus karwayega.
            </p>
            <form onSubmit={handleAnalyzeItem} className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={itemQuery}
                  onChange={(e) => setItemQuery(e.target.value)}
                  placeholder="Item name..."
                  required
                  className="col-span-2 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 text-xs font-mono"
                />
                <input
                  type="number"
                  value={itemPrice}
                  onChange={(e) => setItemPrice(e.target.value)}
                  placeholder="Price PKR"
                  className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 text-xs font-mono"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold font-mono text-xs cursor-pointer"
              >
                TEST NECESSITY
              </button>
            </form>
          </div>

          {analysisResult && (
            <div
              className={`mt-4 p-4 rounded-xl border ${
                analysisResult.verdict === "APPROVED_NECESSITY"
                  ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-200"
                  : analysisResult.verdict === "FAZOOL_KHARCHI"
                  ? "bg-red-950/30 border-red-500/40 text-red-200"
                  : "bg-amber-950/30 border-amber-500/40 text-amber-200"
              }`}
            >
              <div className="flex justify-between font-orbitron font-bold text-xs mb-1">
                <span>{analysisResult.verdict.replace("_", " ")}</span>
                <span>{analysisResult.score}/100</span>
              </div>
              <p className="text-xs font-mono mb-2">{analysisResult.reason}</p>
              <div className="pt-2 border-t border-slate-700/60 text-xs font-mono">{analysisResult.advice}</div>
            </div>
          )}
        </div>

        {/* Expense Ledger */}
        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-orbitron font-bold text-sm text-purple-400 uppercase flex items-center gap-2">
              <PieChart className="w-4 h-4" /> EXPENSE LEDGER ({periodExpenses.length})
            </h3>
            <button
              type="button"
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold font-mono text-xs flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showAddForm ? "CANCEL" : "LOG EXPENSE"}</span>
            </button>
          </div>

          {showAddForm && (
            <form onSubmit={handleAddExpense} className="mb-3 p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={expTitle}
                  onChange={(e) => setExpTitle(e.target.value)}
                  placeholder="Expense item"
                  required
                  className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs font-mono"
                />
                <input
                  type="number"
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  placeholder="PKR"
                  required
                  className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs font-mono"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                <select
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value as any)}
                  className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200"
                >
                  <option value="food">Essential Food</option>
                  <option value="bills">Utilities / Bills</option>
                  <option value="hardware">Study / Work Gear</option>
                  <option value="investment">Business / Saving</option>
                  <option value="subscriptions">Subscriptions</option>
                  <option value="personal">Personal</option>
                </select>
                <label className="flex items-center gap-1.5 cursor-pointer text-red-300">
                  <input
                    type="checkbox"
                    checked={isWasteful}
                    onChange={(e) => setIsWasteful(e.target.checked)}
                  />
                  <span>Fazool Kharchi</span>
                </label>
                <button type="submit" className="px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-bold cursor-pointer">
                  SAVE
                </button>
              </div>
            </form>
          )}

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {periodExpenses.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-950/60 border border-dashed border-slate-800 text-center text-xs font-mono text-slate-400">
                Is {timeframe} view mein abhi koi kharcha record nahi hai.
              </div>
            ) : (
              periodExpenses.map((exp) => (
                <div
                  key={exp.id}
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs font-mono ${
                    exp.isFazoolKharchi ? "bg-red-950/20 border-red-500/30" : "bg-slate-950/80 border-slate-800"
                  }`}
                >
                  <div>
                    <div className="font-semibold text-slate-100">{exp.title}</div>
                    <div className="text-[10px] text-slate-400">
                      {exp.category.toUpperCase()} · {exp.date} {exp.isFazoolKharchi && "· [FAZOOL KHARCHI]"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-orbitron font-bold text-slate-100">{exp.amount.toLocaleString()} PKR</span>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = expenses.filter((x) => x.id !== exp.id);
                        setExpenses(updated);
                        storageService.saveExpenses(updated);
                      }}
                      className="text-slate-600 hover:text-rose-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
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
