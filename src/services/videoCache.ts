// Sequential In-Memory Blob Cache for Zero-Stutter Background Video Loops

export const HUB_LIVE_VIDEOS = [
  "/assets/aistudio/gemini_generated_video_77029aae_66787b62.mp4",
  "/assets/aistudio/1_73e6d4cd.mp4",
  "/assets/aistudio/2_f462292e.mp4",
  "/assets/aistudio/3_7bd03cf9.mp4",
] as const;

const blobUrlMap = new Map<string, string>();
const inflightMap = new Map<string, Promise<string>>();

export function getCachedVideoSrc(url: string): string {
  return blobUrlMap.get(url) || url;
}

export function isVideoCached(url: string): boolean {
  return blobUrlMap.has(url);
}

export async function preloadVideoBlob(url: string): Promise<string> {
  const existing = blobUrlMap.get(url);
  if (existing) return existing;

  const inflight = inflightMap.get(url);
  if (inflight) return inflight;

  const task = (async () => {
    try {
      const res = await fetch(url, { cache: "force-cache" });
      if (!res.ok) return url;
      const blob = await res.blob();
      if (!blob || blob.size < 10000) return url;
      const objUrl = URL.createObjectURL(blob);
      blobUrlMap.set(url, objUrl);
      return objUrl;
    } catch {
      return url;
    } finally {
      inflightMap.delete(url);
    }
  })();

  inflightMap.set(url, task);
  return task;
}

/**
 * Sequentially caches all background videos into browser RAM one at a time,
 * preventing simultaneous multi-stream network bottlenecks on Main Cockpit entry.
 */
export function startSequentialHubWarmup(initialDelayMs = 1600): () => void {
  let cancelled = false;
  const timer = setTimeout(async () => {
    for (const url of HUB_LIVE_VIDEOS) {
      if (cancelled) return;
      if (!blobUrlMap.has(url)) {
        await preloadVideoBlob(url);
        // Yield briefly between clips so UI & TTS threads stay silky smooth
        await new Promise((r) => setTimeout(r, 250));
      }
    }
  }, initialDelayMs);

  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
}
