/**
 * Client-side image cache so battle sprites can be drawn from the real
 * character artwork (painted PNG portraits or generated SVG portraits).
 * Returns null until an image has finished decoding — callers fall back to the
 * vector sprite so nothing ever renders blank or stretched.
 */

const cache = new Map<string, HTMLImageElement>();

export function getSpriteImage(src?: string | null): HTMLImageElement | null {
  if (!src) return null;
  if (typeof window === "undefined") return null;

  let img = cache.get(src);
  if (!img) {
    img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.src = src;
    cache.set(src, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

/** Warm the cache before a battle starts (heroes, enemies, boss). */
export function preloadSprites(srcs: Array<string | undefined | null>) {
  srcs.forEach((s) => {
    if (s) getSpriteImage(s);
  });
}

export interface PortraitCrop {
  /** normalized center-x of the face inside the source image (0..1) */
  u: number;
  /** normalized center-y of the face inside the source image (0..1) */
  v: number;
  /** normalized radius of the face crop relative to image width (0..0.5) */
  r: number;
}

/** Tight head crop for painted/vector hero portraits */
export const HERO_CROP: PortraitCrop = { u: 0.5, v: 0.395, r: 0.235 };

/** Wider crop for monster / boss portraits (face fills more of the frame) */
export const MONSTER_CROP: PortraitCrop = { u: 0.5, v: 0.46, r: 0.3 };
