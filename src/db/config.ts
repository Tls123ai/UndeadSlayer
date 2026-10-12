/** Vercel PostgreSQL integrations may expose POSTGRES_URL rather than
 * DATABASE_URL. Treat empty/whitespace variables as unset, without inventing
 * a fallback connection or exposing either value to the browser. */
export function getPostgresConnectionString(
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  return env.DATABASE_URL?.trim() || env.POSTGRES_URL?.trim() || undefined;
}
