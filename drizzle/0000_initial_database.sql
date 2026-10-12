-- Safe to adopt the previous unversioned schema; existing accounts and saves are preserved.
CREATE TABLE IF NOT EXISTS "game_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"coins" integer DEFAULT 600 NOT NULL,
	"health_potions" integer DEFAULT 5 NOT NULL,
	"selected_hero_id" text DEFAULT 'aiden' NOT NULL,
	"highest_chapter_unlocked" integer DEFAULT 1 NOT NULL,
	"highest_level_unlocked" integer DEFAULT 1 NOT NULL,
	"completed_levels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"unlocked_heroes" jsonb DEFAULT '["aiden","luna"]'::jsonb NOT NULL,
	"hero_levels" jsonb DEFAULT '{"aiden":1,"luna":1,"ronan":1,"mira":1,"kael":1,"bruno":1,"sylvie":1,"darius":1,"elian":1,"riven":1}'::jsonb NOT NULL,
	"stat_upgrades" jsonb DEFAULT '{"attackLevel":1,"healthLevel":1,"defenseLevel":1,"skillLevel":1}'::jsonb NOT NULL,
	"inventory" jsonb DEFAULT '[{"id":"init_weapon","itemId":"iron_sword","name":"Slayer''s Iron Blade","type":"weapon","rarity":"common","atkBonus":12,"hpBonus":30,"defBonus":5,"critBonus":0.02,"equipped":true,"description":"Standard issued steel blade for young slayers."},{"id":"init_armor","itemId":"leather_armor","name":"Hardened Leather Guard","type":"armor","rarity":"common","atkBonus":0,"hpBonus":80,"defBonus":12,"critBonus":0,"equipped":true,"description":"Reliable lightweight chest armor against fangs."},{"id":"init_acc","itemId":"courage_ring","name":"Ring of Valor","type":"accessory","rarity":"common","atkBonus":8,"hpBonus":40,"defBonus":4,"critBonus":0.04,"equipped":true,"description":"A brass ring etched with runes of courage."}]'::jsonb NOT NULL,
	"settings" jsonb DEFAULT '{"musicVolume":70,"sfxVolume":80,"autoTarget":true,"screenShake":true,"damageNumbers":true}'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "game_progress_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.game_progress'::regclass
      AND confrelid = 'public.users'::regclass AND contype = 'f'
  ) THEN
    ALTER TABLE "game_progress" ADD CONSTRAINT "game_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.sessions'::regclass
      AND confrelid = 'public.users'::regclass AND contype = 'f'
  ) THEN
    ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");
--> statement-breakpoint
ALTER TABLE "game_progress" ALTER COLUMN "coins" SET DEFAULT 600;
--> statement-breakpoint
ALTER TABLE "game_progress" ALTER COLUMN "completed_levels" SET DEFAULT '[]'::jsonb;
--> statement-breakpoint
ALTER TABLE "game_progress" ALTER COLUMN "inventory" SET DEFAULT '[{"id":"init_weapon","itemId":"iron_sword","name":"Slayer''s Iron Blade","type":"weapon","rarity":"common","atkBonus":12,"hpBonus":30,"defBonus":5,"critBonus":0.02,"equipped":true,"description":"Standard issued steel blade for young slayers."},{"id":"init_armor","itemId":"leather_armor","name":"Hardened Leather Guard","type":"armor","rarity":"common","atkBonus":0,"hpBonus":80,"defBonus":12,"critBonus":0,"equipped":true,"description":"Reliable lightweight chest armor against fangs."},{"id":"init_acc","itemId":"courage_ring","name":"Ring of Valor","type":"accessory","rarity":"common","atkBonus":8,"hpBonus":40,"defBonus":4,"critBonus":0.04,"equipped":true,"description":"A brass ring etched with runes of courage."}]'::jsonb;
--> statement-breakpoint
ALTER TABLE "game_progress" ALTER COLUMN "settings" SET DEFAULT '{"musicVolume":70,"sfxVolume":80,"autoTarget":true,"screenShake":true,"damageNumbers":true}'::jsonb;
