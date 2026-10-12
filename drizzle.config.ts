import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";
import { getPostgresConnectionString } from "./src/db/config";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
const connectionString = getPostgresConnectionString();

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  // Generating migrations needs no running database. Never invent credentials.
  ...(connectionString
    ? { dbCredentials: { url: connectionString } }
    : {}),
});
