import { pixelRect, pixelShade, type PixelPainter } from "./pixelPainter";

export type CreatureShape = "beast" | "spider" | "wisp" | "dragon" | "treant";
export interface CreaturePalette { body: string; dark: string; eye: string; accent: string; }

/** Distinct 32x32 creature silhouettes. Origin is the centre of the feet. */
export function drawPixelCreature(p: PixelPainter, shape: CreatureShape, c: CreaturePalette, unit = 1, frame = 0, moving = false, flash = false) {
  const bob = Math.floor(frame) % 2;
  const r = (x: number, y: number, w: number, h: number, color: string) =>
    pixelRect(p, (x - 16) * unit, (y - 32) * unit, w * unit, h * unit, flash ? "#fff4dc" : color);
  const light = pixelShade(c.body, 25);
  const step = moving ? bob : 0;
  if (shape === "spider") {
    // Eight articulated legs, plate-armoured abdomen, and six jewel eyes.
    for (let i = 0; i < 4; i++) {
      const y = 13 + i * 4;
      r(3 - step, y, 7, 2, c.dark); r(2 - step, y + 1, 2, 4, c.accent);
      r(22, y, 7 + step, 2, c.dark); r(28 + step, y + 1, 2, 4, c.accent);
    }
    r(9, 10 + bob, 14, 17, c.dark); r(11, 9 + bob, 10, 18, c.body);
    r(12, 10 + bob, 6, 3, light); r(9, 22 + bob, 14, 6, c.body);
    for (let x = 10; x < 23; x += 5) { r(x, 22 + bob, 2, 2, c.eye); r(x + 1, 18 + bob, 1, 1, c.eye); }
    r(12, 27, 2, 2, "#fff4dc"); r(18, 27, 2, 2, "#fff4dc");
  } else if (shape === "beast") {
    // Wolf / demon hound: sweeping tail, ears, snout and four moving paws.
    r(2, 16, 5, 3, c.dark); r(1, 12, 3, 5, c.body);
    r(6, 14 + bob, 17, 11, c.dark); r(7, 14 + bob, 15, 8, c.body);
    r(8, 15 + bob, 8, 2, light); r(18, 7 + bob, 10, 15, c.dark);
    r(19, 8 + bob, 8, 12, c.body); r(18, 4 + bob, 3, 6, c.body); r(25, 4 + bob, 3, 6, c.body);
    r(20, 5 + bob, 1, 3, c.accent); r(26, 5 + bob, 1, 3, c.accent);
    r(23, 12 + bob, 3, 2, c.eye); r(26, 16 + bob, 5, 4, c.body); r(30, 16 + bob, 1, 2, c.dark);
    r(26, 20 + bob, 3, 1, "#fff4dc");
    r(7, 24 - step, 4, 6, c.body); r(18, 24 + step, 4, 5, c.body);
    r(6, 29 - step, 6, 2, c.dark); r(18, 28 + step, 6, 2, c.dark);
  } else if (shape === "wisp") {
    // Ghost: stepped translucent tail and luminous eyes, not a blurred orb.
    r(11, 6 + bob, 10, 2, c.dark); r(8, 8 + bob, 16, 15, c.dark);
    r(7, 11 + bob, 18, 9, c.body); r(10, 8 + bob, 12, 14, c.body);
    r(10, 8 + bob, 5, 3, light); r(10, 23 + bob, 12, 3, c.body);
    r(11, 26 + bob, 4, 4, c.body); r(19, 25 + bob, 2, 4, c.body);
    r(10, 15 + bob, 4, 3, c.eye); r(18, 15 + bob, 4, 3, c.eye);
    r(11, 15 + bob, 1, 1, "#fff4dc"); r(19, 15 + bob, 1, 1, "#fff4dc");
    r(14, 20 + bob, 4, 2, c.dark); r(5, 7, 1, 1, c.accent); r(26, 11, 2, 2, c.accent);
  } else if (shape === "dragon") {
    // Broad wings, horned head, scales, clawed feet, and a curled tail.
    r(1, 6 + bob, 3, 17, c.dark); r(4, 9 + bob, 4, 14, c.dark); r(8, 12 + bob, 4, 9, c.body);
    r(28, 6 + bob, 3, 17, c.dark); r(24, 9 + bob, 4, 14, c.dark); r(20, 12 + bob, 4, 9, c.body);
    r(3, 11 + bob, 2, 7, c.accent); r(6, 14 + bob, 2, 6, c.accent);
    r(27, 11 + bob, 2, 7, c.accent); r(24, 14 + bob, 2, 6, c.accent);
    r(10, 17 + bob, 12, 12, c.dark); r(12, 18 + bob, 8, 11, c.body);
    r(14, 20 + bob, 4, 7, c.accent); r(12, 6 + bob, 8, 13, c.body);
    r(10, 8 + bob, 12, 8, c.body); r(11, 3 + bob, 2, 7, c.dark); r(19, 3 + bob, 2, 7, c.dark);
    r(12, 10 + bob, 3, 2, c.eye); r(18, 10 + bob, 3, 2, c.eye);
    r(13, 16 + bob, 6, 2, c.dark); r(13, 16 + bob, 1, 2, "#fff4dc"); r(18, 16 + bob, 1, 2, "#fff4dc");
    r(10, 28 - step, 5, 3, c.body); r(18, 28 + step, 5, 3, c.body);
    r(9, 30 - step, 7, 1, "#fff4dc"); r(18, 30 + step, 7, 1, "#fff4dc");
  } else {
    // Treant: branching antlers, layered canopy and an expressive trunk.
    r(5, 2, 2, 9, c.dark); r(3, 4, 4, 2, c.dark); r(7, 7, 4, 2, c.dark);
    r(25, 2, 2, 9, c.dark); r(25, 4, 4, 2, c.dark); r(21, 7, 4, 2, c.dark);
    r(8, 5 + bob, 16, 4, c.dark); r(5, 9 + bob, 22, 8, c.dark);
    r(7, 9 + bob, 18, 5, c.accent); r(10, 7 + bob, 10, 3, c.accent);
    r(10, 14 + bob, 12, 15, c.body); r(11, 15 + bob, 3, 11, light);
    r(3, 19 + bob, 7, 3, c.body); r(22, 19 + bob, 7, 3, c.body);
    r(2, 17 + bob, 2, 6, c.dark); r(28, 17 + bob, 2, 6, c.dark);
    r(12, 16 + bob, 2, 3, c.eye); r(18, 16 + bob, 2, 3, c.eye); r(14, 22 + bob, 4, 2, c.dark);
    r(8, 28 - step, 7, 3, c.dark); r(18, 28 + step, 7, 3, c.dark);
  }
}

/** Low-resolution props share the same brush and palette as the creatures. */
export function drawPixelTerrain(p: PixelPainter, x: number, y: number, w: number, h: number, kind: string, theme: string[]) {
  const r = (lx: number, ly: number, lw: number, lh: number, color: string) =>
    pixelRect(p, x + lx * w / 16, y + ly * h / 20, lw * w / 16, lh * h / 20, color);
  const dark = "#131622";
  r(1, 18, 15, 2, dark);
  if (kind === "tree") {
    r(6, 9, 4, 11, "#594432"); r(7, 10, 1, 10, "#97714b");
    r(5, 0, 6, 3, theme[0]); r(2, 3, 12, 5, theme[0]); r(0, 8, 16, 6, theme[0]);
    r(3, 4, 8, 3, theme[1]); r(1, 9, 9, 3, theme[1]); r(4, 2, 5, 2, theme[1]);
    r(6, 4, 2, 1, theme[2]); r(3, 10, 2, 1, theme[2]);
  } else if (kind === "rock" || kind === "crystal") {
    const top = kind === "crystal" ? theme[2] : "#737b90";
    r(5, 3, 6, 4, dark); r(3, 7, 10, 3, dark); r(1, 10, 14, 8, dark);
    r(5, 4, 5, 5, top); r(3, 9, 9, 5, top); r(2, 13, 12, 4, pixelShade(top, -22));
    r(5, 5, 2, 5, pixelShade(top, 34));
  } else if (kind === "lava") {
    r(2, 4, 12, 14, "#29222b"); r(4, 2, 8, 3, "#4b3033");
    r(3, 6, 4, 2, "#b4523d"); r(7, 8, 2, 5, "#e6a15a");
    r(9, 12, 4, 2, "#b4523d"); r(4, 15, 3, 2, "#e6a15a");
    r(7, 8, 1, 2, "#ffe1a1");
  } else if (kind === "pillar" || kind === "tomb" || kind === "gravestone") {
    r(3, 1, 10, 3, "#828899"); r(4, 4, 8, 13, "#586174"); r(5, 4, 2, 13, "#828899");
    r(7, 6, 2, 7, theme[2]); r(5, 8, 6, 2, theme[2]);
    r(2, 17, 12, 3, "#444e62");
  } else {
    // Crates, ruined walls and any future prop remain square, never disappear.
    r(1, 4, 14, 14, "#5e473a"); r(2, 5, 12, 2, "#ac8159");
    r(2, 7, 2, 10, "#886449"); r(12, 7, 2, 10, "#3f322d");
    r(4, 10, 8, 2, "#332b29"); r(2, 16, 12, 2, "#886449");
  }
}
