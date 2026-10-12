/** The same integer-pixel brush works on a canvas and in server-rendered SVGs. */
export type PixelPainter = Pick<CanvasRenderingContext2D, "fillStyle" | "fillRect">;

export const PIXEL_SCALE = 2;

export function pixelRect(p: PixelPainter, x: number, y: number, w: number, h: number, color: string) {
  p.fillStyle = color;
  p.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
}

/** Deliberately flat, limited-palette shading, never a gradient or blur. */
export function pixelShade(hex: string, amount: number): string {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  if (Number.isNaN(value)) return hex;
  return `#${[value >> 16, (value >> 8) & 255, value & 255]
    .map((channel) => Math.max(0, Math.min(255, channel + amount)).toString(16).padStart(2, "0")).join("")}`;
}

/** SVG has an actual 40x40 intrinsic resolution; CSS nearest-neighbour enlarges it. */
export function pixelPortraitSvg(draw: (p: PixelPainter) => void, background: string, accent: string): string {
  const pixels: string[] = [];
  const painter: PixelPainter = {
    fillStyle: background,
    fillRect(x, y, w, h) {
      pixels.push(`<rect x="${Math.round(x)}" y="${Math.round(y)}" width="${Math.max(1, Math.round(w))}" height="${Math.max(1, Math.round(h))}" fill="${this.fillStyle}"/>`);
    },
  };
  pixelRect(painter, 0, 0, 40, 40, background);
  // Dithered backdrop, a tiled floor, and hard-edged frame.
  for (let y = 3; y < 32; y += 4) for (let x = 3; x < 38; x += 4) {
    if (((x + y) / 4 | 0) % 3 === 0) pixelRect(painter, x, y, 1, 1, pixelShade(background, 12));
  }
  pixelRect(painter, 1, 34, 38, 5, pixelShade(background, -8));
  for (let x = 2; x < 39; x += 5) pixelRect(painter, x, 36, 3, 1, pixelShade(background, 14));
  draw(painter);
  pixelRect(painter, 0, 0, 40, 1, accent);
  pixelRect(painter, 0, 0, 1, 40, accent);
  pixelRect(painter, 39, 0, 1, 40, pixelShade(accent, -45));
  pixelRect(painter, 0, 39, 40, 1, pixelShade(accent, -45));
  return `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40" shape-rendering="crispEdges">${pixels.join("")}</svg>`)}`;
}
