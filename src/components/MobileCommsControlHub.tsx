import React, { useState, useEffect } from "react";
import {
  Bell,
  Phone,
  MessageSquare,
  Send,
  ShieldCheck,
  Radio,
  RefreshCw,
  Volume2,
  Settings,
  Smartphone,
  AlertTriangle,
  CheckCircle2,
  Reply,
  Download,
} from "lucide-react";
import { soundEffects } from "../services/soundEffects";
import { speechService } from "../services/speechService";
import {
  isNativeAndroidApk,
  getNativePhoneNotifications,
  replyToPhoneNotification,
  getNativeCallLogs,
  getNativeSmsMessages,
  sendNativeSms,
  setNativeBackgroundWakeService,
  openAndroidNotificationAccessSettings,
  requestAndroidNativePermissions,
  subscribeNativeEvents,
  NativeNotificationItem,
  NativeCallLogItem,
  NativeSmsItem,
} from "../services/nativeAndroidBridge";
import { triggerHaptic } from "../services/mobileDeviceActions";
import { LanguageCode, VoiceGender } from "../types";

interface MobileCommsControlHubProps {
  language: LanguageCode;
  voiceGender: VoiceGender;
  onOpenApkGuide?: () => void;
}

export const MobileCommsControlHub: React.FC<MobileCommsControlHubProps> = ({
  language,
  voiceGender,
  onOpenApkGuide,
}) => {
  const isNative = isNativeAndroidApk();
  const [activeTab, setActiveTab] = useState<"notifications" | "calls" | "sms" | "background">("notifications");
  const [notifications, setNotifications] = useState<NativeNotificationItem[]>([]);
  const [listenerEnabled, setListenerEnabled] = useState(false);
  const [calls, setCalls] = useState<NativeCallLogItem[]>([]);
  const [smsList, setSmsList] = useState<NativeSmsItem[]>([]);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [smsPhone, setSmsPhone] = useState("");
  const [smsText, setSmsText] = useState("");
  const [bgWakeActive, setBgWakeActive] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshAll = async () => {
    setIsRefreshing(true);
    try {
      const [notifRes, callRes, smsRes] = await Promise.all([
        getNativePhoneNotifications(),
        getNativeCallLogs(),
        getNativeSmsMessages(),
      ]);
      setListenerEnabled(notifRes.listenerEnabled);
      setNotifications(notifRes.notifications);
      setCalls(callRes);
      setSmsList(smsRes);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    refreshAll();
    const unsub = subscribeNativeEvents(
      () => {},
      (incoming) => {
        setNotifications((prev) => [incoming, ...prev.filter((n) => n.key !== incoming.key)].slice(0, 60));
      }
    );
    return unsub;
  }, []);

  const speakSummary = (text: string) => {
    speechService.speak(text, { lang: language, gender: voiceGender });
  };

  const handleReadAllNotifications = () => {
    soundEffects.playClick();
    triggerHaptic(20);
    if (!isNative) {
      const msg =
        language === "en"
          ? "Chrome web browser cannot read WhatsApp or Messenger notifications due to Android security. Build and install the Q-NEXUS APK for full notification access."
          : "Chrome browser Android ki security ki wajah se WhatsApp aur doosri apps ke notifications nahi parh sakta. Complete phone control ke liye project ka Android APK install karein.";
      setStatusNotice(msg);
      speakSummary(msg);
      return;
    }
    if (!listenerEnabled) {
      const msg = "Notification Listener access off hai. Ooper Notification Access Settings daba kar Q-NEXUS ko allow karein.";
      setStatusNotice(msg);
      speakSummary(msg);
      return;
    }
    if (notifications.length === 0) {
      const msg = "Is waqt koi naya phone notification ya chat message nahi hai.";
      setStatusNotice(msg);
      speakSummary(msg);
      return;
    }
    const top = notifications.slice(0, 5);
    const spoken = top
      .map((n, idx) => `${idx + 1}: ${n.appName} par ${n.title} ka message hai: ${n.text}`)
      .join(". ");
    speakSummary(spoken);
  };

  const handleReadCalls = () => {
    soundEffects.playClick();
    if (!isNative) {
      speakSummary("Call logs sirf installed Q-NEXUS Android APK mein read ho sakti hain.");
      return;
    }
    if (calls.length === 0) {
      speakSummary("Koi recent call log record nahi mila. Phone Permission allow karein.");
      return;
    }
    const summary = calls
      .slice(0, 4)
      .map((c) => `${c.type.toLowerCase()} call ${c.name || c.number}`)
      .join(", ");
    speakSummary(`Aapki aakhri calls: ${summary}`);
  };

  const handleSendReply = async (notif: NativeNotificationItem) => {
    const draft = (replyDrafts[notif.key] || "").trim();
    if (!draft) return;
    soundEffects.playBeepConfirm();
    triggerHaptic([15, 25]);
    const res = await replyToPhoneNotification(notif.key, draft);
    setStatusNotice(res.message);
    if (res.ok) {
      setReplyDrafts((prev) => ({ ...prev, [notif.key]: "" }));
      speakSummary(`${notif.title} ko ${notif.appName} par reply bhej diya gaya hai.`);
    }
  };

  const handleSendDirectSms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smsPhone.trim() || !smsText.trim()) return;
    soundEffects.playBeepConfirm();
    const res = await sendNativeSms(smsPhone.trim(), smsText.trim());
    setStatusNotice(res.message);
    if (res.ok) {
      setSmsText("");
      speakSummary("SMS send kar diya gaya hai.");
      refreshAll();
    }
  };

  const handleToggleBackgroundService = async () => {
    soundEffects.playClick();
    triggerHaptic(20);
    const next = !bgWakeActive;
    const res = await setNativeBackgroundWakeService(next, [
      "wake up jarvis",
      "hi jarvis",
      "hey jarvis",
      "hello zoya",
    ]);
    setBgWakeActive(res.active);
    setStatusNotice(res.message);
  };

  const handleGrantPermissions = async () => {
    soundEffects.playClick();
    const res = await requestAndroidNativePermissions();
    setStatusNotice(
      res.ok
        ? `Permissions — Mic: ${res.mic ? "ON" : "NO"} • Calls: ${res.phone ? "ON" : "NO"} • SMS: ${res.sms ? "ON" : "NO"}`
        : "Native Android APK mein hi system permissions grant hoti hain."
    );
    refreshAll();
  };

  return (
    <div className="w-full h-full flex flex-col font-rajdhani text-slate-100 space-y-3 overflow-y-auto">
      {/* Top Runtime Mode & Permissions Banner */}
      <div
        className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isNative
            ? "bg-emerald-950/40 border-emerald-500/40"
            : "bg-amber-950/35 border-amber-500/45"
        }`}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            {isNative ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <span className="font-orbitron font-bold text-xs sm:text-sm text-white">
              {isNative
                ? "NATIVE ANDROID APK BRIDGE ACTIVE"
                : "CHROME WEB MODE — SYSTEM ACCESS SANDBOXED"}
            </span>
          </div>
          <p className="text-[11px] font-mono text-slate-300 leading-relaxed">
            {isNative
              ? "Aap native Q-NEXUS Android APK chala rahe hain. Notification Access aur Permissions allow kar ke WhatsApp, Messenger, SMS, Calls aur Always-On Background 'Wake up Jarvis' use karein."
              : "Google Chrome aur Web PWA security ki wajah se WhatsApp/Instagram notifications, Call Logs, SMS, ya app band hone ke baad mic ('Wake up Jarvis') nahi chala sakte. Full phone control ke liye project ka ready-to-build .APK (build_android_apk.bat) banayein."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {isNative ? (
            <>
              <button
                type="button"
                onClick={handleGrantPermissions}
                className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-orbitron font-bold text-[11px] cursor-pointer flex items-center gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>ALLOW PERMISSIONS</span>
              </button>
              <button
                type="button"
                onClick={() => openAndroidNotificationAccessSettings()}
                className="px-3 py-1.5 rounded-xl bg-cyan-950 hover:bg-cyan-900 border border-cyan-400 text-cyan-200 font-mono text-[11px] cursor-pointer flex items-center gap-1.5"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>NOTIFICATION ACCESS</span>
              </button>
            </>
          ) : (
            onOpenApkGuide && (
              <button
                type="button"
                onClick={() => {
                  soundEffects.playClick();
                  onOpenApkGuide();
                }}
                className="px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-orbitron font-bold text-[11px] cursor-pointer flex items-center gap-1.5 shadow-lg shadow-amber-500/20"
              >
                <Download className="w-3.5 h-3.5" />
                <span>BUILD ANDROID .APK</span>
              </button>
            )
          )}
        </div>
      </div>

      {statusNotice && (
        <div className="p-2.5 rounded-xl bg-cyan-950/70 border border-cyan-400/50 text-cyan-200 text-xs font-mono flex items-center justify-between gap-2">
          <span>{statusNotice}</span>
          <button
            type="button"
            onClick={() => setStatusNotice(null)}
            className="text-slate-400 hover:text-white px-2 cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto text-xs font-orbitron">
        <button
          type="button"
          onClick={() => setActiveTab("notifications")}
          className={`px-3 py-2 rounded-xl flex items-center gap-1.5 shrink-0 cursor-pointer ${
            activeTab === "notifications"
              ? "bg-cyan-500 text-slate-950 font-bold"
              : "bg-slate-900 text-slate-300 border border-slate-800"
          }`}
        >
          <Bell className="w-3.5 h-3.5" />
          <span>ALL-APP MSGS ({notifications.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("calls")}
          className={`px-3 py-2 rounded-xl flex items-center gap-1.5 shrink-0 cursor-pointer ${
            activeTab === "calls"
              ? "bg-emerald-500 text-slate-950 font-bold"
              : "bg-slate-900 text-slate-300 border border-slate-800"
          }`}
        >
          <Phone className="w-3.5 h-3.5" />
          <span>CALL LOGS ({calls.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("sms")}
          className={`px-3 py-2 rounded-xl flex items-center gap-1.5 shrink-0 cursor-pointer ${
            activeTab === "sms"
              ? "bg-purple-500 text-slate-950 font-bold"
              : "bg-slate-900 text-slate-300 border border-slate-800"
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>SMS CONTROL</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("background")}
          className={`px-3 py-2 rounded-xl flex items-center gap-1.5 shrink-0 cursor-pointer ${
            activeTab === "background"
              ? "bg-amber-400 text-slate-950 font-bold"
              : "bg-slate-900 text-slate-300 border border-slate-800"
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          <span>BACKGROUND WAKE</span>
        </button>

        <button
          type="button"
          onClick={refreshAll}
          className="ml-auto px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-cyan-300 cursor-pointer shrink-0 flex items-center gap-1 font-mono text-[11px]"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          <span>Sync</span>
        </button>
      </div>

      {/* TAB 1: ALL-APP NOTIFICATIONS + REPLY */}
      {activeTab === "notifications" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/70 p-3 rounded-xl border border-slate-800">
            <div className="text-xs font-mono text-slate-300">
              Notification Listener:{" "}
              <strong className={listenerEnabled ? "text-emerald-400" : "text-amber-300"}>
                {isNative ? (listenerEnabled ? "ACTIVE (WhatsApp/Messenger/Calls/All)" : "DISABLED — Enable in Settings") : "APK REQUIRED"}
              </strong>
            </div>
            <button
              type="button"
              onClick={handleReadAllNotifications}
              className="px-3 py-1.5 rounded-xl bg-cyan-950 hover:bg-cyan-900 border border-cyan-400 text-cyan-200 text-xs font-mono flex items-center gap-1.5 cursor-pointer"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Zoya: Read Messages Aloud</span>
            </button>
          </div>

          {notifications.length === 0 ? (
            <div className="p-6 rounded-2xl bg-slate-950/90 border border-slate-800 text-center space-y-2 text-xs font-mono text-slate-400">
              <Bell className="w-7 h-7 text-cyan-400 mx-auto opacity-75" />
              <div className="text-slate-200 font-bold">
                {isNative
                  ? "Abhi koi naya notification nahi mila."
                  : "Live Android Notifications APK mode mein aate hain."}
              </div>
              <p className="max-w-lg mx-auto leading-relaxed">
                {isNative
                  ? "Jab WhatsApp, Messenger, Instagram, ya Phone Call aayegi, yahan real-time show hogi aur aap yahin se ya voice ('Reply to Ali ok') bol kar reply bhej sakenge."
                  : "Sample ya fake chat data nahi dikhaya ja raha. Jab aap Android .APK install kar ke Notification Access allow karenge to aapki asli WhatsApp, Messenger, Instagram aur Calls notifications yahan live aayengi."}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {notifications.map((notif) => (
                <div
                  key={notif.key}
                  className="p-3.5 rounded-2xl bg-slate-950/90 border border-cyan-500/30 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2 text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40 font-bold">
                        {notif.appName}
                      </span>
                      <span className="font-bold text-slate-100">{notif.title}</span>
                    </div>
                    <span className="text-[10px] text-slate-500">
                      {new Date(notif.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-sm text-slate-200 font-sans">{notif.text}</p>
                  {notif.canReply && (
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        value={replyDrafts[notif.key] || ""}
                        onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [notif.key]: e.target.value }))}
                        placeholder={`Reply to ${notif.title} via ${notif.appName}...`}
                        className="flex-1 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-slate-100"
                      />
                      <button
                        type="button"
                        onClick={() => handleSendReply(notif)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <Reply className="w-3.5 h-3.5" />
                        <span>Reply</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CALL LOGS */}
      {activeTab === "calls" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-slate-900/70 p-3 rounded-xl border border-slate-800">
            <span className="text-xs font-mono text-slate-300">
              Incoming, Outgoing &amp; Missed Calls
            </span>
            <button
              type="button"
              onClick={handleReadCalls}
              className="px-3 py-1.5 rounded-xl bg-emerald-950 border border-emerald-400 text-emerald-200 text-xs font-mono flex items-center gap-1.5 cursor-pointer"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Read Calls Aloud</span>
            </button>
          </div>

          {calls.length === 0 ? (
            <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 text-center text-xs font-mono text-slate-400">
              {isNative
                ? "Koi recent call nahi mili ya Call Log permission allow nahi hai."
                : "Chrome browser phone ki Call Logs read nahi kar sakta — .APK build install karne par real calls yahan dikhengi."}
            </div>
          ) : (
            <div className="space-y-2">
              {calls.map((c, idx) => (
                <div
                  key={`${c.number}-${c.date}-${idx}`}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs font-mono"
                >
                  <div>
                    <div className="font-bold text-slate-100">{c.name || c.number}</div>
                    <div className="text-[10px] text-slate-400">
                      {c.number} • {new Date(c.date).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                        c.type === "MISSED"
                          ? "bg-red-950 text-red-300 border border-red-500/40"
                          : "bg-emerald-950 text-emerald-300 border border-emerald-500/40"
                      }`}
                    >
                      {c.type}
                    </span>
                    <div className="text-[10px] text-slate-500 mt-0.5">{c.durationSec}s</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SMS CONTROL */}
      {activeTab === "sms" && (
        <div className="space-y-3">
          <form onSubmit={handleSendDirectSms} className="p-3.5 rounded-2xl bg-slate-900/70 border border-purple-500/30 space-y-2.5">
            <div className="text-xs font-orbitron font-bold text-purple-300">
              SEND DIRECT SMS FROM JARVIS
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="tel"
                value={smsPhone}
                onChange={(e) => setSmsPhone(e.target.value)}
                placeholder="Phone number (+923...)"
                className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono text-slate-100"
              />
              <input
                type="text"
                value={smsText}
                onChange={(e) => setSmsText(e.target.value)}
                placeholder="Message text..."
                className="sm:col-span-2 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono text-slate-100"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-slate-950 font-orbitron font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>SEND SMS NOW</span>
            </button>
          </form>

          {smsList.length === 0 ? (
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 text-center text-xs font-mono text-slate-400">
              {isNative
                ? "SMS Inbox empty hai ya READ_SMS permission allow karein."
                : "Real SMS inbox sirf Q-NEXUS Android APK mein load hota hai."}
            </div>
          ) : (
            <div className="space-y-2">
              {smsList.map((s) => (
                <div key={s.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono space-y-1">
                  <div className="flex justify-between">
                    <span className="font-bold text-purple-300">{s.address}</span>
                    <span className="text-[10px] text-slate-500">{s.type}</span>
                  </div>
                  <p className="text-slate-200">{s.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: ALWAYS-ON BACKGROUND WAKE SERVICE */}
      {activeTab === "background" && (
        <div className="p-4 rounded-2xl bg-slate-950 border border-amber-500/40 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="font-orbitron font-bold text-sm text-amber-300 flex items-center gap-2">
                <Smartphone className="w-4 h-4" />
                <span>ALWAYS-ON BACKGROUND &quot;WAKE UP JARVIS&quot;</span>
              </h4>
              <p className="text-xs font-mono text-slate-300 mt-1 leading-relaxed">
                Android Foreground Service app close hone ya screen lock hone ke baad bhi microphone par &quot;Wake up Jarvis&quot; aur &quot;Hi Jarvis&quot; sunti rehti hai aur bolte hi Q-NEXUS auto-launch kar deti hai.
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggleBackgroundService}
              className={`px-4 py-2.5 rounded-xl font-orbitron font-bold text-xs shrink-0 cursor-pointer ${
                bgWakeActive
                  ? "bg-emerald-500 text-slate-950"
                  : "bg-amber-400 hover:bg-amber-300 text-slate-950"
              }`}
            >
              {bgWakeActive ? "SERVICE RUNNING ✓" : "START WAKE SERVICE"}
            </button>
          </div>
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-400">
            Active Phrases: <span className="text-cyan-300">&quot;Wake up Jarvis&quot;, &quot;Hi Jarvis&quot;, &quot;Hey Jarvis&quot;, &quot;Hello Zoya&quot;</span>
          </div>
        </div>
      )}
    </div>
  );
};
