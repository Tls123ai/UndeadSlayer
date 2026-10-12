import { eq } from "drizzle-orm";
import { getDatabase } from "@/db";
import { gameProgress } from "@/db/schema";
import { getOrCreateProgress } from "@/db/progress";
import { getSessionUser } from "@/lib/session";
import { ApiError, apiError, json, readJson } from "@/lib/api";
import { parseProgressUpdate } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSessionUser();
    if (!session) throw new ApiError(401, "Please sign in to load your progress.");
    const db = await getDatabase();
    return json({ progress: await getOrCreateProgress(db, session.userId) });
  } catch (error) {
    return apiError(error, "load-progress");
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionUser();
    if (!session) throw new ApiError(401, "Your session has expired. Please sign in again to save.");
    const update = parseProgressUpdate(await readJson(req));
    const db = await getDatabase();
    const current = await getOrCreateProgress(db, session.userId);
    const merged = { ...current, ...update };
    if (!merged.unlockedHeroes.includes(merged.selectedHeroId)) {
      throw new ApiError(400, "Please unlock this hero before selecting them.");
    }
    const [progress] = await db.update(gameProgress)
      .set({ ...update, updatedAt: new Date() })
      // Ownership always comes from the database-backed session, never the body.
      .where(eq(gameProgress.userId, session.userId)).returning();
    if (!progress) throw new ApiError(404, "Your saved game could not be found. Please reload.");
    return json({ success: true, progress });
  } catch (error) {
    return apiError(error, "save-progress");
  }
}
