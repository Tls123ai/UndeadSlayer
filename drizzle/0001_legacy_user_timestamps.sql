-- CREATE TABLE IF NOT EXISTS does not repair an older, partially-created
-- users table. Add only the missing timestamps; never replace accounts,
-- password hashes, or existing dates/progress.
ALTER TABLE "public"."users" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "public"."users" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
