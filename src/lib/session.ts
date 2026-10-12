import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { and, eq, gt, lte } from "drizzle-orm";
import { getDatabase } from "@/db";
import { sessions, users } from "@/db/schema";

const SESSION_COOKIE = "undead_slayer_session";
const SESSION_SECONDS = 60 * 60 * 24 * 30;
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function setSessionUser(userId: number) {
  // Rotate/revoke any previous token in this browser.
  await clearSession();
  const db = await getDatabase();
  const token = randomBytes(32).toString("hex");
  await db.delete(sessions).where(lte(sessions.expiresAt, new Date()));
  await db.insert(sessions).values({
    tokenHash: hashToken(token),
    userId,
    expiresAt: new Date(Date.now() + SESSION_SECONDS * 1000),
  });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export async function getSessionUser(): Promise<{ userId: number; username: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  // Old base64 identity cookies and forged/invalid tokens are not authentication.
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const db = await getDatabase();
  const [session] = await db
    .select({ userId: users.id, username: users.username })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return session || null;
}

export async function clearSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token && /^[a-f0-9]{64}$/.test(token)) {
    const db = await getDatabase();
    await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  }
  cookieStore.delete(SESSION_COOKIE);
}
