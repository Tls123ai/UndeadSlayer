import { NextResponse } from "next/server";
import { DatabaseUnavailableError } from "@/db";
import { ValidationError } from "./validation";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function readJson(req: Request): Promise<unknown> {
  const body = await req.text();
  if (Buffer.byteLength(body, "utf8") > 128_000) {
    throw new ApiError(413, "This request is too large.");
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new ApiError(400, "Please send a valid JSON request.");
  }
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function apiError(error: unknown, context: string) {
  if (error instanceof ValidationError) return json({ error: error.message }, 400);
  if (error instanceof ApiError) return json({ error: error.message }, error.status);
  if (error instanceof DatabaseUnavailableError) return json({ error: error.message }, 503);
  // Never return SQL, connection strings, password hashes, or internal exceptions.
  console.error(`[${context}] Request failed.`, error instanceof Error ? error.name : "Unknown error");
  return json({ error: "The game server could not complete this request. Please try again." }, 503);
}
