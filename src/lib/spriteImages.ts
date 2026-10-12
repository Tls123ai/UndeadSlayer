/** Shared browser image cache. The loading screen awaits decoding before combat
 * mounts; synchronous callers can still fall back to their vector sprites. */
const cache = new Map<string, HTMLImageElement>();

function cachedImage(src: string, retryFailed = false): HTMLImageElement | null {
  if (typeof window === "undefined") return null;
  let img = cache.get(src);
  if (retryFailed && img?.complete && img.naturalWidth === 0) {
    cache.delete(src);
    img = undefined;
  }
  if (!img) {
    img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    cache.set(src, img);
    img.src = src;
  }
  return img;
}

export function getSpriteImage(src?: string | null): HTMLImageElement | null {
  if (!src) return null;
  const img = cachedImage(src);
  return img?.complete && img.naturalWidth > 0 ? img : null;
}

/** Fire-and-forget warmup, used by existing canvas renderers. */
export function preloadSprites(srcs: Array<string | undefined | null>) {
  srcs.forEach((src) => { if (src) cachedImage(src); });
}

function waitForImage(img: HTMLImageElement, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      clearTimeout(timeout);
      img.removeEventListener("load", loaded);
      img.removeEventListener("error", failed);
      signal?.removeEventListener("abort", aborted);
    };
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve();
    };
    const failed = () => finish(new Error("Some realm artwork could not be loaded. Please try again."));
    const aborted = () => finish(new DOMException("Loading was cancelled.", "AbortError"));
    const loaded = () => {
      if (!img.naturalWidth) { failed(); return; }
      // A network load alone does not mean the image is ready for a canvas frame.
      void img.decode().then(() => finish(), failed);
    };
    const timeout = setTimeout(() => finish(new Error("Realm artwork is taking too long to load. Please try again.")), 10_000);
    img.addEventListener("load", loaded);
    img.addEventListener("error", failed);
    signal?.addEventListener("abort", aborted, { once: true });
    if (signal?.aborted) aborted();
    else if (img.complete) loaded();
  });
}

/** Deduplicated, bounded, cancellable loading with real completion counts. */
export async function preloadSpritesAsync(
  srcs: Array<string | undefined | null>,
  onProgress?: (completed: number, total: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (typeof window === "undefined") return;
  const unique = [...new Set(srcs.filter((src): src is string => !!src))];
  let completed = 0;
  onProgress?.(0, unique.length);
  await Promise.all(unique.map(async (src) => {
    const img = cachedImage(src, true)!;
    await waitForImage(img, signal);
    completed += 1;
    onProgress?.(completed, unique.length);
  }));
}

export interface PortraitCrop {
  /** normalized center-x of the face inside the source image (0..1) */
  u: number;
  /** normalized center-y of the face inside the source image (0..1) */
  v: number;
  /** normalized radius of the face crop relative to image width (0..0.5) */
  r: number;
}

export const HERO_CROP: PortraitCrop = { u: 0.5, v: 0.395, r: 0.235 };
export const MONSTER_CROP: PortraitCrop = { u: 0.5, v: 0.46, r: 0.3 };
