/** Integer-grid, limited-palette battle sprites and terrain. */
import { drawPixelCreature, drawPixelTerrain } from "./pixelCreatures";
import { pixelDefinitionForKit } from "./artAssets";
import { pixelRect, PIXEL_SCALE } from "./pixelPainter";

export type BodyShape = "humanoid" | "beast" | "spider" | "wisp" | "dragon" | "treant" | "knight";
export type Headgear = "helm" | "hood" | "hat" | "crown" | "horns" | "antlers" | "headband" | "none";
export type WeaponKind =
  | "sword" | "greatsword" | "bow" | "staff" | "axe" | "hammer" | "dagger" | "orb" | "claw" | "none";
export type BodyBuild = "standard" | "slim" | "heavy" | "robe";
export type Gear =
  | "quiver" | "spellbook" | "dualWield" | "shield" | "furPauldrons"
  | "flameAura" | "vines" | "emblemCape" | "wings" | "ribs" | "torn";

export type { PixelChibiDef } from "./pixelChibi";
import { drawChibi, type PixelChibiDef } from "./pixelChibi";

export interface SpriteColors {
  skin: string;
  hair: string;
  armor: string;
  accent: string;
  cape: string;
  weapon: string;
  dark: string;
}

export interface SpriteKit {
  shape: BodyShape;
  headgear: Headgear;
  weapon: WeaponKind;
  colors: SpriteColors;
  scale: number; // integer world units per sprite pixel
  shield?: boolean; // legacy flag, treated as gear "shield"
  build?: BodyBuild;
  gear?: Gear[];
  /** class-specific pixel-art chibi definition */
  pixel?: PixelChibiDef;
}

export interface PortraitCrop {
  u: number; // normalized face center-x in the source image
  v: number; // normalized face center-y
  r: number; // normalized crop radius (relative to image width)
}

export interface DrawOpts {
  x: number;
  y: number; // ground / feet position
  facingLeft: boolean;
  frame: number;
  moving: boolean;
  attackT: number; // 0..1
  hitFlash: number;
  dead?: boolean;
  elite?: boolean;
  boss?: boolean;
  casting?: boolean;
  /** legacy artwork input; pixel portraits and sprites now share one brush */
  portrait?: HTMLImageElement | null;
  portraitCrop?: PortraitCrop;
  /** 0 = just died, 1 = fully collapsed (dies animation) */
  deathProgress?: number;
  /** dashing: draws speed streaks behind the chibi */
  dashing?: boolean;
}


export function drawUnit(ctx: CanvasRenderingContext2D, kit: SpriteKit, o: DrawOpts) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(o.x / PIXEL_SCALE) * PIXEL_SCALE, Math.round(o.y / PIXEL_SCALE) * PIXEL_SCALE);
  if (o.facingLeft) ctx.scale(-1, 1);
  const death = o.dead ? 1 : o.deathProgress ?? 0;
  if (death > 0) {
    ctx.globalAlpha *= Math.max(0.1, 1 - death * 0.9);
    ctx.translate(0, Math.floor(death * 4) * PIXEL_SCALE);
  }
  const humanoid = kit.shape === "humanoid" || kit.shape === "knight";
  const unit = humanoid ? Math.max(3, Math.round(kit.scale)) : Math.max(2, Math.round(kit.scale * 0.8));
  const width = unit * 14;
  // Stepped, flat ground shadow and boss/elite marker.
  pixelRect(ctx, -width, -2, width * 2, 4, "#10131e");
  pixelRect(ctx, -width + 4, -4, width * 2 - 8, 8, "#10131e");
  if (o.elite || o.boss) {
    pixelRect(ctx, -width, 2, width * 2, 2, o.boss ? "#ef716a" : "#f3bd59");
  }
  if (humanoid) {
    drawChibi(ctx, pixelDefinitionForKit(kit), {
      u: unit, frame: o.frame, moving: o.moving, attackT: o.attackT, hitFlash: o.hitFlash,
      dashing: o.dashing, dead: o.dead, boss: o.boss, elite: o.elite,
    });
  } else {
    drawPixelCreature(ctx, kit.shape as "beast" | "spider" | "wisp" | "dragon" | "treant", {
      body: kit.colors.armor, dark: kit.colors.dark, eye: kit.colors.accent, accent: kit.colors.cape,
    }, unit, o.frame, o.moving, o.hitFlash > 0);
  }
  ctx.restore();
}

export function drawTerrainProp(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, kind: string, theme: string[]) {
  ctx.save();
  drawPixelTerrain(ctx, Math.round(x / 2) * 2, Math.round(y / 2) * 2, w, h, kind, theme);
  ctx.restore();
}
