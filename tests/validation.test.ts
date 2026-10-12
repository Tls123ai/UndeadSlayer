import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCredentials, parseProgressUpdate, ValidationError } from "../src/lib/validation";
import { DEFAULT_HERO_LEVELS, DEFAULT_INVENTORY_ITEMS, DEFAULT_SETTINGS, DEFAULT_STAT_UPGRADES } from "../src/lib/progress";

test("account credentials are normalized and type/length checked", () => {
  assert.deepEqual(parseCredentials({ username: " Slayer ", password: "pass123" }, true), { username: "slayer", password: "pass123" });
  for (const payload of [null, [], { username: 123, password: "pass123" }, { username: "ab", password: "pass123" }, { username: "slayer", password: "1234" }, { username: "a".repeat(33), password: "pass123" }]) {
    assert.throws(() => parseCredentials(payload, true), ValidationError);
  }
  assert.throws(() => parseCredentials({ username: "slayer", password: "💀".repeat(19) }, true), /72 bytes/);
});

test("complete saves retain every gameplay field but not ownership or timestamps", () => {
  const input = {
    id: 3, userId: 999, updatedAt: "fake", passwordHash: "never-store-this",
    level: 1, xp: 0, coins: 600, healthPotions: 5, selectedHeroId: "aiden",
    highestChapterUnlocked: 1, highestLevelUnlocked: 1, completedLevels: [],
    unlockedHeroes: ["aiden", "luna"], heroLevels: DEFAULT_HERO_LEVELS,
    statUpgrades: DEFAULT_STAT_UPGRADES, inventory: DEFAULT_INVENTORY_ITEMS,
    settings: DEFAULT_SETTINGS,
  };
  const update = parseProgressUpdate(input);
  assert.equal(Object.keys(update).length, 13);
  assert.equal(update.coins, 600);
  assert.deepEqual(update.inventory, DEFAULT_INVENTORY_ITEMS);
  for (const key of ["id", "userId", "updatedAt", "passwordHash"]) assert.equal(key in update, false);
});

test("partial saves accept valid zero values and deduplicate unlocks/stages", () => {
  assert.deepEqual(parseProgressUpdate({ coins: 0, healthPotions: 0, completedLevels: ["1-1", "1-1"], unlockedHeroes: ["aiden", "aiden"] }), {
    coins: 0, healthPotions: 0, completedLevels: ["1-1"], unlockedHeroes: ["aiden"],
  });
});

test("malformed save data is rejected before SQL is issued", () => {
  for (const payload of [
    null, [], {}, { userId: 999 }, { coins: -1 }, { coins: 1.5 }, { coins: "600" },
    { coins: 2_147_483_648 }, { xp: Infinity }, { level: 0 }, { healthPotions: null },
    { highestChapterUnlocked: 6 }, { highestLevelUnlocked: 0 }, { selectedHeroId: "unknown" },
    { completedLevels: ["0-0"] }, { completedLevels: ["6-1"] }, { unlockedHeroes: [] },
    { heroLevels: { unknown: 1 } }, { statUpgrades: { ...DEFAULT_STAT_UPGRADES, healthLevel: -1 } },
    { settings: { ...DEFAULT_SETTINGS, sfxVolume: 101 } }, { settings: { ...DEFAULT_SETTINGS, autoTarget: "yes" } },
    { inventory: [{ ...DEFAULT_INVENTORY_ITEMS[0], type: "invalid" }] },
    { inventory: [{ ...DEFAULT_INVENTORY_ITEMS[0], critBonus: NaN }] },
    { inventory: [{ ...DEFAULT_INVENTORY_ITEMS[0], equipped: 1 }] },
  ]) assert.throws(() => parseProgressUpdate(payload), ValidationError);
});
