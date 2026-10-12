import {
  HERO_IDS,
  type GameSettings,
  type InventoryItem,
  type ProgressData,
  type StatUpgrades,
} from "./progress";

export class ValidationError extends Error {}

function invalid(field: string): never {
  throw new ValidationError(`Invalid ${field}. Please reload your game and try again.`);
}

function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid(field);
  return value as Record<string, unknown>;
}

function integer(value: unknown, field: string, min = 0, max = 2_147_483_647): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) invalid(field);
  return value;
}

function text(value: unknown, field: string, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) invalid(field);
  return value;
}

function boolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") invalid(field);
  return value;
}

function hero(value: unknown, field: string): string {
  if (typeof value !== "string" || !HERO_IDS.some((id) => id === value)) invalid(field);
  return value;
}

function list<T>(value: unknown, field: string, max: number, validate: (item: unknown) => T): T[] {
  if (!Array.isArray(value) || value.length > max) invalid(field);
  return value.map(validate);
}

export function parseCredentials(value: unknown, register = false) {
  const payload = object(value, "credentials");
  if (typeof payload.username !== "string" || typeof payload.password !== "string") {
    throw new ValidationError("Please enter both username and password.");
  }
  const username = payload.username.trim().toLowerCase();
  if (!username || username.length > 32 || (register && username.length < 3) || /[\u0000-\u001f\u007f]/.test(username)) {
    throw new ValidationError("Username must be between 3 and 32 characters long.");
  }
  // bcrypt truncates after 72 bytes; do not silently accept a different password.
  if (!payload.password || Buffer.byteLength(payload.password, "utf8") > 72 || (register && payload.password.length < 5)) {
    throw new ValidationError("Password must be at least 5 characters and at most 72 bytes long.");
  }
  return { username, password: payload.password };
}

function settings(value: unknown): GameSettings {
  const data = object(value, "settings");
  return {
    musicVolume: integer(data.musicVolume, "music volume", 0, 100),
    sfxVolume: integer(data.sfxVolume, "sound volume", 0, 100),
    autoTarget: boolean(data.autoTarget, "auto target"),
    screenShake: boolean(data.screenShake, "screen shake"),
    damageNumbers: boolean(data.damageNumbers, "damage numbers"),
  };
}

function statUpgrades(value: unknown): StatUpgrades {
  const data = object(value, "stat upgrades");
  return {
    attackLevel: integer(data.attackLevel, "attack level", 1, 1000),
    healthLevel: integer(data.healthLevel, "health level", 1, 1000),
    defenseLevel: integer(data.defenseLevel, "defense level", 1, 1000),
    skillLevel: integer(data.skillLevel, "skill level", 1, 1000),
  };
}

function inventoryItem(value: unknown): InventoryItem {
  const data = object(value, "inventory item");
  if (!["weapon", "armor", "accessory", "material"].includes(String(data.type))) invalid("item type");
  if (!["common", "rare", "epic", "legendary"].includes(String(data.rarity))) invalid("item rarity");
  if (typeof data.critBonus !== "number" || !Number.isFinite(data.critBonus) || data.critBonus < 0 || data.critBonus > 1) invalid("critical bonus");
  if (typeof data.description !== "string" || data.description.length > 500) invalid("item description");
  return {
    id: text(data.id, "item ID", 100),
    itemId: text(data.itemId, "item definition", 100),
    name: text(data.name, "item name", 100),
    type: data.type as InventoryItem["type"],
    rarity: data.rarity as InventoryItem["rarity"],
    atkBonus: integer(data.atkBonus, "attack bonus"),
    hpBonus: integer(data.hpBonus, "health bonus"),
    defBonus: integer(data.defBonus, "defense bonus"),
    critBonus: data.critBonus,
    equipped: boolean(data.equipped, "equipped item"),
    description: data.description,
  };
}

/** Only gameplay fields are writable. IDs, ownership and timestamps are ignored. */
export function parseProgressUpdate(value: unknown): Partial<ProgressData> {
  const data = object(value, "save data");
  const update: Partial<ProgressData> = {};
  for (const key of ["level", "xp", "coins", "healthPotions"] as const) {
    if (data[key] !== undefined) update[key] = integer(data[key], key, key === "level" ? 1 : 0);
  }
  for (const key of ["highestChapterUnlocked", "highestLevelUnlocked"] as const) {
    if (data[key] !== undefined) update[key] = integer(data[key], key, 1, 5);
  }
  if (data.selectedHeroId !== undefined) update.selectedHeroId = hero(data.selectedHeroId, "selected hero");
  if (data.completedLevels !== undefined) {
    update.completedLevels = [...new Set(list(data.completedLevels, "completed levels", 25, (item) => {
      if (typeof item !== "string" || !/^[1-5]-[1-5]$/.test(item)) invalid("completed stage");
      return item;
    }))];
  }
  if (data.unlockedHeroes !== undefined) {
    update.unlockedHeroes = [...new Set(list(data.unlockedHeroes, "unlocked heroes", 10, (item) => hero(item, "unlocked hero")))];
    if (!update.unlockedHeroes.length) invalid("unlocked heroes");
  }
  if (data.heroLevels !== undefined) {
    update.heroLevels = Object.fromEntries(Object.entries(object(data.heroLevels, "hero levels")).map(([id, level]) => [
      hero(id, "hero level"), integer(level, "hero level", 1, 1000),
    ]));
  }
  if (data.statUpgrades !== undefined) update.statUpgrades = statUpgrades(data.statUpgrades);
  if (data.inventory !== undefined) update.inventory = list(data.inventory, "inventory", 200, inventoryItem);
  if (data.settings !== undefined) update.settings = settings(data.settings);
  if (!Object.keys(update).length) invalid("save data");
  return update;
}
