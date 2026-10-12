// Shared by the database, API validation, and game client. No server-only imports.
export const HERO_IDS = [
  "aiden", "luna", "ronan", "mira", "kael",
  "bruno", "sylvie", "darius", "elian", "riven",
] as const;

export interface InventoryItem {
  id: string;
  itemId: string;
  name: string;
  type: "weapon" | "armor" | "accessory" | "material";
  rarity: "common" | "rare" | "epic" | "legendary";
  atkBonus: number;
  hpBonus: number;
  defBonus: number;
  critBonus: number;
  equipped: boolean;
  description: string;
}

export interface StatUpgrades {
  attackLevel: number;
  healthLevel: number;
  defenseLevel: number;
  skillLevel: number;
}

export interface GameSettings {
  musicVolume: number;
  sfxVolume: number;
  autoTarget: boolean;
  screenShake: boolean;
  damageNumbers: boolean;
}

export interface ProgressData {
  level: number;
  xp: number;
  coins: number;
  healthPotions: number;
  selectedHeroId: string;
  highestChapterUnlocked: number;
  highestLevelUnlocked: number;
  completedLevels: string[];
  unlockedHeroes: string[];
  heroLevels: Record<string, number>;
  statUpgrades: StatUpgrades;
  inventory: InventoryItem[];
  settings: GameSettings;
}

export interface PlayerProgress extends ProgressData {
  id: number;
  userId: number;
  updatedAt: string;
}

export interface PlayerUser {
  id: number;
  username: string;
}

export interface AuthResponse {
  user: PlayerUser;
  progress: PlayerProgress;
}

export interface SessionResponse {
  authenticated: boolean;
  user?: PlayerUser;
  progress?: PlayerProgress;
  database: "postgresql" | "embedded";
}

export const DEFAULT_HERO_LEVELS: Record<string, number> = Object.fromEntries(
  HERO_IDS.map((id) => [id, 1]),
);

export const DEFAULT_STAT_UPGRADES: StatUpgrades = {
  attackLevel: 1, healthLevel: 1, defenseLevel: 1, skillLevel: 1,
};

export const DEFAULT_SETTINGS: GameSettings = {
  musicVolume: 70,
  sfxVolume: 80,
  autoTarget: true,
  screenShake: true,
  damageNumbers: true,
};

export const DEFAULT_INVENTORY_ITEMS: InventoryItem[] = [
  {
    id: "init_weapon", itemId: "iron_sword", name: "Slayer's Iron Blade",
    type: "weapon", rarity: "common",
    atkBonus: 12, hpBonus: 30, defBonus: 5, critBonus: 0.02, equipped: true,
    description: "Standard issued steel blade for young slayers.",
  },
  {
    id: "init_armor", itemId: "leather_armor", name: "Hardened Leather Guard",
    type: "armor", rarity: "common",
    atkBonus: 0, hpBonus: 80, defBonus: 12, critBonus: 0, equipped: true,
    description: "Reliable lightweight chest armor against fangs.",
  },
  {
    id: "init_acc", itemId: "courage_ring", name: "Ring of Valor",
    type: "accessory", rarity: "common",
    atkBonus: 8, hpBonus: 40, defBonus: 4, critBonus: 0.04, equipped: true,
    description: "A brass ring etched with runes of courage.",
  },
];
