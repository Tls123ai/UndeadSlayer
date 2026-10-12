import { NextResponse } from "next/server";
import { DatabaseUnavailableError } from "@/db";
import { ValidationError } from "./validation";
import { inspectDatabaseFailure, safeServerErrorMessage } from "./databaseErrors";

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
  if (error instanceof ValidationError) return json({ error: safeServerErrorMessage(error.message) }, 400);
  if (error instanceof ApiError) return json({ error: safeServerErrorMessage(error.message) }, error.status);
  const failure = inspectDatabaseFailure(error);
  if (error instanceof DatabaseUnavailableError || failure) {
    // Log only safe diagnostic codes, never the original query/params/URL.
    console.error(`[${context}] Database request failed.`, { code: error instanceof DatabaseUnavailableError ? error.code : failure!.code, sqlState: error instanceof DatabaseUnavailableError ? error.sqlState : failure?.sqlState });
    return json({
      error: safeServerErrorMessage(error instanceof DatabaseUnavailableError ? error.message : failure!.message),
      code: error instanceof DatabaseUnavailableError ? error.code : failure!.code,
    }, 503);
  }
  console.error(`[${context}] Request failed.`);
  return json({ error: "The game server could not complete this request. Please try again." }, 503);
}
