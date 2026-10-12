import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDatabase } from "@/db";
import { users } from "@/db/schema";
import { getOrCreateProgress } from "@/db/progress";
import { setSessionUser } from "@/lib/session";
import { ApiError, apiError, json, readJson } from "@/lib/api";
import { parseCredentials } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { username, password } = parseCredentials(await readJson(req));
    const db = await getDatabase();
    const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new ApiError(401, "Invalid username or password.");
    }
    const progress = await getOrCreateProgress(db, user.id);
    await setSessionUser(user.id);
    return json({ success: true, user: { id: user.id, username: user.username }, progress });
  } catch (error) {
    return apiError(error, "login");
  }
}
