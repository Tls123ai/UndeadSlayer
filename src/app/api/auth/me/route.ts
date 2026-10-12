import { sql } from "drizzle-orm";
import { getDatabase, getDatabaseMode } from "@/db";
import { getOrCreateProgress } from "@/db/progress";
import { getSessionUser } from "@/lib/session";
import { apiError, json } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Even an anonymous startup checks the real database before enabling accounts.
    const db = await getDatabase();
    await db.execute(sql`select 1`);
    const database = getDatabaseMode();
    const session = await getSessionUser();
    if (!session) return json({ authenticated: false, database });
    const progress = await getOrCreateProgress(db, session.userId);
    return json({
      authenticated: true,
      user: { id: session.userId, username: session.username },
      progress,
      database,
    });
  } catch (error) {
    return apiError(error, "session");
  }
}
