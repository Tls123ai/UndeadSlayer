import bcrypt from "bcryptjs";
import { getDatabase } from "@/db";
import { users, gameProgress } from "@/db/schema";
import { setSessionUser } from "@/lib/session";
import { ApiError, apiError, json, readJson } from "@/lib/api";
import { parseCredentials } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { username, password } = parseCredentials(await readJson(req), true);
    const db = await getDatabase();
    const passwordHash = await bcrypt.hash(password, 10);

    // Atomic creation: a failure cannot leave an account without its starter save.
    // ON CONFLICT handles simultaneous requests for the same username safely.
    const { user, progress } = await db.transaction(async (tx) => {
      const [user] = await tx.insert(users).values({ username, passwordHash })
        .onConflictDoNothing({ target: users.username }).returning();
      if (!user) throw new ApiError(409, "This username is already taken. Please choose another.");
      const [progress] = await tx.insert(gameProgress).values({ userId: user.id }).returning();
      return { user, progress };
    });

    await setSessionUser(user.id);
    return json({ success: true, user: { id: user.id, username: user.username }, progress }, 201);
  } catch (error) {
    return apiError(error, "register");
  }
}
