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
  callPhone?: boolean;
  contacts?: boolean;
  sms: boolean;
  notifListener: boolean;
  overlay?: boolean;
  sdkInt: number;
}

export interface NativeSpeechEventHandlers {
  onStart?: (sessionId?: number) => void;
  onPartial?: (text: string, sessionId?: number) => void;
  onResult?: (text: string, sessionId?: number) => void;
  onAudioCaptured?: (audioBase64: string, mimeType: string, sessionId?: number) => void;
  onRms?: (level: number, sessionId?: number) => void;
  onError?: (message: string, code?: number, sessionId?: number) => void;
  onEnd?: (sessionId?: number) => void;
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
  openInstalledApp?(opts: { appName: string }): Promise<{ ok: boolean; appName?: string; message: string }>;
  callPhoneContact?(opts: { target: string }): Promise<{ ok: boolean; contactName?: string; phone?: string; needsPermission?: boolean; message: string }>;
  sendWhatsAppMessage?(opts: { target: string; message: string }): Promise<{ ok: boolean; mode?: string; contactName?: string; message: string }>;
  toggleFlashlight?(opts: { enable: boolean }): Promise<{ ok: boolean; active: boolean; message: string }>;
  setAutoAnnounce?(opts: { enabled: boolean }): Promise<{ ok: boolean; enabled: boolean }>;
  openBatteryOptimizationSettings?(): Promise<{ ok: boolean }>;
  requestIgnoreBatteryOptimization?(): Promise<{ ok: boolean; unrestricted?: boolean }>;
  getOverlayPermissionStatus?(): Promise<{ ok: boolean; granted: boolean }>;
  openOverlayPermissionSettings?(): Promise<{ ok: boolean }>;
  getAccessibilityStatus?(): Promise<{ ok: boolean; enabled: boolean }>;
  openAccessibilitySettings?(): Promise<{ ok: boolean }>;
  consumePendingWakeEvent?(): Promise<{ hasPending: boolean; phrase: string; trailingCommand: string }>;
  setCloudApiBaseUrl?(opts: { url: string }): Promise<{ ok: boolean; url: string }>;
  getBackgroundStatus?(): Promise<{ ok: boolean; running: boolean; wakeEnabled: boolean; batteryUnrestricted: boolean; overlayGranted?: boolean; accessibilityEnabled?: boolean }>;
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
  startNativeListening?(opts: { lang: string; sessionId?: number; preferDialog?: boolean }): Promise<{ ok: boolean; needsMicPermission?: boolean; message?: string }>;
  startSystemVoiceDialog?(opts: { lang: string; sessionId?: number }): Promise<{ ok: boolean; needsMicPermission?: boolean; message?: string }>;
  testMicrophoneHardware?(): Promise<{
    ok: boolean;
    granted: boolean;
    hardwareReady: boolean;
    peakLevel: number;
    speechEngineAvailable?: boolean;
    message: string;
  }>;
  stopNativeListening?(): Promise<{ ok: boolean }>;
  cancelNativeListening?(): Promise<{ ok: boolean }>;
  setNativeWakeWordEnabled?(opts: { enabled: boolean; phrases?: string[] }): Promise<{ ok: boolean; active: boolean }>;
  consumePendingStudioLaunch?(): Promise<{ hasPending: boolean; target: string }>;
  applyLiveWallpaperOnPhone?(opts: {
    style: string;
    accentHex: string;
    clockHex: string;
    showClock: boolean;
    clockStyleId?: string;
    depthEnabled?: boolean;
    dimPercent?: number;
    clockPosY?: number;
  }): Promise<{ ok: boolean; message: string }>;
  applyBitmapWallpaperOnPhone?(opts: { dataUrl: string; target: "home" | "lock" | "both" }): Promise<{ ok: boolean; message: string }>;
  syncCustomMediaImage?(opts: { kind: "bio" | "wallpaper" | "charging"; dataUrl: string }): Promise<{ ok: boolean }>;
  syncOneUiOverlayConfig?(opts: {
    dynamicBarStyle: string;
    dynamicBarAnchor?: string;
    dynamicBarOffsetX?: number;
    dynamicBarOffsetY?: number;
    dynamicBarWidthDp?: number;
    dynamicBarHeightDp?: number;
    dynamicBarCameraGapPx?: number;
    dynamicBarCustomLabel?: string;
    dynamicBarShowOutsideApp?: boolean;
    dynamicBarNotifDisplayMode?: "icon_name" | "full_preview";
    dynamicBarNotifExpandSeconds?: number;
    dynamicBarEnabledAppsJson?: string;
    dynamicBarShowFlashlight?: boolean;
    dynamicBarShowMusic?: boolean;
    edgeLightingStyle?: string;
    unlockBarAnimStyle?: string;
    fingerprintAnimId?: string;
    fingerprintOnAnyWallpaper?: boolean;
    biometricUnlockAnimDisplay?: string;
    faceAnimId?: string;
    chargingAnim: string;
    chargingOverlayEnabled: boolean;
    chargingDurationSeconds?: number;
    chargingDismissMethod?: "single_tap" | "double_tap";
    chargingUnpluggedAlert?: boolean;
    chargingFullBatteryAlert?: boolean;
    chargingShowPhoto?: boolean;
    accentHex: string;
    liveWallpaperStyle: string;
    clockHex: string;
    clockStyleId?: string;
    wallpaperDepthEnabled?: boolean;
    wallpaperDimPercent?: number;
    wallpaperClockPosY?: number;
    waveVisualizerStyle?: string;
    waveColorTheme?: string;
    followUpListeningEnabled?: boolean;
    vipContactsJson?: string;
    perAppRulesJson?: string;
  }): Promise<{ ok: boolean; overlayGranted?: boolean; accessibilityEnabled?: boolean; message?: string }>;
  answerOrRejectCall?(opts: { action: "answer" | "reject" }): Promise<{ ok: boolean; message: string }>;
  getUserActivityState?(): Promise<{ ok: boolean; state: string }>;
  acknowledgeVipReminders?(): Promise<{ ok: boolean }>;
  triggerDynamicBarUnlockEffect?(opts: { method: string }): Promise<{ ok: boolean; overlayGranted?: boolean }>;
  triggerChargingOverlayTest?(): Promise<{ ok: boolean; overlayGranted?: boolean }>;
  openAndroidQuickPanel?(opts: { panel: string }): Promise<{ ok: boolean; message?: string }>;
  getInstalledLauncherApps?(): Promise<{ ok: boolean; apps: Array<{ name: string; packageName: string }> }>;
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
  overlayGranted?: boolean;
  accessibilityEnabled?: boolean;
} | null> {
  const plugin = getNativePlugin();
  if (!plugin?.getBackgroundStatus) return null;
  try {
    return await plugin.getBackgroundStatus();
  } catch {
    return null;
  }
}

export async function openInstalledAppAndroid(
  appName: string
): Promise<{ ok: boolean; appName?: string; message: string }> {
  const plugin = getNativePlugin();
  if (!plugin?.openInstalledApp) {
    return {
      ok: false,
      message: "Phone apps open karne ke liye Wasu's Jarvis Android APK install hona zaroori hai.",
    };
  }
  try {
    return await plugin.openInstalledApp({ appName });
  } catch (e: any) {
    return { ok: false, message: e?.message || "App open nahi ho saka." };
  }
}

export async function callPhoneContactAndroid(
  target: string
): Promise<{ ok: boolean; contactName?: string; phone?: string; needsPermission?: boolean; message: string }> {
  const plugin = getNativePlugin();
  if (!plugin?.callPhoneContact) {
    return {
      ok: false,
      message: "Direct voice call lagane ke liye Wasu's Jarvis Android APK mein Phone aur Contacts permission chahiye.",
    };
  }
  try {
    return await plugin.callPhoneContact({ target });
  } catch (e: any) {
    return { ok: false, message: e?.message || "Call start nahi ho saki." };
  }
}

export async function sendWhatsAppMessageAndroid(
  target: string,
  message: string
): Promise<{ ok: boolean; mode?: string; contactName?: string; message: string }> {
  const plugin = getNativePlugin();
  if (!plugin?.sendWhatsAppMessage) {
    return {
      ok: false,
      message: "WhatsApp message ya reply bhejne ke liye Android APK bridge zaroori hai.",
    };
  }
  try {
    return await plugin.sendWhatsAppMessage({ target, message });
  } catch (e: any) {
    return { ok: false, message: e?.message || "WhatsApp message send nahi ho saka." };
  }
}

export async function getOverlayPermissionStatusAndroid(): Promise<boolean> {
  const plugin = getNativePlugin();
  if (!plugin?.getOverlayPermissionStatus) return false;
  try {
    const res = await plugin.getOverlayPermissionStatus();
    return Boolean(res.granted);
  } catch {
    return false;
  }
}

export async function openOverlayPermissionSettingsAndroid(): Promise<boolean> {
  const plugin = getNativePlugin();
  if (!plugin?.openOverlayPermissionSettings) return false;
  try {
    const res = await plugin.openOverlayPermissionSettings();
    return Boolean(res.ok);
  } catch {
    return false;
  }
}

export async function getAccessibilityStatusAndroid(): Promise<boolean> {
  const plugin = getNativePlugin();
  if (!plugin?.getAccessibilityStatus) return false;
  try {
    const res = await plugin.getAccessibilityStatus();
    return Boolean(res.enabled);
  } catch {
    return false;
  }
}

export async function openAccessibilitySettingsAndroid(): Promise<boolean> {
  const plugin = getNativePlugin();
  if (!plugin?.openAccessibilitySettings) return false;
  try {
    const res = await plugin.openAccessibilitySettings();
    return Boolean(res.ok);
  } catch {
    return false;
  }
}

export async function consumePendingWakeEventAndroid(): Promise<{
  hasPending: boolean;
  phrase: string;
  trailingCommand: string;
} | null> {
  const plugin = getNativePlugin();
  if (!plugin?.consumePendingWakeEvent) return null;
  try {
    return await plugin.consumePendingWakeEvent();
  } catch {
    return null;
  }
}

export async function setNativeCloudApiUrl(url: string): Promise<boolean> {
  const plugin = getNativePlugin();
  if (!plugin?.setCloudApiBaseUrl) return false;
  try {
    const res = await plugin.setCloudApiBaseUrl({ url });
    return Boolean(res.ok);
  } catch {
    return false;
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
  lang: LanguageCode,
  sessionId?: number,
  preferDialog = false
): Promise<{ ok: boolean; needsMicPermission?: boolean; message?: string }> {
  const plugin = getNativePlugin();
  if (!plugin?.startNativeListening) {
    return { ok: false, message: "Native speech engine unavailable." };
  }
  try {
    return await plugin.startNativeListening({ lang, sessionId, preferDialog });
  } catch (e: any) {
    return { ok: false, message: e?.message || "Failed to start native mic" };
  }
}

export async function startSystemVoiceDialogAndroid(
  lang: LanguageCode,
  sessionId?: number
): Promise<{ ok: boolean; needsMicPermission?: boolean; message?: string }> {
  const plugin = getNativePlugin();
  if (!plugin?.startSystemVoiceDialog) {
    return { ok: false, message: "System voice dialog unavailable." };
  }
  try {
    return await plugin.startSystemVoiceDialog({ lang, sessionId });
  } catch (e: any) {
    return { ok: false, message: e?.message || "Failed to launch voice dialog" };
  }
}

export async function testMicrophoneHardwareAndroid(): Promise<{
  ok: boolean;
  granted: boolean;
  hardwareReady: boolean;
  peakLevel: number;
  speechEngineAvailable?: boolean;
  message: string;
}> {
  const plugin = getNativePlugin();
  if (!plugin?.testMicrophoneHardware) {
    return {
      ok: false,
      granted: false,
      hardwareReady: false,
      peakLevel: 0,
      message: "Hardware mic diagnostic sirf compiled Android APK mein chalta hai.",
    };
  }
  try {
    return await plugin.testMicrophoneHardware();
  } catch (e: any) {
    return {
      ok: false,
      granted: false,
      hardwareReady: false,
      peakLevel: 0,
      message: e?.message || "Mic test failed",
    };
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
    plugin.addListener("nativeSpeechStart", (d) => handlers.onStart?.(typeof d?.sessionId === "number" ? d.sessionId : undefined)),
    plugin.addListener("nativeSpeechPartial", (d) => {
      if (d?.text) handlers.onPartial?.(String(d.text), typeof d?.sessionId === "number" ? d.sessionId : undefined);
    }),
    plugin.addListener("nativeSpeechResult", (d) => {
      if (d?.text) handlers.onResult?.(String(d.text), typeof d?.sessionId === "number" ? d.sessionId : undefined);
    }),
    plugin.addListener("nativeSpeechAudio", (d) => {
      if (d?.audioBase64) {
        handlers.onAudioCaptured?.(
          String(d.audioBase64),
          String(d.mimeType || "audio/wav"),
          typeof d?.sessionId === "number" ? d.sessionId : undefined
        );
      }
    }),
    plugin.addListener("nativeSpeechRms", (d) => {
      if (typeof d?.level === "number") handlers.onRms?.(d.level, typeof d?.sessionId === "number" ? d.sessionId : undefined);
    }),
    plugin.addListener("nativeSpeechError", (d) => {
      handlers.onError?.(
        d?.message || "Voice detect nahi hui, dobara bolein.",
        d?.code,
        typeof d?.sessionId === "number" ? d.sessionId : undefined
      );
    }),
    plugin.addListener("nativeSpeechEnd", (d) => handlers.onEnd?.(typeof d?.sessionId === "number" ? d.sessionId : undefined)),
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

export async function consumePendingStudioLaunchAndroid(): Promise<string | null> {
  const plugin = getNativePlugin();
  if (!plugin?.consumePendingStudioLaunch) return null;
  try {
    const res = await plugin.consumePendingStudioLaunch();
    return res?.hasPending ? res.target || "oneui9" : null;
  } catch {
    return null;
  }
}

export function subscribeStudioLaunchEvent(onOpenStudio: (target: string) => void): () => void {
  const plugin = getNativePlugin();
  if (!plugin?.addListener) return () => {};
  const h = plugin.addListener("openStudioRequested", (data) => {
    onOpenStudio(data?.target || "oneui9");
  });
  return () => {
    try {
      h?.remove();
    } catch {}
  };
}

export async function applyLiveWallpaperOnPhoneAndroid(opts: {
  style: string;
  accentHex: string;
  clockHex: string;
  showClock: boolean;
  clockStyleId?: string;
  depthEnabled?: boolean;
  dimPercent?: number;
  clockPosY?: number;
}): Promise<{ ok: boolean; message: string }> {
  const plugin = getNativePlugin();
  if (!plugin?.applyLiveWallpaperOnPhone) {
    return {
      ok: false,
      message: "Live Wallpaper phone par apply karne ke liye Android APK install hona zaroori hai. Studio preview yahan live chal raha hai.",
    };
  }
  try {
    return await plugin.applyLiveWallpaperOnPhone(opts);
  } catch (e: any) {
    return { ok: false, message: e?.message || "Live wallpaper set nahi ho saka." };
  }
}

export async function applyBitmapWallpaperOnPhoneAndroid(
  dataUrl: string,
  target: "home" | "lock" | "both"
): Promise<{ ok: boolean; message: string }> {
  const plugin = getNativePlugin();
  if (!plugin?.applyBitmapWallpaperOnPhone) {
    return {
      ok: false,
      message: "Direct Home/Lock wallpaper phone par set karne ke liye Android APK install hona zaroori hai.",
    };
  }
  try {
    return await plugin.applyBitmapWallpaperOnPhone({ dataUrl, target });
  } catch (e: any) {
    return { ok: false, message: e?.message || "Wallpaper apply fail hua." };
  }
}

export async function syncCustomMediaImageAndroid(
  kind: "bio" | "wallpaper" | "charging",
  dataUrl: string
): Promise<boolean> {
  const plugin = getNativePlugin();
  if (!plugin?.syncCustomMediaImage) return false;
  try {
    const res = await plugin.syncCustomMediaImage({ kind, dataUrl });
    return Boolean(res.ok);
  } catch {
    return false;
  }
}

export async function syncOneUiOverlayConfigAndroid(opts: {
  dynamicBarStyle: string;
  dynamicBarAnchor?: string;
  dynamicBarOffsetX?: number;
  dynamicBarOffsetY?: number;
  dynamicBarWidthDp?: number;
  dynamicBarHeightDp?: number;
  dynamicBarCameraGapPx?: number;
  dynamicBarCustomLabel?: string;
  dynamicBarShowOutsideApp?: boolean;
  dynamicBarNotifDisplayMode?: "icon_name" | "full_preview";
  dynamicBarNotifExpandSeconds?: number;
  dynamicBarEnabledAppsJson?: string;
  dynamicBarShowFlashlight?: boolean;
  dynamicBarShowMusic?: boolean;
  edgeLightingStyle?: string;
  unlockBarAnimStyle?: string;
  fingerprintAnimId?: string;
  fingerprintOnAnyWallpaper?: boolean;
  biometricUnlockAnimDisplay?: string;
  faceAnimId?: string;
  chargingAnim: string;
  chargingOverlayEnabled: boolean;
  chargingDurationSeconds?: number;
  chargingDismissMethod?: "single_tap" | "double_tap";
  chargingUnpluggedAlert?: boolean;
  chargingFullBatteryAlert?: boolean;
  chargingShowPhoto?: boolean;
  accentHex: string;
  liveWallpaperStyle: string;
  clockHex: string;
  clockStyleId?: string;
  wallpaperDepthEnabled?: boolean;
  wallpaperDimPercent?: number;
  wallpaperClockPosY?: number;
  waveVisualizerStyle?: string;
  waveColorTheme?: string;
  followUpListeningEnabled?: boolean;
  vipContactsJson?: string;
  perAppRulesJson?: string;
}): Promise<{ ok: boolean; overlayGranted?: boolean; accessibilityEnabled?: boolean }> {
  const plugin = getNativePlugin();
  if (!plugin?.syncOneUiOverlayConfig) return { ok: false };
  try {
    return await plugin.syncOneUiOverlayConfig(opts);
  } catch {
    return { ok: false };
  }
}

export async function answerOrRejectCallAndroid(
  action: "answer" | "reject"
): Promise<{ ok: boolean; message: string }> {
  const plugin = getNativePlugin();
  if (!plugin?.answerOrRejectCall) {
    return {
      ok: false,
      message: "Direct Call Answer/Reject Android APK mein chalta hai.",
    };
  }
  try {
    return await plugin.answerOrRejectCall({ action });
  } catch (e: any) {
    return { ok: false, message: e?.message || "Call action failed." };
  }
}

export async function getUserActivityStateAndroid(): Promise<string> {
  const plugin = getNativePlugin();
  if (!plugin?.getUserActivityState) return "sitting_stationary";
  try {
    const res = await plugin.getUserActivityState();
    return res?.state || "sitting_stationary";
  } catch {
    return "sitting_stationary";
  }
}

export async function acknowledgeVipRemindersAndroid(): Promise<void> {
  const plugin = getNativePlugin();
  if (!plugin?.acknowledgeVipReminders) return;
  try {
    await plugin.acknowledgeVipReminders();
  } catch {}
}

export async function triggerDynamicBarUnlockEffectAndroid(method: string): Promise<void> {
  const plugin = getNativePlugin();
  if (!plugin?.triggerDynamicBarUnlockEffect) return;
  try {
    await plugin.triggerDynamicBarUnlockEffect({ method });
  } catch {}
}

export async function triggerChargingOverlayTestAndroid(): Promise<{ ok: boolean; overlayGranted?: boolean }> {
  const plugin = getNativePlugin();
  if (!plugin?.triggerChargingOverlayTest) return { ok: false };
  try {
    return await plugin.triggerChargingOverlayTest();
  } catch {
    return { ok: false };
  }
}

export function subscribeActivityAndVipEvents(
  onActivityChanged: (state: string, speedMps: number) => void,
  onVipReminder: (sender: string, text: string) => void
): () => void {
  const plugin = getNativePlugin();
  if (!plugin?.addListener) return () => {};
  const h1 = plugin.addListener("userActivityChanged", (d) => {
    if (d?.state) onActivityChanged(String(d.state), Number(d.speedMps ?? -1));
  });
  const h2 = plugin.addListener("vipReminderTriggered", (d) => {
    if (d?.sender || d?.text) onVipReminder(String(d.sender || "VIP"), String(d.text || ""));
  });
  return () => {
    try { h1?.remove(); } catch {}
    try { h2?.remove(); } catch {}
  };
}

export async function openAndroidQuickPanel(
  panel: "wifi" | "bluetooth" | "data" | "display" | "sound" | "battery" | "location" | "airplane" | "nfc"
): Promise<{ ok: boolean; message?: string }> {
  const plugin = getNativePlugin();
  if (!plugin?.openAndroidQuickPanel) {
    return {
      ok: false,
      message: "System hardware panel Android APK par direct open hota hai.",
    };
  }
  try {
    return await plugin.openAndroidQuickPanel({ panel });
  } catch (e: any) {
    return { ok: false, message: e?.message || "System panel open nahi ho saka." };
  }
}

export async function getInstalledLauncherAppsAndroid(): Promise<Array<{ name: string; packageName: string }>> {
  const plugin = getNativePlugin();
  if (!plugin?.getInstalledLauncherApps) return [];
  try {
    const res = await plugin.getInstalledLauncherApps();
    return res?.apps || [];
  } catch {
    return [];
  }
}


