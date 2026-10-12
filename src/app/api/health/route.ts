import { sql } from "drizzle-orm";
import { getDatabase, getDatabaseMode, DatabaseUnavailableError } from "@/db";
import { json } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await getDatabase();
    await db.execute(sql`select 1`);
    return json({ ok: true, database: getDatabaseMode(), persistent: true });
  } catch (error) {
    return json({
      ok: false,
      database: getDatabaseMode() === "unconfigured" ? "unconfigured" : "unavailable",
      error: error instanceof DatabaseUnavailableError ? error.message : "The save database is unavailable. Please try again in a moment.",
    }, 503);
  }
}
