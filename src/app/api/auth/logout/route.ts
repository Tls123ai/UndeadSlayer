import { clearSession } from "@/lib/session";
import { apiError, json } from "@/lib/api";

export const runtime = "nodejs";

export async function POST() {
  try {
    await clearSession();
    return json({ success: true });
  } catch (error) {
    return apiError(error, "logout");
  }
}
