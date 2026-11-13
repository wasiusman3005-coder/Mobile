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

interface QNexusPluginInterface {
  getDeviceTelemetry(): Promise<NativeDeviceTelemetry>;
  verifyBiometric(opts: { title: string; subtitle: string }): Promise<{ ok: boolean; message: string }>;
  getNotifications(): Promise<{ notifications: NativeNotificationItem[]; listenerEnabled: boolean }>;
  replyToNotification(opts: { key: string; replyText: string }): Promise<{ ok: boolean; message: string }>;
  getCallLogs(): Promise<{ calls: NativeCallLogItem[] }>;
  getSmsMessages(): Promise<{ messages: NativeSmsItem[] }>;
  sendSms(opts: { phone: string; message: string }): Promise<{ ok: boolean; message: string }>;
  setBackgroundWakeService(opts: { enabled: boolean; phrases?: string[] }): Promise<{ ok: boolean; active: boolean; message: string }>;
  openNotificationAccessSettings(): Promise<{ ok: boolean }>;
  requestAllPermissions(): Promise<{ ok: boolean; mic: boolean; phone: boolean; sms: boolean }>;
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
  title = "Q-NEXUS Biometric Unlock",
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
  phrases: string[] = ["wake up jarvis", "hi jarvis", "hi nexus", "hello zoya"]
): Promise<{ ok: boolean; active: boolean; message: string }> {
  const plugin = getNativePlugin();
  if (!plugin) {
    return {
      ok: false,
      active: false,
      message: "Chrome browsers cannot run mic services after closing. Install the Q-NEXUS Android APK for Always-On background 'Wake up Jarvis'.",
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

export async function requestAndroidNativePermissions(): Promise<{ ok: boolean; mic: boolean; phone: boolean; sms: boolean }> {
  const plugin = getNativePlugin();
  if (!plugin) return { ok: false, mic: false, phone: false, sms: false };
  try {
    return await plugin.requestAllPermissions();
  } catch {
    return { ok: false, mic: false, phone: false, sms: false };
  }
}

export function subscribeNativeEvents(
  onWakeTriggered: (phrase: string) => void,
  onNotificationReceived: (notif: NativeNotificationItem) => void
): () => void {
  const plugin = getNativePlugin();
  if (!plugin?.addListener) return () => {};

  const h1 = plugin.addListener("wakeWordTriggered", (data) => {
    onWakeTriggered(data?.phrase || "wake up jarvis");
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
