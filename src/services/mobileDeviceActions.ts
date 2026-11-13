export interface PhoneStorageStats {
  usedMb: number;
  quotaGb: number;
  percentUsed: number;
}

export interface MobileVaultFile {
  id: string;
  name: string;
  type: "video" | "image" | "audio" | "document" | "archive" | "code";
  size: string;
  folder: string;
  mimeType: string;
  addedAt: string;
}

const MOBILE_VAULT_FILES_KEY = "q_nexus_mobile_vault_files";

export function triggerHaptic(pattern: number | number[] = [25, 30, 45]): boolean {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      return navigator.vibrate(pattern);
    }
  } catch {}
  return false;
}

let activeWakeLock: any = null;

export async function toggleScreenWakeLock(enable: boolean): Promise<boolean> {
  try {
    const navAny = navigator as any;
    if (!navAny.wakeLock) return false;
    if (enable) {
      activeWakeLock = await navAny.wakeLock.request("screen");
      return true;
    } else if (activeWakeLock) {
      await activeWakeLock.release();
      activeWakeLock = null;
      return false;
    }
  } catch {}
  return false;
}

export async function getPhoneStorageStats(): Promise<PhoneStorageStats> {
  try {
    if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      const usage = est.usage || 0;
      const quota = est.quota || 1024 * 1024 * 1024;
      const usedMb = parseFloat((usage / (1024 * 1024)).toFixed(1));
      const quotaGb = parseFloat((quota / (1024 * 1024 * 1024)).toFixed(1));
      const percentUsed = Math.min(100, Math.max(0.1, parseFloat(((usage / Math.max(quota, 1)) * 100).toFixed(1))));
      return { usedMb, quotaGb, percentUsed };
    }
  } catch {}
  return { usedMb: 18.4, quotaGb: 64, percentUsed: 1 };
}

let torchStream: MediaStream | null = null;

export async function togglePhoneFlashlight(enable: boolean): Promise<{ ok: boolean; active: boolean; message: string }> {
  try {
    if (!enable) {
      if (torchStream) {
        torchStream.getTracks().forEach((t) => t.stop());
        torchStream = null;
      }
      return { ok: true, active: false, message: "Phone Flashlight turned OFF." };
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      return { ok: false, active: false, message: "Camera torch API not available on this browser." };
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
    });
    const track = stream.getVideoTracks()[0];
    const caps = (track.getCapabilities?.() || {}) as any;

    if (caps.torch) {
      await track.applyConstraints({ advanced: [{ torch: true } as any] });
      torchStream = stream;
      return { ok: true, active: true, message: "Phone Flashlight ON!" };
    } else {
      stream.getTracks().forEach((t) => t.stop());
      return { ok: false, active: false, message: "Torch hardware control is restricted by this browser/device." };
    }
  } catch {
    return { ok: false, active: false, message: "Allow camera permission on phone to toggle flashlight." };
  }
}

export async function shareViaPhone(title: string, text: string, url?: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      await navigator.share({
        title,
        text,
        url: url || window.location.href,
      });
      return true;
    }
  } catch {}
  return false;
}

export function getCurrentPhoneLocation(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

function classifyMobileFile(name: string, mime: string): { type: MobileVaultFile["type"]; folder: string } {
  const lower = name.toLowerCase();
  if (mime.startsWith("image/") || /\.(jpg|jpeg|png|webp|heic|gif)$/i.test(lower)) {
    return { type: "image", folder: "Phone/Pictures" };
  }
  if (mime.startsWith("video/") || /\.(mp4|mov|mkv|webm|3gp)$/i.test(lower)) {
    return { type: "video", folder: "Phone/Videos" };
  }
  if (mime.startsWith("audio/") || /\.(mp3|wav|m4a|ogg|aac)$/i.test(lower)) {
    return { type: "audio", folder: "Phone/Voice & Audio" };
  }
  if (/\.(zip|rar|7z|apk|tar)$/i.test(lower)) {
    return { type: "archive", folder: "Phone/Downloads & APK" };
  }
  if (/\.(ts|tsx|js|py|json|html|css)$/i.test(lower)) {
    return { type: "code", folder: "Phone/Scripts" };
  }
  return { type: "document", folder: "Phone/Documents" };
}

export function formatMobileBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function loadMobileVaultFiles(): MobileVaultFile[] {
  try {
    const raw = localStorage.getItem(MOBILE_VAULT_FILES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function saveMobileVaultFiles(files: MobileVaultFile[]): void {
  try {
    localStorage.setItem(MOBILE_VAULT_FILES_KEY, JSON.stringify(files));
  } catch {}
}

export function ingestPickedMobileFiles(fileList: FileList): MobileVaultFile[] {
  const existing = loadMobileVaultFiles();
  const added: MobileVaultFile[] = [];
  for (let i = 0; i < fileList.length; i++) {
    const f = fileList[i];
    const { type, folder } = classifyMobileFile(f.name, f.type);
    added.push({
      id: `mf-${Date.now()}-${i}`,
      name: f.name,
      type,
      size: formatMobileBytes(f.size),
      folder,
      mimeType: f.type || "application/octet-stream",
      addedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });
  }
  const merged = [...added, ...existing].slice(0, 60);
  saveMobileVaultFiles(merged);
  return merged;
}
