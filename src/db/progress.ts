import { eq } from "drizzle-orm";
import type { AppDatabase } from "./index";
import { gameProgress } from "./schema";

// Consistent starter gear/settings on registration AND when repairing a missing save.
export async function getOrCreateProgress(db: AppDatabase, userId: number) {
  await db.insert(gameProgress).values({ userId }).onConflictDoNothing({ target: gameProgress.userId });
  const [progress] = await db.select().from(gameProgress).where(eq(gameProgress.userId, userId)).limit(1);
  if (!progress) throw new Error("Player progress could not be initialized.");
  return progress;
}
