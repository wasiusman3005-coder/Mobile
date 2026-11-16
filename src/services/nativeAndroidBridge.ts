import type { LanguageCode } from "../types";

export interface NativeDeviceTelemetry {
  manufacturer: string;
  model: string;
  androidVersion: string;
  sdkInt: number;
  totalRamMb: number;
  availRamMb: number;
  totalStorageGb: number;
  availStorageGb: number;
  batteryPercent: number;
  isCharging: boolean;
  batteryTempC: number;
  networkType: string;
}

export interface NativeNotificationItem {
  key: string;
  packageName: string;
  appName: string;
  title: string;
  text: string;
  timestamp: number;
  canReply: boolean;
  isCallNotification?: boolean;
}

export interface NativeCallLogItem {
  name: string;
  number: string;
  type: "INCOMING" | "OUTGOING" | "MISSED" | "REJECTED";
  date: number;
  durationSec: number;
}

export interface NativeSmsItem {
  id: string;
  address: string;
  body: string;
  date: number;
  type: "INBOX" | "SENT";
}

export interface AndroidPermissionStatus {
  ok: boolean;
  mic: boolean;
  camera: boolean;
  notifications: boolean;
  location: boolean;
  phone: boolean;
  sms: boolean;
  notifListener: boolean;
  sdkInt: number;
}

export interface NativeSpeechEventHandlers {
  onStart?: () => void;
  onPartial?: (text: string) => void;
  onResult?: (text: string) => void;
  onRms?: (level: number) => void;
  onError?: (message: string, code?: number) => void;
  onEnd?: () => void;
  onTtsStart?: () => void;
  onTtsDone?: () => void;
  onWakeStatus?: (active: boolean, status: string) => void;
  onPermissionsChanged?: (status: AndroidPermissionStatus) => void;
}

interface QNexusPluginInterface {
  getDeviceTelemetry(): Promise<NativeDeviceTelemetry>;
  verifyBiometric(opts: { title: string; subtitle: string }): Promise<{ ok: boolean; message: string }>;
  getNotifications(): Promise<{ notifications: NativeNotificationItem[]; listenerEnabled: boolean }>;
  replyToNotification(opts: { key: string; replyText: string }): Promise<{ ok: boolean; message: string }>;
  getCallLogs(): Promise<{ calls: NativeCallLogItem[] }>;
  getSmsMessages(): Promise<{ messages: NativeSmsItem[] }>;
  sendSms(opts: { phone: string; message: string }): Promise<{ ok: boolean; message: string }>;
  toggleFlashlight?(opts: { enable: boolean }): Promise<{ ok: boolean; active: boolean; message: string }>;
  setAutoAnnounce?(opts: { enabled: boolean }): Promise<{ ok: boolean; enabled: boolean }>;
  openBatteryOptimizationSettings?(): Promise<{ ok: boolean }>;
  requestIgnoreBatteryOptimization?(): Promise<{ ok: boolean; unrestricted?: boolean }>;
  getBackgroundStatus?(): Promise<{ ok: boolean; running: boolean; wakeEnabled: boolean; batteryUnrestricted: boolean }>;
  openAppInfoSettings?(): Promise<{ ok: boolean }>;
  setBackgroundWakeService(opts: { enabled: boolean; phrases?: string[] }): Promise<{ ok: boolean; active: boolean; message: string }>;
  openNotificationAccessSettings(): Promise<{ ok: boolean }>;
  getPermissionStatus?(): Promise<AndroidPermissionStatus>;
  requestMicPermission?(): Promise<{ ok: boolean; granted: boolean }>;
  requestCorePermissions?(): Promise<AndroidPermissionStatus>;
  requestCommsPermissions?(): Promise<AndroidPermissionStatus>;
  requestAllPermissions(): Promise<AndroidPermissionStatus & { mic: boolean; phone: boolean; sms: boolean }>;
  speakNative?(opts: { text: string; lang: string; gender: "male" | "female"; pitch?: number; rate?: number }): Promise<{ ok: boolean }>;
  stopNativeSpeech?(): Promise<{ ok: boolean }>;
  startNativeListening?(opts: { lang: string }): Promise<{ ok: boolean; needsMicPermission?: boolean; message?: string }>;
  stopNativeListening?(): Promise<{ ok: boolean }>;
  cancelNativeListening?(): Promise<{ ok: boolean }>;
  setNativeWakeWordEnabled?(opts: { enabled: boolean; phrases?: string[] }): Promise<{ ok: boolean; active: boolean }>;
  addListener?(eventName: string, cb: (data: any) => void): { remove: () => void };
}

function getNativePlugin(): QNexusPluginInterface | null {
  if (typeof window === "undefined") return null;
  const cap = (window as any).Capacitor;
  if (!cap) return null;
  const plugin = cap.Plugins?.QNexusNative;
  return plugin || null;
}

export function isNativeAndroidApk(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as any).Capacitor;
  return Boolean(cap && typeof cap.isNativePlatform === "function" && cap.isNativePlatform() && cap.getPlatform?.() === "android");
}

export function hasNativePlugin(): boolean {
  return Boolean(getNativePlugin());
}

export async function getNativeDeviceTelemetry(): Promise<NativeDeviceTelemetry | null> {
  const plugin = getNativePlugin();
  if (!plugin) return null;
  try {
    return await plugin.getDeviceTelemetry();
  } catch {
    return null;
  }
}

export async function verifyNativeAndroidBiometric(
  title = "Wasu's Jarvis Biometric Unlock",
  subtitle = "Verify with your Phone Fingerprint or Face"
): Promise<{ ok: boolean; message: string } | null> {
  const plugin = getNativePlugin();
  if (!plugin) return null;
  try {
    return await plugin.verifyBiometric({ title, subtitle });
  } catch (e: any) {
    return { ok: false, message: e?.message || "Biometric check failed" };
  }
}

export async function toggleNativeAndroidFlashlight(
  enable: boolean
): Promise<{ ok: boolean; active: boolean; message: string } | null> {
  const plugin = getNativePlugin();
  if (!plugin?.toggleFlashlight) return null;
  try {
    return await plugin.toggleFlashlight({ enable });
  } catch (e: any) {
    return { ok: false, active: false, message: e?.message || "Native flashlight control failed" };
  }
}

export async function setNativeBackgroundAutoAnnounce(enabled: boolean): Promise<boolean> {
  try {
    localStorage.setItem("wasu_jarvis_bg_announce", enabled ? "1" : "0");
  } catch {}
  const plugin = getNativePlugin();
  if (!plugin?.setAutoAnnounce) return false;
  try {
    const res = await plugin.setAutoAnnounce({ enabled });
    return Boolean(res.ok);
  } catch {
    return false;
  }
}

export async function openAndroidBatteryOptimizationSettings(): Promise<boolean> {
  const plugin = getNativePlugin();
  if (!plugin?.openBatteryOptimizationSettings) return false;
  try {
    const res = await plugin.openBatteryOptimizationSettings();
    return Boolean(res.ok);
  } catch {
    return false;
  }
}

export async function openAndroidAppInfoSettings(): Promise<boolean> {
  const plugin = getNativePlugin();
  if (!plugin?.openAppInfoSettings) return false;
  try {
    const res = await plugin.openAppInfoSettings();
    return Boolean(res.ok);
  } catch {
    return false;
  }
}

export async function requestIgnoreBatteryOptimizationAndroid(): Promise<{ ok: boolean; unrestricted?: boolean }> {
  const plugin = getNativePlugin();
  if (!plugin?.requestIgnoreBatteryOptimization) {
    return { ok: false, unrestricted: false };
  }
  try {
    return await plugin.requestIgnoreBatteryOptimization();
  } catch {
    return { ok: false, unrestricted: false };
  }
}

export async function getNativeBackgroundStatus(): Promise<{
  ok: boolean;
  running: boolean;
  wakeEnabled: boolean;
  batteryUnrestricted: boolean;
} | null> {
  const plugin = getNativePlugin();
  if (!plugin?.getBackgroundStatus) return null;
  try {
    return await plugin.getBackgroundStatus();
  } catch {
    return null;
  }
}

export async function getNativePhoneNotifications(): Promise<{
  available: boolean;
  listenerEnabled: boolean;
  notifications: NativeNotificationItem[];
}> {
  const plugin = getNativePlugin();
  if (!plugin) {
    return { available: false, listenerEnabled: false, notifications: [] };
  }
  try {
    const res = await plugin.getNotifications();
    return { available: true, listenerEnabled: res.listenerEnabled, notifications: res.notifications || [] };
  } catch {
    return { available: true, listenerEnabled: false, notifications: [] };
  }
}

export async function replyToPhoneNotification(
  key: string,
  replyText: string
): Promise<{ ok: boolean; message: string }> {
  const plugin = getNativePlugin();
  if (!plugin) {
    return { ok: false, message: "Native APK Notification Access required for direct app replies." };
  }
  try {
    return await plugin.replyToNotification({ key, replyText });
  } catch (e: any) {
    return { ok: false, message: e?.message || "Reply failed" };
  }
}

export async function getNativeCallLogs(): Promise<NativeCallLogItem[]> {
  const plugin = getNativePlugin();
  if (!plugin) return [];
  try {
    const res = await plugin.getCallLogs();
    return res.calls || [];
  } catch {
    return [];
  }
}

export async function getNativeSmsMessages(): Promise<NativeSmsItem[]> {
  const plugin = getNativePlugin();
  if (!plugin) return [];
  try {
    const res = await plugin.getSmsMessages();
    return res.messages || [];
  } catch {
    return [];
  }
}

export async function sendNativeSms(phone: string, message: string): Promise<{ ok: boolean; message: string }> {
  const plugin = getNativePlugin();
  if (!plugin) {
    return { ok: false, message: "Native Android APK permission required to send SMS directly." };
  }
  try {
    return await plugin.sendSms({ phone, message });
  } catch (e: any) {
    return { ok: false, message: e?.message || "Failed to send SMS" };
  }
}

export async function setNativeBackgroundWakeService(
  enabled: boolean,
  phrases: string[] = ["wake up jarvis", "hi jarvis", "wasu", "wasi ki jan"]
): Promise<{ ok: boolean; active: boolean; message: string }> {
  const plugin = getNativePlugin();
  if (!plugin) {
    return {
      ok: false,
      active: false,
      message: "Browser mode cannot keep background services active after closing. Run the Wasu's Jarvis Android APK for Always-On background execution.",
    };
  }
  try {
    return await plugin.setBackgroundWakeService({ enabled, phrases });
  } catch (e: any) {
    return { ok: false, active: false, message: e?.message || "Could not start background wake service" };
  }
}

export async function openAndroidNotificationAccessSettings(): Promise<boolean> {
  const plugin = getNativePlugin();
  if (!plugin) return false;
  try {
    const res = await plugin.openNotificationAccessSettings();
    return res.ok;
  } catch {
    return false;
  }
}

export async function getAndroidPermissionStatus(): Promise<AndroidPermissionStatus | null> {
  const plugin = getNativePlugin();
  if (!plugin?.getPermissionStatus) return null;
  try {
    return await plugin.getPermissionStatus();
  } catch {
    return null;
  }
}

export async function requestMicPermissionAndroid(): Promise<boolean> {
  const plugin = getNativePlugin();
  if (!plugin) return false;
  try {
    if (plugin.requestMicPermission) {
      const res = await plugin.requestMicPermission();
      return Boolean(res?.granted || res?.ok);
    }
    const res = await plugin.requestAllPermissions();
    return Boolean(res?.mic);
  } catch {
    return false;
  }
}

export async function requestCorePermissionsAndroid(): Promise<AndroidPermissionStatus | null> {
  const plugin = getNativePlugin();
  if (!plugin) return null;
  try {
    if (plugin.requestCorePermissions) {
      return await plugin.requestCorePermissions();
    }
    return await plugin.requestAllPermissions();
  } catch {
    return null;
  }
}

export async function requestCommsPermissionsAndroid(): Promise<AndroidPermissionStatus | null> {
  const plugin = getNativePlugin();
  if (!plugin?.requestCommsPermissions) return null;
  try {
    return await plugin.requestCommsPermissions();
  } catch {
    return null;
  }
}

export async function requestAndroidNativePermissions(): Promise<{ ok: boolean; mic: boolean; phone: boolean; sms: boolean }> {
  const plugin = getNativePlugin();
  if (!plugin) return { ok: false, mic: false, phone: false, sms: false };
  try {
    return await plugin.requestAllPermissions();
  } catch {
    return { ok: false, mic: false, phone: false, sms: false };
  }
}

export async function speakNativeAndroid(opts: {
  text: string;
  lang: LanguageCode;
  gender: "male" | "female";
  pitch?: number;
  rate?: number;
}): Promise<boolean> {
  const plugin = getNativePlugin();
  if (!plugin?.speakNative) return false;
  try {
    const res = await plugin.speakNative(opts);
    return Boolean(res?.ok);
  } catch {
    return false;
  }
}

export async function stopNativeAndroidSpeech(): Promise<void> {
  const plugin = getNativePlugin();
  if (!plugin?.stopNativeSpeech) return;
  try {
    await plugin.stopNativeSpeech();
  } catch {}
}

export async function startNativeAndroidListening(
  lang: LanguageCode
): Promise<{ ok: boolean; needsMicPermission?: boolean; message?: string }> {
  const plugin = getNativePlugin();
  if (!plugin?.startNativeListening) {
    return { ok: false, message: "Native speech engine unavailable." };
  }
  try {
    return await plugin.startNativeListening({ lang });
  } catch (e: any) {
    return { ok: false, message: e?.message || "Failed to start native mic" };
  }
}

export async function stopNativeAndroidListening(): Promise<void> {
  const plugin = getNativePlugin();
  if (!plugin?.stopNativeListening) return;
  try {
    await plugin.stopNativeListening();
  } catch {}
}

export async function cancelNativeAndroidListening(): Promise<void> {
  const plugin = getNativePlugin();
  if (!plugin?.cancelNativeListening) return;
  try {
    await plugin.cancelNativeListening();
  } catch {}
}

export async function setNativeAndroidWakeWord(
  enabled: boolean,
  phrases: string[]
): Promise<{ ok: boolean; active: boolean }> {
  const plugin = getNativePlugin();
  if (!plugin?.setNativeWakeWordEnabled) return { ok: false, active: false };
  try {
    return await plugin.setNativeWakeWordEnabled({ enabled, phrases });
  } catch {
    return { ok: false, active: false };
  }
}

export function subscribeNativeSpeechEvents(handlers: NativeSpeechEventHandlers): () => void {
  const plugin = getNativePlugin();
  if (!plugin?.addListener) return () => {};

  const handles = [
    plugin.addListener("nativeSpeechStart", () => handlers.onStart?.()),
    plugin.addListener("nativeSpeechPartial", (d) => {
      if (d?.text) handlers.onPartial?.(String(d.text));
    }),
    plugin.addListener("nativeSpeechResult", (d) => {
      if (d?.text) handlers.onResult?.(String(d.text));
    }),
    plugin.addListener("nativeSpeechRms", (d) => {
      if (typeof d?.level === "number") handlers.onRms?.(d.level);
    }),
    plugin.addListener("nativeSpeechError", (d) => {
      handlers.onError?.(d?.message || "Voice detect nahi hui, dobara bolein.", d?.code);
    }),
    plugin.addListener("nativeSpeechEnd", () => handlers.onEnd?.()),
    plugin.addListener("nativeTtsStart", () => handlers.onTtsStart?.()),
    plugin.addListener("nativeTtsDone", () => handlers.onTtsDone?.()),
    plugin.addListener("nativeWakeStatus", (d) => {
      handlers.onWakeStatus?.(Boolean(d?.active), d?.status || "");
    }),
    plugin.addListener("nativePermissionsChanged", (d) => {
      if (d) handlers.onPermissionsChanged?.(d as AndroidPermissionStatus);
    }),
  ];

  return () => {
    for (const h of handles) {
      try {
        h?.remove();
      } catch {}
    }
  };
}

export function subscribeNativeEvents(
  onWakeTriggered: (phrase: string, trailingCommand?: string) => void,
  onNotificationReceived: (notif: NativeNotificationItem) => void
): () => void {
  const plugin = getNativePlugin();
  if (!plugin?.addListener) return () => {};

  const h1 = plugin.addListener("wakeWordTriggered", (data) => {
    onWakeTriggered(data?.phrase || "hi jarvis", data?.trailingCommand || "");
  });
  const h2 = plugin.addListener("nativeNotificationReceived", (data) => {
    if (data) onNotificationReceived(data as NativeNotificationItem);
  });

  return () => {
    try {
      h1?.remove();
    } catch {}
    try {
      h2?.remove();
    } catch {}
  };
}
