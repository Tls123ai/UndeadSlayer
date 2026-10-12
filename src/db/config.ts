/** Vercel PostgreSQL integrations may expose POSTGRES_URL rather than
 * DATABASE_URL. Treat empty/whitespace variables as unset, without inventing
 * a fallback connection or exposing either value to the browser. */
export function getPostgresConnectionString(
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  return env.DATABASE_URL?.trim() || env.POSTGRES_URL?.trim() || undefined;
}

/** Preview deployments also run NODE_ENV=production; name the actual scope. */
export function getDatabaseSetupMessage(env: Record<string, string | undefined> = process.env): string {
  if (env.VERCEL) {
    const environment = env.VERCEL_ENV === "preview" ? "Preview" : env.VERCEL_ENV === "development" ? "Development" : "Production";
    return `The ${environment} save database is not connected. Set DATABASE_URL or POSTGRES_URL for the ${environment} environment in this Vercel project, then redeploy this environment. A variable set only for another environment is not available here.`;
  }
  return "The save database is not connected. Set DATABASE_URL or POSTGRES_URL and restart the server. For a single-server installation, set PGLITE_DATA_DIR to a persistent directory.";
}
