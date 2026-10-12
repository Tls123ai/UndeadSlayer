import { sql } from "drizzle-orm";
import { pgTable, text, serial, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import {
  DEFAULT_HERO_LEVELS,
  DEFAULT_INVENTORY_ITEMS,
  DEFAULT_SETTINGS,
  DEFAULT_STAT_UPGRADES,
  type GameSettings,
  type InventoryItem,
  type StatUpgrades,
} from "@/lib/progress";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// The browser receives only a random token. Its hash, owner, and expiry live here.
export const sessions = pgTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("sessions_user_id_idx").on(table.userId),
  index("sessions_expires_at_idx").on(table.expiresAt),
]);

export const gameProgress = pgTable("game_progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  level: integer("level").default(1).notNull(),
  xp: integer("xp").default(0).notNull(),
  coins: integer("coins").default(600).notNull(),
  healthPotions: integer("health_potions").default(5).notNull(),
  selectedHeroId: text("selected_hero_id").default("aiden").notNull(),
  highestChapterUnlocked: integer("highest_chapter_unlocked").default(1).notNull(),
  highestLevelUnlocked: integer("highest_level_unlocked").default(1).notNull(),
  completedLevels: jsonb("completed_levels").$type<string[]>().default([]).notNull(),
  unlockedHeroes: jsonb("unlocked_heroes").$type<string[]>().default(["aiden", "luna"]).notNull(),
  heroLevels: jsonb("hero_levels").$type<Record<string, number>>().default(DEFAULT_HERO_LEVELS).notNull(),
  statUpgrades: jsonb("stat_upgrades").$type<StatUpgrades>().default(DEFAULT_STAT_UPGRADES).notNull(),
  inventory: jsonb("inventory").$type<InventoryItem[]>().default(sql.raw(`'${JSON.stringify(DEFAULT_INVENTORY_ITEMS).replace(/'/g, "''")}'::jsonb`)).notNull(),
  settings: jsonb("settings").$type<GameSettings>().default(DEFAULT_SETTINGS).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type GameProgress = typeof gameProgress.$inferSelect;
