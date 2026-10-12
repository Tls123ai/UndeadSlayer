import { drawChibi, type PixelChibiDef, type PixelHat, type PixelWeapon } from "./pixelChibi";
import { drawPixelCreature, type CreatureShape } from "./pixelCreatures";
import { pixelPortraitSvg, pixelShade, type PixelPainter } from "./pixelPainter";
import type { SpriteKit } from "./sprites";

/** Local, deterministic pixel portraits: no remote art, gradients, or filters. */
export type Headgear =
  | "helm"
  | "hood"
  | "hat"
  | "crown"
  | "horns"
  | "antlers"
  | "headband"
  | "none";

export type WeaponArt =
  | "sword"
  | "greatsword"
  | "bow"
  | "staff"
  | "axe"
  | "hammer"
  | "dagger"
  | "orb"
  | "fist";

export interface HeroArtOpts {
  bg1: string;
  bg2: string;
  skin: string;
  hair: string;
  armor: string;
  accent: string;
  cape: string;
  weaponColor: string;
  headgear: Headgear;
  weaponArt: WeaponArt;
  /** monk-style shaved head with shine + small scars (skips hair) */
  bald?: boolean;
}

export type MonsterFeature =
  | "horns"
  | "ears"
  | "spikes"
  | "ribs"
  | "legs8"
  | "wings"
  | "hood"
  | "helm"
  | "antlers"
  | "crown"
  | "mane"
  | "tentacles"
  | "none";

export interface MonsterArtOpts {
  bg1: string;
  bg2: string;
  body: string;
  dark: string;
  eye: string;
  feature: MonsterFeature;
  fang?: boolean;
  aura?: string;
}


export function pixelDefinitionForKit(kit: SpriteKit): PixelChibiDef {
  if (kit.pixel) return kit.pixel;
  const c = kit.colors;
  const hats: Record<string, PixelHat> = { helm: "helmet", hood: "hood", hat: "pointy", crown: "crown", horns: "horns", antlers: "horns", headband: "spiky", none: "messy" };
  const weapons: Record<string, PixelWeapon> = { orb: "staff", claw: "fist", none: "fist" };
  return {
    hat: hats[kit.headgear] || "messy",
    weapon: weapons[kit.weapon] || kit.weapon as PixelWeapon,
    effect: "slash", shield: kit.shield,
    palette: {
      hair: c.hair, skin: c.skin, eye: c.accent, top: c.armor,
      topDark: pixelShade(c.armor, -28), bottom: c.dark, bottomDark: pixelShade(c.dark, -15),
      accent: c.accent, weapon: c.weapon, weaponDark: c.dark,
      cape: c.cape, shield: c.armor, hat: kit.headgear === "hood" ? c.cape : c.armor,
      hatDark: c.dark, hatTrim: c.accent,
    },
  };
}

export function spritePortrait(kit: SpriteKit, background = kit.colors.dark): string {
  return pixelPortraitSvg((p) => {
    // Translate the shared feet-centred sprite into a 40x40 portrait.
    const brush: PixelPainter = {
      get fillStyle() { return p.fillStyle; },
      set fillStyle(value) { p.fillStyle = value; },
      fillRect(x, y, w, h) { p.fillRect(x + 17, y + 35, w, h); },
    };
    if (kit.shape === "humanoid" || kit.shape === "knight") {
      drawChibi(brush, pixelDefinitionForKit(kit), { u: 1, frame: 0, moving: false, attackT: 0, hitFlash: 0 });
    } else {
      drawPixelCreature(brush, kit.shape as CreatureShape, {
        body: kit.colors.armor, dark: kit.colors.dark, eye: kit.colors.accent, accent: kit.colors.cape,
      });
    }
  }, background, kit.colors.accent);
}

export function heroPortrait(o: HeroArtOpts): string {
  return spritePortrait({
    shape: "humanoid", headgear: o.headgear, weapon: o.weaponArt === "fist" ? "claw" : o.weaponArt,
    scale: 4, colors: { skin: o.skin, hair: o.hair, armor: o.armor, accent: o.accent, cape: o.cape, weapon: o.weaponColor, dark: o.bg2 },
  }, o.bg2);
}

export function monsterPortrait(o: MonsterArtOpts): string {
  const shapes: Partial<Record<MonsterFeature, SpriteKit["shape"]>> = { legs8: "spider", wings: "dragon", antlers: "treant", ears: "beast", mane: "beast", tentacles: "wisp" };
  return spritePortrait({
    shape: shapes[o.feature] || (o.aura && o.feature === "none" ? "wisp" : "humanoid"),
    headgear: o.feature === "helm" ? "helm" : o.feature === "hood" ? "hood" : o.feature === "crown" ? "crown" : o.feature === "horns" ? "horns" : "none",
    weapon: "none", scale: 4,
    colors: { skin: o.body, hair: o.dark, armor: o.body, accent: o.eye, cape: o.dark, weapon: o.eye, dark: o.dark },
  }, o.bg2);
}
