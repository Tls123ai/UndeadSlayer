// Public diagnostics are deliberately independent of SQL/driver imports.
export const DATABASE_ERROR_MESSAGES = {
  DATABASE_NOT_CONFIGURED: "The save database is not connected. The site owner needs to set DATABASE_URL or POSTGRES_URL for this deployment and redeploy.",
  DATABASE_SCHEMA_NOT_READY: "The save database could not be initialized. The site owner should apply the database setup and redeploy. Please try again after setup is complete.",
  DATABASE_PERMISSION_DENIED: "The save database account does not have the required permissions. The site owner needs to check its database permissions before sign-in can work.",
  DATABASE_CREDENTIALS_REJECTED: "The PostgreSQL connection credentials were rejected. The site owner needs to check the database connection URL. This is not an incorrect game passphrase.",
  DATABASE_TLS_ERROR: "A secure connection to the save database could not be established. The site owner needs to check the database provider's TLS connection settings.",
  DATABASE_CONNECTION_FAILED: "The save database cannot be reached right now. Please try again. If this continues, the site owner should check the database connection and availability.",
  DATABASE_UNAVAILABLE: "The save database is temporarily unavailable. Please try again in a moment.",
} as const;

export type DatabaseErrorCode = keyof typeof DATABASE_ERROR_MESSAGES;
export interface DatabaseFailure { code: DatabaseErrorCode; message: string; sqlState?: string; }

const driverCodes: Record<string, DatabaseErrorCode> = {
  "42P01": "DATABASE_SCHEMA_NOT_READY", "42703": "DATABASE_SCHEMA_NOT_READY", "3F000": "DATABASE_SCHEMA_NOT_READY",
  "42501": "DATABASE_PERMISSION_DENIED",
  "28P01": "DATABASE_CREDENTIALS_REJECTED", "28000": "DATABASE_CREDENTIALS_REJECTED", "3D000": "DATABASE_CREDENTIALS_REJECTED",
  ECONNREFUSED: "DATABASE_CONNECTION_FAILED", ECONNRESET: "DATABASE_CONNECTION_FAILED", ETIMEDOUT: "DATABASE_CONNECTION_FAILED",
  ENOTFOUND: "DATABASE_CONNECTION_FAILED", EAI_AGAIN: "DATABASE_CONNECTION_FAILED", EPIPE: "DATABASE_CONNECTION_FAILED",
  "53300": "DATABASE_CONNECTION_FAILED", "57P01": "DATABASE_CONNECTION_FAILED", "57P03": "DATABASE_CONNECTION_FAILED",
  ERR_INVALID_URL: "DATABASE_CREDENTIALS_REJECTED",
  CERT_HAS_EXPIRED: "DATABASE_TLS_ERROR", DEPTH_ZERO_SELF_SIGNED_CERT: "DATABASE_TLS_ERROR",
  SELF_SIGNED_CERT_IN_CHAIN: "DATABASE_TLS_ERROR", UNABLE_TO_VERIFY_LEAF_SIGNATURE: "DATABASE_TLS_ERROR",
  UNABLE_TO_GET_ISSUER_CERT_LOCALLY: "DATABASE_TLS_ERROR", ERR_TLS_CERT_ALTNAME_INVALID: "DATABASE_TLS_ERROR",
};

/** Drizzle wraps the original pg error in `cause`. Never inspect/return its SQL
 * message, params, connection string, hostname, username, or password hash. */
export function inspectDatabaseFailure(error: unknown): DatabaseFailure | undefined {
  const pending: unknown[] = [error];
  const seen = new Set<object>();
  for (let depth = 0; pending.length && depth < 20; depth++) {
    const value = pending.shift();
    if (!value || typeof value !== "object" || seen.has(value)) continue;
    seen.add(value);
    const record = value as { code?: unknown; cause?: unknown; errors?: unknown };
    if (typeof record.code === "string") {
      const known = Object.hasOwn(DATABASE_ERROR_MESSAGES, record.code) ? record.code as DatabaseErrorCode
        : (Object.hasOwn(driverCodes, record.code) ? driverCodes[record.code] : undefined) || (record.code.startsWith("42") && /^[0-9A-Z]{5}$/.test(record.code) ? "DATABASE_SCHEMA_NOT_READY" : undefined) || (record.code.startsWith("08") && /^[0-9A-Z]{5}$/.test(record.code) ? "DATABASE_CONNECTION_FAILED" : undefined);
      if (known) return {
        code: known,
        message: DATABASE_ERROR_MESSAGES[known],
        ...(Object.hasOwn(driverCodes, record.code) && /^[0-9A-Z]{5}$/.test(record.code) ? { sqlState: record.code } : {}),
      };
    }
    if (record.cause) pending.push(record.cause);
    if (Array.isArray(record.errors)) pending.push(...record.errors);
  }
  return undefined;
}

/** Defence in depth when an older deployed API returns a raw Drizzle exception. */
export function safeServerErrorMessage(value: unknown, fallback = "The game server could not complete this request. Please try again."): string {
  if (typeof value !== "string" || !value.trim()) return fallback;
  if (value.length > 1_000 || /failed query:|\bparams:|password_hash|passwordHash|postgres(?:ql)?:\/\/|\bSQLSTATE\b|\b(?:select|insert\s+into|delete\s+from|alter\s+table|create\s+table)\s+[\s\S]*(?:\bfrom\b|\bwhere\b|\bvalues\b|\busers\b)|(?:relation|column)\s+["'][\s\S]*does not exist/i.test(value)) {
    return DATABASE_ERROR_MESSAGES.DATABASE_UNAVAILABLE;
  }
  return value;
}
