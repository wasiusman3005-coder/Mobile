import { getNativeDeviceTelemetry, isNativeAndroidApk } from "./nativeAndroidBridge";

export interface SystemDiskInfo {
  drive: string;
  totalGb: number;
  freeGb: number;
  usedGb: number;
}

export interface SystemTelemetry {
  realHost: boolean;
  hostname: string;
  username: string;
  platform: string;
  arch: string;
  osCaption: string;
  uptimeMinutes: number;
  cpuModel: string;
  cpuCores: number;
  cpuSpeedGhz: number;
  cpuUsagePercent: number;
  gpuName: string;
  gpuVramGb: number | null;
  ramTotalGb: number;
  ramUsedGb: number;
  ramPercent: number;
  disks: SystemDiskInfo[];
  primaryDisk: SystemDiskInfo;
  batteryPercent: number | null;
  isCharging: boolean | null;
  ipAddress: string;
  netInterface: string;
  runningApps: Record<string, boolean>;
  timestamp: number;
}

export interface HostFileEntry {
  name: string;
  type: "video" | "image" | "audio" | "document" | "code" | "archive";
  size: string;
  path: string;
  fullPath: string;
  suggestedFolder: string;
}

export interface PhoneHardwareTelemetry {
  isMobileDevice: boolean;
  isNativeApk: boolean;
  deviceName: string;
  osLabel: string;
  cpuThreads: number;
  gpuRenderer: string;
  ramApproxGb: number | null;
  ramFreeMb: number | null;
  storageTotalGb: number | null;
  storageAvailGb: number | null;
  batteryPercent: number | null;
  isCharging: boolean | null;
  batteryTempC: number | null;
  networkType: string;
  downlinkMbps: number | null;
  rttMs: number | null;
  screenResolution: string;
  viewportResolution: string;
  pixelRatio: number;
  touchPoints: number;
  cameraCount: number;
  micCount: number;
  timezone: string;
  locale: string;
  online: boolean;
  inIframeWrapper: boolean;
}

export interface MobileConnectInfo {
  ok: boolean;
  hostname: string;
  ipAddress: string;
  netInterface: string;
  port: number;
  lanUrl: string;
  allLanIps: { iface: string; ip: string }[];
}

const REMOTE_PC_URL_KEY = "q_nexus_remote_pc_url";

export function getRemotePcUrl(): string {
  try {
    return (localStorage.getItem(REMOTE_PC_URL_KEY) || "").trim().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

export function setRemotePcUrl(url: string): void {
  try {
    const clean = url.trim().replace(/\/+$/, "");
    if (!clean) {
      localStorage.removeItem(REMOTE_PC_URL_KEY);
    } else {
      localStorage.setItem(REMOTE_PC_URL_KEY, clean);
    }
  } catch {}
}

function resolveSystemEndpoint(path: string): string {
  const remote = getRemotePcUrl();
  if (remote) {
    return `${remote}${path}`;
  }
  return path;
}

let cachedGpuRenderer: string | null = null;
function detectWebGlGpu(): string {
  if (cachedGpuRenderer) return cachedGpuRenderer;
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (gl) {
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      if (ext) {
        const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
        if (renderer && typeof renderer === "string") {
          cachedGpuRenderer = renderer.replace(/^ANGLE \(([^)]+)\)$/i, "$1").trim();
          return cachedGpuRenderer;
        }
      }
      const basic = gl.getParameter(gl.RENDERER);
      if (basic) {
        cachedGpuRenderer = String(basic);
        return cachedGpuRenderer;
      }
    }
  } catch {}
  cachedGpuRenderer = "Hardware GPU";
  return cachedGpuRenderer;
}

export async function readPhoneHardwareTelemetry(): Promise<PhoneHardwareTelemetry> {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      isMobileDevice: true,
      isNativeApk: false,
      deviceName: "Smartphone",
      osLabel: "Mobile OS",
      cpuThreads: 8,
      gpuRenderer: "Mobile GPU",
      ramApproxGb: null,
      ramFreeMb: null,
      storageTotalGb: null,
      storageAvailGb: null,
      batteryPercent: null,
      isCharging: null,
      batteryTempC: null,
      networkType: "ONLINE",
      downlinkMbps: null,
      rttMs: null,
      screenResolution: "1080×2400",
      viewportResolution: "390×844",
      pixelRatio: 3,
      touchPoints: 5,
      cameraCount: 0,
      micCount: 0,
      timezone: "Asia/Karachi",
      locale: "en-US",
      online: true,
      inIframeWrapper: false,
    };
  }

  const ua = navigator.userAgent || "";
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isMobileDevice = isAndroid || isIOS || navigator.maxTouchPoints > 0 || window.innerWidth < 900;
  const nativeApk = isNativeAndroidApk();

  let osLabel = navigator.platform || "Device OS";
  let deviceName = isIOS ? "Apple iPhone" : isAndroid ? "Android Phone" : "Mobile / Web Device";

  // 1) Try Modern Chrome High-Entropy Client Hints (exposes REAL Android model & OS version!)
  const navAny = navigator as any;
  if (navAny.userAgentData) {
    try {
      const hints = await navAny.userAgentData.getHighEntropyValues(["model", "platform", "platformVersion"]);
      if (hints?.model && String(hints.model).trim()) {
        deviceName = String(hints.model).trim();
      }
      if (hints?.platform) {
        const ver = hints.platformVersion ? String(hints.platformVersion).split(".")[0] : "";
        osLabel = `${hints.platform}${ver ? ` ${ver}` : ""}`;
      }
    } catch {}
  }

  // Fallback UA parsing if high-entropy unavailable
  if (deviceName === "Android Phone" && isAndroid) {
    const verMatch = ua.match(/Android\s+([\d.]+)/i);
    if (verMatch && osLabel === (navigator.platform || "Device OS")) {
      osLabel = `Android ${verMatch[1]}`;
    }
    const modelMatch = ua.match(/Android[^;]+;\s*([^)]+)\)/i);
    if (modelMatch && modelMatch[1]) {
      const cleaned = modelMatch[1].replace(/Build\/.*$/i, "").trim();
      if (cleaned && cleaned.toLowerCase() !== "k") {
        deviceName = cleaned;
      }
    }
  } else if (isIOS) {
    const iosMatch = ua.match(/OS\s+([\d_]+)/i);
    osLabel = `iOS ${iosMatch ? iosMatch[1].replace(/_/g, ".") : ""}`.trim();
    deviceName = /iPad/i.test(ua) ? "Apple iPad" : "Apple iPhone";
  }

  // 2) Live Browser Battery API
  let batteryPercent: number | null = null;
  let isCharging: boolean | null = null;
  let batteryTempC: number | null = null;
  try {
    if (typeof navAny.getBattery === "function") {
      const bat = await navAny.getBattery();
      if (bat && typeof bat.level === "number") {
        batteryPercent = Math.round(bat.level * 100);
        isCharging = Boolean(bat.charging);
      }
    }
  } catch {}

  // 3) Live Network API
  const conn = navAny.connection || navAny.mozConnection || navAny.webkitConnection;
  const connTypeRaw = conn?.type ? String(conn.type).toUpperCase() : "";
  const effectiveRaw = conn?.effectiveType ? String(conn.effectiveType).toUpperCase() : "";
  const networkType = navigator.onLine
    ? [connTypeRaw, effectiveRaw].filter(Boolean).join(" • ") || "ONLINE"
    : "OFFLINE";
  const downlinkMbps = typeof conn?.downlink === "number" ? conn.downlink : null;
  const rttMs = typeof conn?.rtt === "number" ? conn.rtt : null;

  // 4) Live RAM & Storage Quota (browser estimate)
  let ramApproxGb: number | null = typeof navAny.deviceMemory === "number" ? navAny.deviceMemory : null;
  let ramFreeMb: number | null = null;
  let storageTotalGb: number | null = null;
  let storageAvailGb: number | null = null;

  try {
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      if (typeof est.quota === "number") {
        storageTotalGb = parseFloat((est.quota / (1024 * 1024 * 1024)).toFixed(1));
        const avail = est.quota - (est.usage || 0);
        storageAvailGb = parseFloat((avail / (1024 * 1024 * 1024)).toFixed(1));
      }
    }
  } catch {}

  // 5) Real Native APK Hardware Override (exact Manufacturer/Model, exact RAM/Storage GB, Temp)
  const nativeTel = await getNativeDeviceTelemetry();
  if (nativeTel) {
    deviceName = `${nativeTel.manufacturer} ${nativeTel.model}`.trim();
    osLabel = `Android ${nativeTel.androidVersion} (SDK ${nativeTel.sdkInt})`;
    ramApproxGb = parseFloat((nativeTel.totalRamMb / 1024).toFixed(1));
    ramFreeMb = nativeTel.availRamMb;
    storageTotalGb = nativeTel.totalStorageGb;
    storageAvailGb = nativeTel.availStorageGb;
    batteryPercent = nativeTel.batteryPercent;
    isCharging = nativeTel.isCharging;
    batteryTempC = nativeTel.batteryTempC;
  }

  // 6) Real Camera & Mic Sensors count
  let cameraCount = 0;
  let micCount = 0;
  try {
    if (navigator.mediaDevices?.enumerateDevices) {
      const devs = await navigator.mediaDevices.enumerateDevices();
      cameraCount = devs.filter((d) => d.kind === "videoinput").length;
      micCount = devs.filter((d) => d.kind === "audioinput").length;
    }
  } catch {}

  const cpuThreads = navigator.hardwareConcurrency || 4;
  const dpr = parseFloat((window.devicePixelRatio || 1).toFixed(2));
  const w = Math.round(window.screen.width * dpr);
  const h = Math.round(window.screen.height * dpr);

  let inIframeWrapper = false;
  try {
    inIframeWrapper = window.self !== window.top;
  } catch {
    inIframeWrapper = true;
  }

  return {
    isMobileDevice,
    isNativeApk: nativeApk,
    deviceName,
    osLabel,
    cpuThreads,
    gpuRenderer: detectWebGlGpu(),
    ramApproxGb,
    ramFreeMb,
    storageTotalGb,
    storageAvailGb,
    batteryPercent,
    isCharging,
    batteryTempC,
    networkType,
    downlinkMbps,
    rttMs,
    screenResolution: `${w}×${h}`,
    viewportResolution: `${window.innerWidth}×${window.innerHeight}`,
    pixelRatio: dpr,
    touchPoints: navigator.maxTouchPoints || 0,
    cameraCount,
    micCount,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Local",
    locale: navigator.language || "en-US",
    online: navigator.onLine,
    inIframeWrapper,
  };
}

export async function fetchSystemTelemetry(): Promise<SystemTelemetry | null> {
  try {
    const res = await fetch(resolveSystemEndpoint("/api/system/telemetry"), { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as SystemTelemetry;
    return data && data.realHost === true ? data : null;
  } catch {
    return null;
  }
}

export async function fetchMobileConnectInfo(): Promise<MobileConnectInfo | null> {
  try {
    const res = await fetch(resolveSystemEndpoint("/api/system/mobile-connect"), { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as MobileConnectInfo;
    return data && data.ok ? data : null;
  } catch {
    return null;
  }
}

export async function fetchSystemFiles(): Promise<HostFileEntry[]> {
  try {
    const res = await fetch(resolveSystemEndpoint("/api/system/files"), { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.files) ? data.files : [];
  } catch {
    return [];
  }
}

export async function organizeSystemFiles(): Promise<{ moved: number; files: HostFileEntry[] }> {
  const res = await fetch(resolveSystemEndpoint("/api/system/organize-files"), { method: "POST" });
  if (!res.ok) throw new Error("Failed to organize files");
  return await res.json();
}

export async function launchSystemApp(appName: string): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(resolveSystemEndpoint("/api/system/launch-app"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appName }),
  });
  return await res.json();
}
