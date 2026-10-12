import { test } from "node:test";
import assert from "node:assert/strict";
import { HEROES, ENEMY_TYPES, CHAPTERS } from "../src/lib/gameData";
import { spritePortrait } from "../src/lib/artAssets";
import { drawPixelCreature, drawPixelTerrain } from "../src/lib/pixelCreatures";
import { drawChibi } from "../src/lib/pixelChibi";
import type { PixelPainter } from "../src/lib/pixelPainter";

function recordingBrush() {
  const rectangles: number[][] = [];
  const brush: PixelPainter = { fillStyle: "#000000", fillRect: (x, y, w, h) => { rectangles.push([x, y, w, h]); } };
  return { brush, rectangles };
}

test("every hero, enemy and boss portrait is a local 40x40 integer pixel image", () => {
  const entities = [...Object.values(HEROES), ...Object.values(ENEMY_TYPES), ...CHAPTERS.map((chapter) => chapter.boss)];
  for (const entity of entities) {
    assert.equal(entity.image, spritePortrait(entity.sprite), entity.name);
    const svg = decodeURIComponent(entity.image.split(",")[1]);
    assert.match(svg, /width="40" height="40"/);
    assert.match(svg, /shape-rendering="crispEdges"/);
    assert.doesNotMatch(svg, /gradient|filter|ellipse|circle|https?:\/\/(?!www.w3.org)/i);
    const coordinates = [...svg.matchAll(/(?:x|y|width|height)="(-?\d+(?:\.\d+)?)"/g)];
    assert.ok(coordinates.length > 100, `${entity.name} has a detailed pixel sprite`);
    for (const match of coordinates) assert.ok(Number.isInteger(Number(match[1])), `${entity.name} uses integer pixels`);
  }
});

test("all ten hero portraits remain distinct and deterministic", () => {
  const heroes = Object.values(HEROES);
  assert.equal(new Set(heroes.map((hero) => hero.image)).size, 10);
  for (const hero of heroes) {
    assert.equal(spritePortrait(hero.sprite), spritePortrait(hero.sprite));
    assert.ok(hero.sprite.pixel, `${hero.name} keeps a class-specific pixel definition`);
  }
});

test("hero idle, attack, walking, dash, hurt and death poses use only integer rectangles", () => {
  for (const hero of Object.values(HEROES)) {
    for (const attackT of [0, 0.2, 0.45, 0.65, 0.9]) {
      const { brush, rectangles } = recordingBrush();
      drawChibi(brush, hero.sprite.pixel!, { u: 4, frame: 2, attackT, moving: true, dashing: true, hitFlash: 0 });
      assert.ok(rectangles.length > 30);
      assert.ok(rectangles.flat().every(Number.isInteger));
      drawChibi(brush, hero.sprite.pixel!, { u: 4, frame: 1, attackT: 0, moving: false, hitFlash: 0.1, dead: true });
      assert.ok(rectangles.flat().every(Number.isInteger));
    }
  }
});

test("all creature silhouettes and terrain props use the same integer pixel brush", () => {
  const palette = { body: "#68738b", dark: "#10131e", eye: "#f3c775", accent: "#74c69c" };
  for (const shape of ["beast", "spider", "wisp", "dragon", "treant"] as const) {
    const { brush, rectangles } = recordingBrush();
    drawPixelCreature(brush, shape, palette, 3, 2, true);
    assert.ok(rectangles.length > 10);
    assert.ok(rectangles.flat().every(Number.isInteger));
  }
  for (const kind of ["tree", "rock", "crystal", "pillar", "grave", "lava", "void", "crate"]) {
    const { brush, rectangles } = recordingBrush();
    drawPixelTerrain(brush, 1.3, 3.6, 63.5, 89.2, kind, ["#46516c", "#68738b", "#74c69c"]);
    assert.ok(rectangles.length > 4);
    assert.ok(rectangles.flat().every(Number.isInteger));
  }
});
