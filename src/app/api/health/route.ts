import { sql } from "drizzle-orm";
import { getDatabase, getDatabaseMode } from "@/db";
import { apiError, json } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await getDatabase();
    await db.execute(sql`select 1`);
    return json({ ok: true, database: getDatabaseMode(), persistent: true, schemaReady: true });
  } catch (error) {
    const failure = await apiError(error, "health").json();
    return json({
      ...failure,
      ok: false,
      database: getDatabaseMode() === "unconfigured" ? "unconfigured" : "unavailable",
      schemaReady: false,
    }, 503);
  }
}
